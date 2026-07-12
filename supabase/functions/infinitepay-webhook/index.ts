import { createClient } from 'npm:@supabase/supabase-js@2'

function ok() {
  return new Response(JSON.stringify({ success: true, message: null }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const body = await req.json() as {
      invoice_slug:    string
      amount:          number
      paid_amount:     number
      capture_method:  string
      transaction_nsu: string
      order_nsu:       string
      receipt_url:     string
    }

    if (!body.order_nsu) return ok()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Idempotency: skip if already confirmed
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('order_nsu', body.order_nsu)
      .maybeSingle()

    if (!existing || existing.status === 'active') return ok()

    await supabase.from('payments')
      .update({
        status:             'active',
        paid_at:            new Date().toISOString(),
        ip_slug:            body.invoice_slug ?? null,
        ip_transaction_nsu: body.transaction_nsu ?? null,
        ip_capture_method:  body.capture_method ?? null,
        ip_receipt_url:     body.receipt_url ?? null,
      })
      .eq('order_nsu', body.order_nsu)

    return ok()
  } catch (err) {
    console.error('[infinitepay-webhook]', err)
    return ok() // always 200 so InfinitePay doesn't retry indefinitely
  }
})
