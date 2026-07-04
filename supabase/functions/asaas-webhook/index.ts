import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const { event, payment } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pagamento de assinatura
    if (payment?.subscription) {
      if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        await supabase
          .from('students')
          .update({ pay_status: 'active' })
          .eq('asaas_subscription_id', payment.subscription)
      } else if (event === 'PAYMENT_OVERDUE') {
        await supabase
          .from('students')
          .update({ pay_status: 'overdue' })
          .eq('asaas_subscription_id', payment.subscription)
      } else if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
        await supabase
          .from('students')
          .update({ pay_status: 'pending', asaas_subscription_id: null })
          .eq('asaas_subscription_id', payment.subscription)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'webhook error' }), { status: 400 })
  }
})
