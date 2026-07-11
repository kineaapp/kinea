import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { requestId, action } = await req.json()
    if (!requestId || !action) throw new Error('Campos obrigatórios: requestId, action')
    if (!['aprovar', 'recusar'].includes(action)) throw new Error('action deve ser "aprovar" ou "recusar"')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: planReq, error: reqErr } = await supabase
      .from('plan_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (reqErr || !planReq) throw new Error('Solicitação não encontrada')

    if (action === 'recusar') {
      await supabase.from('plan_requests').update({ status: 'recusado' }).eq('id', requestId)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    await Promise.all([
      supabase.from('students').update({ plan: planReq.requested_plan }).eq('id', planReq.student_id),
      supabase.from('plan_requests').update({ status: 'aprovado' }).eq('id', requestId),
    ])

    return new Response(
      JSON.stringify({ ok: true }),
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
