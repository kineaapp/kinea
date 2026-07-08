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
    const { studentId, planId = 'mensal' } = await req.json()
    if (!studentId) throw new Error('studentId obrigatório')

    const priceId = PRICE_IDS[planId]
    if (!priceId) throw new Error(`Plano inválido: ${planId}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: student, error: dbErr } = await supabase
      .from('students')
      .select('name, email, stripe_subscription_id, stripe_customer_id')
      .eq('id', studentId)
      .single()

    if (dbErr || !student) throw new Error('Aluno não encontrado')

    // Verifica se já existe assinatura ativa
    if (student.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(student.stripe_subscription_id)
        if (sub.status === 'active' || sub.status === 'trialing') {
          throw new Error('Aluno já possui assinatura ativa')
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Aluno já possui assinatura ativa') throw err
        await supabase.from('students')
          .update({ stripe_subscription_id: null, stripe_customer_id: null })
          .eq('id', studentId)
      }
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://kinea-ten.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: student.stripe_customer_id ?? undefined,
      customer_email: student.stripe_customer_id ? undefined : student.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/aluno/perfil/pagamentos?stripe=success`,
      cancel_url:  `${appUrl}/aluno/perfil/pagamentos`,
      subscription_data: {
        metadata: { studentId: String(studentId), planId },
      },
      metadata: { studentId: String(studentId), planId },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
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
