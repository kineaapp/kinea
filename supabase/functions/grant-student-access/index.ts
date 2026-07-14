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
    .select('id, student_id, email, name')
    .eq('id', studentId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!student) return new Response('Not found', { status: 404, headers: CORS })
  if (student.student_id) return new Response(JSON.stringify({ error: 'Aluno já tem acesso.' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  if (!student.email) return new Response(JSON.stringify({ error: 'Cadastre o e-mail do aluno antes de liberar o acesso.' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const password = generatePassword()

  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email: student.email,
    password,
    email_confirm: true,
  })

  if (createError || !authData.user) {
    return new Response(JSON.stringify({ error: createError?.message ?? 'Erro ao criar usuário' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const newUserId = authData.user.id

  await supabase.from('profiles').insert({
    id:                   newUserId,
    name:                 student.name,
    email:                student.email,
    role:                 'student',
    anamnese_completed:   true,
    assessment_completed: true,
  })

  await supabase.from('students').update({ student_id: newUserId }).eq('id', studentId)

  return new Response(JSON.stringify({ password }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
