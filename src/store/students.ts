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
  updatePlan:                (id: number, plan: string) => Promise<void>
  updateStudentInfo:         (id: number, info: { name?: string; email?: string; goal?: string }) => Promise<void>
  blockStudent:              (id: number, blocked: boolean) => Promise<void>
  setStudentStripeSubId:     (id: number, subId: string) => void
  updateAssessmentFrequency: (id: number, freq: AssessmentFrequency) => Promise<void>
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
  stripe_subscription_id: string | null
  blocked:               boolean
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
    cpf:                 r.cpf ?? null,
    stripeSubId:         r.stripe_subscription_id ?? null,
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
    if (data) set({ students: (data as Row[]).map(mapRow) })
  },

  deleteStudent: async (id) => {
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (!error) set(s => ({ students: s.students.filter(st => st.id !== id) }))
  },

  updatePlan: async (id, plan) => {
    const pay_status = plan === 'Permuta' ? 'active' : 'pending'
    const { error } = await supabase.from('students').update({ plan, pay_status }).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, plan, pay: pay_status as PayStatus } : st) }))
  },

  updateStudentInfo: async (id, info) => {
    const { error } = await supabase.from('students').update(info).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, ...info } : st) }))
  },

  setStudentStripeSubId: (id, subId) => set(s => ({
    students: s.students.map(st => st.id === id ? { ...st, stripeSubId: subId } : st),
  })),

  blockStudent: async (id, blocked) => {
    const { error } = await supabase.from('students').update({ blocked }).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, blocked } : st) }))
  },

  updateAssessmentFrequency: async (id, freq) => {
    const { error } = await supabase.from('students').update({ assessment_frequency: freq }).eq('id', id)
    if (!error) set(s => ({ students: s.students.map(st => st.id === id ? { ...st, assessmentFrequency: freq } : st) }))
  },

  addStudent: async (data, coachId) => {
    const today = new Date().toISOString().split('T')[0]
    const plan = data.plan ?? 'Sem plano'
    const { data: row, error } = await supabase
      .from('students')
      .insert({ coach_id: coachId, name: data.name, email: data.email ?? '', goal: data.goal ?? '', plan, since: today, pay_status: plan === 'Permuta' ? 'active' : 'pending' })
      .select()
      .single()
    if (!error && row) set(s => ({ students: [mapRow(row as Row), ...s.students] }))
  },
}))
