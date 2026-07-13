import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let pwd = ''
  const array = new Uint8Array(10)
  crypto.getRandomValues(array)
  for (const byte of array) pwd += chars[byte % chars.length]
  return pwd
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

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

  const { data: student } = await supabase
    .from('students')
    .select('id, student_id, email')
    .eq('id', studentId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!student) return new Response('Not found', { status: 404, headers: CORS })
  if (!student.student_id) return new Response('Aluno ainda não ativou o acesso.', { status: 400, headers: CORS })

  const newPassword = generatePassword()

  const { error } = await supabase.auth.admin.updateUserById(student.student_id, { password: newPassword })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })

  return new Response(JSON.stringify({ password: newPassword }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
