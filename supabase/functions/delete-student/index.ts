import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  // Verifica que o chamador é autenticado e é coach do aluno
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { studentId } = await req.json() as { studentId: number }
  if (!studentId) return new Response('studentId required', { status: 400, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Confirma que o aluno pertence ao coach
  const { data: student } = await supabase
    .from('students')
    .select('id, student_id')
    .eq('id', studentId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!student) return new Response('Not found', { status: 404, headers: CORS })

  // Apaga o usuário de auth — cascata apaga clients, subscriptions, subscription_payments
  if (student.student_id) {
    await supabase.auth.admin.deleteUser(student.student_id)
  }

  // Apaga o registro de students (pode já ter sido cascade se student_id era FK)
  await supabase.from('students').delete().eq('id', studentId)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
