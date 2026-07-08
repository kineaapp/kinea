import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-04-22.dahlia' as never,
})

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICE_IDS: Record<string, string> = {
  mensal:     Deno.env.get('STRIPE_PRICE_MENSAL')!,
  trimestral: Deno.env.get('STRIPE_PRICE_TRIMESTRAL')!,
  semestral:  Deno.env.get('STRIPE_PRICE_SEMESTRAL')!,
  anual:      Deno.env.get('STRIPE_PRICE_ANUAL')!,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { requestId, action } = await req.json()
    if (!requestId || !action) throw new Error('Campos obrigatórios: requestId, action')
    if (!['aprovar', 'recusar'].includes(action)) throw new Error('action deve ser "aprovar" ou "recusar"')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: planReq, error: reqErr } = await supabase
      .from('plan_requests')
      .select('*, students(stripe_subscription_id)')
      .eq('id', requestId)
      .single()

    if (reqErr || !planReq) throw new Error('Solicitação não encontrada')

    if (action === 'recusar') {
      await supabase.from('plan_requests').update({ status: 'recusado' }).eq('id', requestId)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Aprovar: atualiza a assinatura no Stripe
    const subId = planReq.students?.stripe_subscription_id
    if (!subId) throw new Error('Aluno sem assinatura ativa no Stripe')

    const newPriceId = PRICE_IDS[planReq.requested_plan]
    if (!newPriceId) throw new Error(`Plano inválido: ${planReq.requested_plan}`)

    const sub = await stripe.subscriptions.retrieve(subId)
    const itemId = sub.items.data[0]?.id
    if (!itemId) throw new Error('Item de assinatura não encontrado')

    // renovacao: muda na próxima renovação (sem proration)
    // mudanca: muda imediatamente com novo ciclo
    const isMudanca = planReq.type === 'mudanca'

    await stripe.subscriptions.update(subId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'none',
      ...(isMudanca ? { billing_cycle_anchor: 'now' as const } : {}),
      metadata: { ...sub.metadata, planId: planReq.requested_plan },
    })

    // Atualiza o plano no Supabase e marca solicitação como aprovada
    await Promise.all([
      supabase.from('students').update({ plan: planReq.requested_plan }).eq('id', planReq.student_id),
      supabase.from('plan_requests').update({ status: 'aprovado' }).eq('id', requestId),
    ])

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
