import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Tenta buscar pagamentos da assinatura com até `maxRetries` tentativas
async function fetchFirstPayment(subscriptionId: string, apiKey: string, baseUrl: string, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/payments`, {
      headers: { 'access_token': apiKey },
    })
    const data = await res.json()
    if (data.data?.length > 0) return data.data[0]
    await new Promise(r => setTimeout(r, 1500))
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: 'Não autenticado' }, 401)

    const { planCode, creditCard, creditCardHolderInfo } = await req.json() as {
      planCode: string
      creditCard?: {
        holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string
      }
      creditCardHolderInfo?: {
        name: string; email: string; cpfCnpj: string
        postalCode: string; addressNumber: string; phone?: string
      }
    }
    if (!planCode) return json({ error: 'planCode é obrigatório' })

    // Busca plano
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('code', planCode)
      .eq('active', true)
      .single()
    if (!plan) return json({ error: 'Plano não encontrado' })

    // Busca cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id, asaas_customer_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!client?.asaas_customer_id) {
      return json({ error: 'Cliente Asaas não encontrado. Execute create-customer primeiro.' })
    }

    const baseUrl = Deno.env.get('ASAAS_BASE_URL')!
    const apiKey  = Deno.env.get('ASAAS_API_KEY')!

    // Monta payload da assinatura
    const today = new Date().toISOString().split('T')[0]
    const payload: Record<string, unknown> = {
      customer:     client.asaas_customer_id,
      billingType:  plan.payment_method,
      value:        plan.value,
      cycle:        plan.cycle,
      nextDueDate:  today,
      description:  `Kinea Personal — ${plan.label}`,
    }
    if (plan.max_payments) payload.maxPayments = plan.max_payments

    if (plan.payment_method === 'CREDIT_CARD') {
      if (!creditCard || !creditCardHolderInfo) {
        return json({ error: 'Dados do cartão são obrigatórios para este plano' })
      }
      payload.creditCard = {
        holderName:  creditCard.holderName,
        number:      creditCard.number.replace(/\D/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear:  creditCard.expiryYear,
        ccv:         creditCard.ccv,
      }
      payload.creditCardHolderInfo = {
        name:          creditCardHolderInfo.name,
        email:         creditCardHolderInfo.email,
        cpfCnpj:       creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode:    creditCardHolderInfo.postalCode.replace(/\D/g, ''),
        addressNumber: creditCardHolderInfo.addressNumber,
        phone:         creditCardHolderInfo.phone?.replace(/\D/g, '') ?? undefined,
      }
    }

    // Cria assinatura no Asaas
    const asaasRes = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
      body: JSON.stringify(payload),
    })
    const asaasData = await asaasRes.json()

    if (!asaasRes.ok || asaasData.errors?.length) {
      const msg = asaasData.errors?.[0]?.description ?? `Erro Asaas: ${asaasRes.status}`
      return json({ error: msg })
    }

    // Salva no banco
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        client_id:             client.id,
        plan_id:               plan.id,
        asaas_subscription_id: asaasData.id,
        status:                'pending',
        max_cycles:            plan.max_payments ?? null,
        next_due_date:         asaasData.nextDueDate ?? null,
      })
      .select('id')
      .single()
    if (subErr) return json({ error: subErr.message })

    // Para Pix: busca primeiro pagamento e gera QR Code
    let pixQrCode: string | null    = null
    let pixCopyPaste: string | null = null
    let pixDueDate: string | null   = null

    if (plan.payment_method === 'PIX') {
      const firstPayment = await fetchFirstPayment(asaasData.id, apiKey, baseUrl)
      if (firstPayment) {
        pixDueDate = firstPayment.dueDate ?? null

        const qrRes  = await fetch(`${baseUrl}/payments/${firstPayment.id}/pixQrCode`, {
          headers: { 'access_token': apiKey },
        })
        const qrData = await qrRes.json()
        console.log('[create-subscription] pixQrCode raw:', JSON.stringify(qrData))

        // Asaas pode retornar encodedImage direto ou aninhado
        pixQrCode    = qrData.encodedImage
                    ?? qrData.qrCode?.encodedImage
                    ?? qrData.image
                    ?? null
        pixCopyPaste = qrData.payload
                    ?? qrData.qrCode?.payload
                    ?? qrData.pixCopyAndPaste
                    ?? null

        await supabase.from('subscription_payments').insert({
          subscription_id:  sub!.id,
          asaas_payment_id: firstPayment.id,
          cycle_number:     1,
          value:            firstPayment.value,
          status:           'pending',
          due_date:         firstPayment.dueDate ?? null,
          pix_qr_code:      pixQrCode,
          pix_copy_paste:   pixCopyPaste,
        })
      }
    }

    return json({ subscriptionId: sub!.id, pixQrCode, pixCopyPaste, pixDueDate })

  } catch (err) {
    console.error('[create-subscription]', err)
    return json({ error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
