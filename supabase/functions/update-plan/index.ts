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

// Troca de plano direta (usada nos ≤ 7 dias antes da renovação — sem aprovação do coach)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { studentId, requestedPlan } = await req.json()
    if (!studentId || !requestedPlan) throw new Error('Campos obrigatórios: studentId, requestedPlan')

    const newPriceId = PRICE_IDS[requestedPlan]
    if (!newPriceId) throw new Error(`Plano inválido: ${requestedPlan}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: student, error: dbErr } = await supabase
      .from('students')
      .select('stripe_subscription_id')
      .eq('id', studentId)
      .single()

    if (dbErr || !student) throw new Error('Aluno não encontrado')
    if (!student.stripe_subscription_id) throw new Error('Aluno sem assinatura ativa no Stripe')

    const sub    = await stripe.subscriptions.retrieve(student.stripe_subscription_id)
    const itemId = sub.items.data[0]?.id
    if (!itemId) throw new Error('Item de assinatura não encontrado')

    await stripe.subscriptions.update(student.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'none',
      metadata: { ...sub.metadata, planId: requestedPlan },
    })

    await supabase.from('students')
      .update({ plan: requestedPlan })
      .eq('id', studentId)

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
