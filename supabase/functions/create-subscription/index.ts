import { createClient } from 'npm:@supabase/supabase-js@2'

const ASAAS_BASE = 'https://api.asaas.com/api/v3'
const ASAAS_KEY  = Deno.env.get('ASAAS_API_KEY') ?? ''

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

    // Busca dados do aluno
    const { data: student, error: dbErr } = await supabase
      .from('students')
      .select('name, email, cpf, asaas_customer_id, asaas_subscription_id')
      .eq('id', studentId)
      .single()

    if (dbErr || !student) throw new Error('Aluno não encontrado')
    if (!student.cpf) throw new Error('CPF do aluno não cadastrado. Peça ao aluno que atualize seu perfil.')

    // Assinatura já existe — devolve sem criar nova
    if (student.asaas_subscription_id) {
      const chargesRes = await fetch(
        `${ASAAS_BASE}/payments?subscription=${student.asaas_subscription_id}&limit=1&status=PENDING`,
        { headers: { 'access_token': ASAAS_KEY } },
      )
      const charges = await chargesRes.json()
      const paymentUrl = charges.data?.[0]?.invoiceUrl ?? null
      return new Response(
        JSON.stringify({ paymentUrl, subscriptionId: student.asaas_subscription_id, alreadyExisted: true }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Cria ou reutiliza cliente Asaas
    let customerId: string = student.asaas_customer_id ?? ''

    if (!customerId) {
      const res = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_KEY },
        body: JSON.stringify({
          name:      student.name,
          cpfCnpj:   student.cpf.replace(/\D/g, ''),
          email:     student.email,
          notificationDisabled: false,
        }),
      })
      const customer = await res.json()
      if (customer.errors?.length) throw new Error(customer.errors[0]?.description ?? 'Erro ao criar cliente no Asaas')
      customerId = customer.id
    }

    // Cria assinatura mensal (3 cobranças = trimestral)
    const today = new Date().toISOString().split('T')[0]
    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_KEY },
      body: JSON.stringify({
        customer:    customerId,
        billingType: 'UNDEFINED', // aluno escolhe na hora: Pix, boleto ou cartão
        value:       247,
        nextDueDate: today,
        cycle:       'MONTHLY',
        maxPayments: 3,
        description: 'Consultoria Kinea - 3x R$ 247,00',
      }),
    })
    const subscription = await subRes.json()
    if (subscription.errors?.length) throw new Error(subscription.errors[0]?.description ?? 'Erro ao criar assinatura')

    // Busca a primeira cobrança (criada automaticamente pelo Asaas)
    const chargesRes = await fetch(
      `${ASAAS_BASE}/payments?subscription=${subscription.id}&limit=1`,
      { headers: { 'access_token': ASAAS_KEY } },
    )
    const charges = await chargesRes.json()
    const paymentUrl: string | null = charges.data?.[0]?.invoiceUrl ?? null

    // Salva IDs no Supabase
    await supabase.from('students').update({
      asaas_customer_id:     customerId,
      asaas_subscription_id: subscription.id,
    }).eq('id', studentId)

    return new Response(
      JSON.stringify({ paymentUrl, subscriptionId: subscription.id }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
