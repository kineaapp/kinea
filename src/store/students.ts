import { create } from 'zustand'
import type { Student, PayStatus, SemColor } from '../data/mock'
import { supabase } from '../lib/supabase'

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export type NewStudentData = { name: string; email: string; goal: string; plan: string }

interface StudentsStore {
  students: Student[]
  loading:  boolean
  fetchStudents:  (coachId: string) => Promise<void>
  addStudent:     (data: NewStudentData, coachId: string) => Promise<void>
  deleteStudent:  (id: number) => Promise<void>
}

type Row = {
  id:              number
  name:            string
  email:           string
  goal:            string
  plan:            string
  pay_status:      PayStatus
  engagement:      SemColor
  next_assessment: string | null
  since:           string
}

function formatSince(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  return `${MONTHS[parseInt(month) - 1]}/${year}`
}

function mapRow(r: Row): Student {
  return {
    id:    r.id,
    name:  r.name,
    email: r.email,
    goal:  r.goal,
    plan:  r.plan,
    pay:   r.pay_status,
    sem:   r.engagement,
    next:  r.next_assessment ?? '—',
    since: formatSince(r.since),
  }
}

export const useStudentsStore = create<StudentsStore>((set) => ({
  students: [],
  loading:  false,

  fetchStudents: async (coachId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    set({ loading: false })
    if (!error && data) set({ students: (data as Row[]).map(mapRow) })
  },

  deleteStudent: async (id) => {
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (!error) set(s => ({ students: s.students.filter(st => st.id !== id) }))
  },

  addStudent: async (data, coachId) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: row, error } = await supabase
      .from('students')
      .insert({ coach_id: coachId, name: data.name, email: data.email, goal: data.goal, plan: data.plan, since: today })
      .select()
      .single()
    if (!error && row) set(s => ({ students: [mapRow(row as Row), ...s.students] }))
  },
}))
