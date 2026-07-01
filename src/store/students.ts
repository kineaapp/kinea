import { create } from 'zustand'
import { ROSTER } from '../data/mock'
import type { Student, PayStatus, SemColor } from '../data/mock'

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export type NewStudentData = { name: string; email: string; goal: string; plan: string }

interface StudentsStore {
  students: Student[]
  addStudent: (data: NewStudentData) => void
}

export const useStudentsStore = create<StudentsStore>((set) => ({
  students: [...ROSTER],
  addStudent: (data) => {
    const now = new Date()
    const student: Student = {
      ...data,
      id:    Date.now(),
      pay:   'pending' as PayStatus,
      sem:   'green'   as SemColor,
      next:  '—',
      since: `${MONTHS[now.getMonth()]}/${now.getFullYear()}`,
    }
    set(s => ({ students: [...s.students, student] }))
  },
}))
