import { createClient } from 'npm:@supabase/supabase-js@2'

function json200() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  // Valida token do webhook configurado no painel Asaas
  const webhookToken = req.headers.get('asaas-access-token')
  if (webhookToken !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()
    const { event, payment } = body as {
      event: string
      payment?: {
        id: string; subscription?: string; value: number
        dueDate?: string; status?: string
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Idempotência: ignora evento já processado
    const eventId = body.id ?? `${event}-${payment?.id ?? Date.now()}`
    const { data: dup } = await supabase
      .from('asaas_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle()
    if (dup) return json200()

    await supabase.from('asaas_webhook_events').insert({
      event_id:   eventId,
      event_type: event,
      payload:    body,
    })

    // ── Pagamento confirmado ──────────────────────────────────
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const asaasSubId = payment?.subscription
      if (!asaasSubId || !payment?.id) return json200()

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, current_cycle, max_cycles, status')
        .eq('asaas_subscription_id', asaasSubId)
        .maybeSingle()
      if (!sub) return json200()

      const newCycle = sub.current_cycle + 1
      const now      = new Date().toISOString()

      await supabase.from('subscription_payments').upsert({
        subscription_id:  sub.id,
        asaas_payment_id: payment.id,
        cycle_number:     newCycle,
        value:            payment.value,
        status:           'confirmed',
        paid_at:          now,
        due_date:         payment.dueDate ?? null,
      }, { onConflict: 'asaas_payment_id' })

      await supabase.from('subscriptions').update({
        current_cycle: newCycle,
        status:        'active',
        next_due_date: payment.dueDate ?? null,
        updated_at:    now,
      }).eq('id', sub.id)
    }

    // ── Pagamento vencido ─────────────────────────────────────
    else if (event === 'PAYMENT_OVERDUE') {
      if (payment?.id) {
        await supabase.from('subscription_payments')
          .update({ status: 'overdue' })
          .eq('asaas_payment_id', payment.id)
      }
      const asaasSubId = payment?.subscription
      if (asaasSubId) {
        await supabase.from('subscriptions')
          .update({ status: 'overdue', updated_at: new Date().toISOString() })
          .eq('asaas_subscription_id', asaasSubId)
      }
    }

    // ── Assinatura cancelada/encerrada ────────────────────────
    else if (event === 'SUBSCRIPTION_DELETED') {
      const asaasSubId: string | undefined =
        body.subscription?.id ?? payment?.subscription
      if (!asaasSubId) return json200()

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('current_cycle, max_cycles')
        .eq('asaas_subscription_id', asaasSubId)
        .maybeSingle()

      if (sub) {
        const finished = sub.max_cycles != null && sub.current_cycle >= sub.max_cycles
        await supabase.from('subscriptions')
          .update({
            status:     finished ? 'finished' : 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_subscription_id', asaasSubId)
      }
    }

    // ── Pagamento estornado/deletado ──────────────────────────
    else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      if (payment?.id) {
        await supabase.from('subscription_payments')
          .update({ status: 'refunded' })
          .eq('asaas_payment_id', payment.id)
      }
    }

    return json200()

  } catch (err) {
    console.error('[asaas-webhook]', err)
    return json200() // Sempre 200 para Asaas não reenviar indefinidamente
  }
})
