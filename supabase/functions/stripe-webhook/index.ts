import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-04-22.dahlia' as never,
})

Deno.serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch {
    return new Response('Webhook signature inválida', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object as Stripe.Checkout.Session
      const studentId  = session.metadata?.studentId
      const planId     = session.metadata?.planId
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (studentId && customerId) {
        await supabase.from('students')
          .update({ stripe_customer_id: customerId, ...(planId ? { plan: planId } : {}) })
          .eq('id', parseInt(studentId))
      }

    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (subId) {
        const sub       = await stripe.subscriptions.retrieve(subId)
        const studentId = sub.metadata?.studentId
        const planId    = sub.metadata?.planId
        if (studentId) {
          await supabase.from('students')
            .update({
              pay_status:                 'active',
              stripe_subscription_id:     subId,
              ...(planId ? { plan: planId } : {}),
              stripe_current_period_end:  sub.current_period_end,
            })
            .eq('id', parseInt(studentId))
        }
      }

    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const subId   = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
      if (subId) {
        const sub       = await stripe.subscriptions.retrieve(subId)
        const studentId = sub.metadata?.studentId
        if (studentId) {
          await supabase.from('students')
            .update({ pay_status: 'overdue' })
            .eq('id', parseInt(studentId))
        }
      }

    } else if (event.type === 'customer.subscription.updated') {
      const sub       = event.data.object as Stripe.Subscription
      const studentId = sub.metadata?.studentId
      const planId    = sub.metadata?.planId
      if (studentId) {
        await supabase.from('students')
          .update({
            stripe_current_period_end: sub.current_period_end,
            ...(planId ? { plan: planId } : {}),
          })
          .eq('id', parseInt(studentId))
      }

    } else if (event.type === 'customer.subscription.deleted') {
      const sub       = event.data.object as Stripe.Subscription
      const studentId = sub.metadata?.studentId
      if (studentId) {
        await supabase.from('students')
          .update({ pay_status: 'pending', stripe_subscription_id: null, stripe_current_period_end: null })
          .eq('id', parseInt(studentId))
      }
    }
  } catch {
    // Retorna 200 para o Stripe não retentar indefinidamente
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
