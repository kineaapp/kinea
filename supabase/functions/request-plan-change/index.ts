import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { studentId, requestedPlan, type } = await req.json()
    if (!studentId || !requestedPlan || !type) throw new Error('Campos obrigatórios: studentId, requestedPlan, type')
    if (!['mudanca', 'renovacao'].includes(type)) throw new Error('type deve ser "mudanca" ou "renovacao"')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: student, error: dbErr } = await supabase
      .from('students')
      .select('plan')
      .eq('id', studentId)
      .single()

    if (dbErr || !student) throw new Error('Aluno não encontrado')

    // Remove solicitações anteriores pendentes do mesmo aluno
    await supabase.from('plan_requests')
      .delete()
      .eq('student_id', studentId)
      .eq('status', 'pendente')

    const { error: insertErr } = await supabase.from('plan_requests').insert({
      student_id:     studentId,
      current_plan:   student.plan ?? 'mensal',
      requested_plan: requestedPlan,
      type,
    })

    if (insertErr) throw insertErr

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
