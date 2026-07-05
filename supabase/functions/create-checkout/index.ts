import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-04-22.dahlia' as never,
})

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { studentId } = await req.json()
    if (!studentId) throw new Error('studentId obrigatório')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: student, error: dbErr } = await supabase
      .from('students')
      .select('name, email, stripe_customer_id, stripe_subscription_id')
      .eq('id', studentId)
      .single()

    if (dbErr || !student) throw new Error('Aluno não encontrado')

    // Verifica se já existe assinatura ativa (ignora erros de ID inválido/ambiente diferente)
    if (student.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(student.stripe_subscription_id)
        if (sub.status === 'active' || sub.status === 'trialing') {
          throw new Error('Aluno já possui assinatura ativa')
        }
      } catch (err) {
        // Se o erro veio do throw acima, repropaga
        if (err instanceof Error && err.message === 'Aluno já possui assinatura ativa') throw err
        // Caso contrário (ID de outro ambiente, expirado etc.) — limpa e segue
        await supabase.from('students').update({ stripe_subscription_id: null }).eq('id', studentId)
      }
    }

    // Cria ou reutiliza cliente Stripe
    let customerId: string = student.stripe_customer_id ?? ''
    if (!customerId) {
      const customer = await stripe.customers.create({
        name:  student.name,
        email: student.email,
        metadata: { studentId: String(studentId) },
      })
      customerId = customer.id
      await supabase.from('students').update({ stripe_customer_id: customerId }).eq('id', studentId)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://kinea-ten.vercel.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
      success_url: `${appUrl}/aluno/perfil/pagamentos?stripe=success`,
      cancel_url:  `${appUrl}/aluno/perfil/pagamentos`,
      subscription_data: {
        metadata: { studentId: String(studentId) },
      },
      metadata: { studentId: String(studentId) },
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
