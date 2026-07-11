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

    const { name, email, cpfCnpj, phone } = await req.json() as {
      name: string; email: string; cpfCnpj: string; phone?: string
    }
    if (!name?.trim() || !email?.trim() || !cpfCnpj?.trim()) {
      return json({ error: 'Campos obrigatórios: name, email, cpfCnpj' })
    }

    // Se cliente já existe com Asaas ID, retorna sem criar de novo
    const { data: existing } = await supabase
      .from('clients')
      .select('id, asaas_customer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing?.asaas_customer_id) {
      return json({ clientId: existing.id, asaasCustomerId: existing.asaas_customer_id })
    }

    // Cria cliente no Asaas
    const asaasRes = await fetch(`${Deno.env.get('ASAAS_BASE_URL')}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY')!,
      },
      body: JSON.stringify({
        name,
        email,
        cpfCnpj: cpfCnpj.replace(/\D/g, ''), // só dígitos
        mobilePhone: phone?.replace(/\D/g, '') ?? undefined,
      }),
    })
    const asaasData = await asaasRes.json()

    if (!asaasRes.ok || asaasData.errors?.length) {
      const msg = asaasData.errors?.[0]?.description ?? `Erro Asaas: ${asaasRes.status}`
      return json({ error: msg })
    }

    const asaasCustomerId: string = asaasData.id

    if (existing) {
      // Atualiza registro existente sem Asaas ID
      await supabase.from('clients').update({
        asaas_customer_id: asaasCustomerId,
        name, email,
        cpf_cnpj: cpfCnpj,
        phone: phone ?? null,
      }).eq('id', existing.id)
      return json({ clientId: existing.id, asaasCustomerId })
    }

    // Insere novo registro
    const { data: newClient, error: insertErr } = await supabase
      .from('clients')
      .insert({
        auth_user_id: user.id,
        asaas_customer_id: asaasCustomerId,
        name, email,
        cpf_cnpj: cpfCnpj,
        phone: phone ?? null,
      })
      .select('id')
      .single()

    if (insertErr) return json({ error: insertErr.message })
    return json({ clientId: newClient.id, asaasCustomerId })

  } catch (err) {
    console.error('[create-customer]', err)
    return json({ error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
