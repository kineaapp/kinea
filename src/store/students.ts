import { create } from 'zustand'
import type { Student, PayStatus, SemColor, AssessmentFrequency } from '../data/mock'
import { supabase } from '../lib/supabase'

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export type NewStudentData = { name: string; email?: string; goal?: string; plan?: string }

interface StudentsStore {
  students: Student[]
  loading:  boolean
  fetchError: string | null
  fetchStudents:             (coachId: string) => Promise<void>
  addStudent:                (data: NewStudentData, coachId: string) => Promise<void>
  deleteStudent:             (id: number) => Promise<void>
  updatePlan:                (id: number, plan: string) => Promise<boolean>
  updateStudentInfo:         (id: number, info: { name?: string; email?: string; goal?: string; phone?: string | null }) => Promise<void>
  blockStudent:              (id: number, blocked: boolean) => Promise<void>
  updateAssessmentFrequency: (id: number, freq: AssessmentFrequency) => Promise<void>
  updateNextAssessment:      (id: number, date: string) => Promise<void>
}

type Row = {
  id:                    number
  student_id:            string | null
  name:                  string
  email:                 string
  goal:                  string
  plan:                  string
  pay_status:            PayStatus
  engagement:            SemColor
  next_assessment:       string | null
  since:                 string
  cpf:                   string | null
  phone:                 string | null
  blocked:               boolean
  unblocked_at:          string | null
  assessment_frequency:  AssessmentFrequency
}

function formatSince(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  return `${MONTHS[parseInt(month) - 1]}/${year}`
}

function mapRow(r: Row): Student {
  return {
    id:                  r.id,
    studentUuid:         r.student_id ?? '',
    name:                r.name,
    email:               r.email,
    goal:                r.goal,
    plan:                r.plan,
    pay:                 r.pay_status,
    sem:                 r.engagement,
    next:                r.next_assessment ?? '—',
    since:               formatSince(r.since),
    sinceRaw:            r.since,
    cpf:                 r.cpf ?? null,
    phone:               r.phone ?? null,
    blocked:             r.blocked ?? false,
    assessmentFrequency: r.assessment_frequency ?? null,
  }
}

export const useStudentsStore = create<StudentsStore>((set) => ({
  students:   [],
  loading:    false,
  fetchError: null,

  fetchStudents: async (coachId) => {
    set({ loading: true, fetchError: null })
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    set({ loading: false })
    if (error) { set({ fetchError: error.message }); return }
    if (!data) return

    // Detecta alunos com parcelas vencidas na tabela payments
    const _d = new Date()
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`
    const fiveDaysAgo = new Date(_d); fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const fiveDaysAgoStr = `${fiveDaysAgo.getFullYear()}-${String(fiveDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(fiveDaysAgo.getDate()).padStart(2, '0')}`

    const studentIds = (data as Row[]).map(r => r.id)
    const { data: overdueRows } = await supabase
      .from('payments')
      .select('student_id, due_date')
      .in('student_id', studentIds)
      .in('status', ['pending', 'overdue'])
      .lt('due_date', today)

    const overdueIds    = new Set((overdueRows ?? []).map((p: any) => p.student_id))
    const autoBlockIds  = new Set((overdueRows ?? []).filter((p: any) => p.due_date <= fiveDaysAgoStr).map((p: any) => p.student_id))

    // Auto-bloqueia alunos com 5+ dias de atraso, exceto se o coach desbloqueou há menos de 5 dias
    const toBlock = (data as Row[]).filter(r => {
      if (!autoBlockIds.has(r.id) || r.blocked) return false
      if (!r.unblocked_at) return true
      return r.unblocked_at <= fiveDaysAgoStr + 'T23:59:59Z'
    })
    if (toBlock.length > 0) {
      await supabase.from('students').update({ blocked: true, unblocked_at: null }).in('id', toBlock.map(r => r.id))
    }

    set({
      students: (data as Row[]).map(r => {
        const s = mapRow(r)
        if (autoBlockIds.has(r.id) && s.pay !== 'active') {
          s.pay = 'overdue'
        } else if (overdueIds.has(r.id) && s.pay !== 'active') {
          s.pay = 'pending'
        }
        if (toBlock.some(t => t.id === r.id)) s.blocked = true
        return s
      }),
    })
  },

  deleteStudent: async (id) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-student`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ studentId: id }),
      }
    )
    if (res.ok) set(s => ({ students: s.students.filter(st => st.id !== id) }))
  },

  updatePlan: async (id, plan) => {
    const pay_status = plan === 'Permuta' ? 'active' : 'pending'
    const { error } = await supabase.from('students').update({ plan, pay_status }).eq('id', id)
    if (error) return false
    set(s => ({ students: s.students.map(st => st.id === id ? { ...st, plan, pay: pay_status as PayStatus } : st) }))
    return true
  },

  updateStudentInfo: async (id, info) => {
    const { error } = await supabase.from('students').update(info).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, ...info } : st) }))
  },

  blockStudent: async (id, blocked) => {
    const unblocked_at = blocked ? null : new Date().toISOString()
    const { error } = await supabase.from('students').update({ blocked, unblocked_at }).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, blocked } : st) }))
  },

  updateAssessmentFrequency: async (id, freq) => {
    const { error } = await supabase.from('students').update({ assessment_frequency: freq }).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, assessmentFrequency: freq } : st) }))
  },

  updateNextAssessment: async (id, date) => {
    const { error } = await supabase.from('students').update({ next_assessment: date }).eq('id', id)
    if (!error) set(s => ({
      students: s.students.map(st => st.id === id ? { ...st, next: date } : st),
    }))
  },

  addStudent: async (data, coachId) => {
    const _d2 = new Date()
    const today = `${_d2.getFullYear()}-${String(_d2.getMonth() + 1).padStart(2, '0')}-${String(_d2.getDate()).padStart(2, '0')}`
    const plan = data.plan ?? 'Sem plano'
    const { data: row, error } = await supabase
      .from('students')
      .insert({ coach_id: coachId, name: data.name, email: data.email ?? '', goal: data.goal ?? '', plan, since: today, pay_status: plan === 'Permuta' ? 'active' : 'pending' })
      .select()
      .single()
    if (!error && row) set(s => ({ students: [mapRow(row as Row), ...s.students] }))
  },
}))
