import { create } from 'zustand'

export type NotifToast = {
  kind: 'msg' | 'eval'
  studentName: string
  studentId?: number
}

interface CoachNotificationsStore {
  newAssessments: number
  toast: NotifToast | null
  incrementAssessments: () => void
  clearAssessments: () => void
  showToast: (t: NotifToast) => void
  dismissToast: () => void
}

export const useCoachNotificationsStore = create<CoachNotificationsStore>((set) => ({
  newAssessments: 0,
  toast: null,

  incrementAssessments: () => set(s => ({ newAssessments: s.newAssessments + 1 })),
  clearAssessments: () => set({ newAssessments: 0 }),
  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
}))
