import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const HANDLE      = 'alemancilha'
const WEBHOOK_URL = 'https://ctnyurfxphnupyiffpxo.supabase.co/functions/v1/infinitepay-webhook'

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return err('Unauthorized', 401)

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return err('Unauthorized', 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json() as {
    studentId?:  number   // coach-initiated: numeric students.id
    amount:      number   // in R$ (ex: 399.00)
    description: string
    redirectUrl: string   // frontend URL to return after payment
  }

  if (!body.amount || !body.description || !body.redirectUrl) {
    return err('amount, description e redirectUrl são obrigatórios')
  }

  let studentId: number

  if (body.studentId) {
    // Coach-initiated: verify coach owns the student
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', body.studentId)
      .eq('coach_id', user.id)
      .maybeSingle()
    if (!student) return err('Aluno não encontrado', 404)
    studentId = student.id
  } else {
    // Student-initiated: look up their own numeric students.id
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', user.id)
      .maybeSingle()
    if (!student) return err('Aluno não encontrado', 404)
    studentId = student.id
  }

  const orderNsu = crypto.randomUUID()
  const dueDate  = new Date().toISOString().split('T')[0]

  // Create pending payment record
  const { data: payment, error: insertErr } = await supabase
    .from('payments')
    .insert({
      student_id:  studentId,
      amount:      body.amount,
      description: body.description,
      status:      'pending',
      due_date:    dueDate,
      order_nsu:   orderNsu,
    })
    .select('id')
    .single()

  if (insertErr || !payment) {
    console.error('[create-payment-link] insert error:', insertErr?.message)
    return err('Erro ao registrar pagamento', 500)
  }

  // Call InfinitePay
  const ipBody = {
    handle:       HANDLE,
    redirect_url: body.redirectUrl,
    webhook_url:  WEBHOOK_URL,
    order_nsu:    orderNsu,
    items: [
      {
        quantity:    1,
        price:       Math.round(body.amount * 100), // cents
        description: body.description,
      },
    ],
  }

  const ipRes = await fetch('https://api.checkout.infinitepay.io/links', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(ipBody),
  })

  if (!ipRes.ok) {
    const errText = await ipRes.text()
    console.error('[create-payment-link] InfinitePay error:', errText)
    await supabase.from('payments').delete().eq('id', payment.id)
    return err('Erro ao criar link de pagamento na InfinitePay', 502)
  }

  const { url: checkoutUrl } = await ipRes.json() as { url: string }

  await supabase.from('payments')
    .update({ checkout_url: checkoutUrl })
    .eq('id', payment.id)

  return new Response(
    JSON.stringify({ checkoutUrl, orderNsu, paymentId: payment.id }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
