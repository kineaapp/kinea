import { create } from 'zustand'

export type LeadStage = 'novo' | 'contactado' | 'interessado' | 'fechado' | 'perdido'

export interface Lead {
  id:      number
  name:    string
  goal:    string
  source:  string
  plan:    string
  value:   string
  when:    string
  contact: string
  stage:   LeadStage
}

interface LeadsStore {
  leads:    Lead[]
  _nextId:  number
  addLead:  (data: Omit<Lead, 'id'>) => void
  setLeads: (fn: (prev: Lead[]) => Lead[]) => void
}

export const useLeadsStore = create<LeadsStore>((set) => ({
  leads:    [],
  _nextId:  1,
  addLead:  (data) => set(s => ({ leads: [{ id: s._nextId, ...data }, ...s.leads], _nextId: s._nextId + 1 })),
  setLeads: (fn)   => set(s => ({ leads: fn(s.leads) })),
}))
