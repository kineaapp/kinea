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

    const { data: student } = await supabase
      .from('students')
      .select('asaas_subscription_id, pay_status')
      .eq('id', studentId)
      .single()

    if (!student?.asaas_subscription_id) throw new Error('Nenhuma assinatura encontrada para este aluno')

    // Busca pagamentos confirmados da assinatura no Asaas
    const res = await fetch(
      `${ASAAS_BASE}/payments?subscription=${student.asaas_subscription_id}&limit=10`,
      { headers: { 'access_token': ASAAS_KEY } },
    )
    const { data: payments } = await res.json()

    // Status do Asaas → pay_status do banco
    const STATUS_MAP: Record<string, string> = {
      CONFIRMED: 'active',
      RECEIVED:  'active',
      OVERDUE:   'overdue',
      PENDING:   'pending',
    }

    const latest = payments?.[0]
    if (!latest) throw new Error('Nenhuma cobrança encontrada no Asaas')

    const newStatus = STATUS_MAP[latest.status] ?? 'pending'

    if (newStatus !== student.pay_status) {
      await supabase.from('students')
        .update({ pay_status: newStatus })
        .eq('id', studentId)
    }

    return new Response(
      JSON.stringify({ asaasStatus: latest.status, payStatus: newStatus, updated: newStatus !== student.pay_status }),
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
