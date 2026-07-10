import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
  leads:       Lead[]
  loading:     boolean
  fetchLeads:  (coachId: string) => Promise<void>
  addLead:     (data: Omit<Lead, 'id' | 'when'>, coachId: string) => Promise<void>
  updateStage: (id: number, stage: LeadStage) => Promise<void>
}

function fmtWhen(createdAt: string): string {
  const diff  = Date.now() - new Date(createdAt).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days  = Math.floor(hours / 24)
  return `${days}d atrás`
}

export const useLeadsStore = create<LeadsStore>((set) => ({
  leads:   [],
  loading: false,

  fetchLeads: async (coachId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    set({ loading: false })
    if (!data) return
    set({
      leads: data.map((r: any) => ({
        id:      r.id,
        name:    r.name,
        goal:    r.goal,
        source:  r.source,
        plan:    r.plan,
        value:   r.value,
        contact: r.contact,
        stage:   r.stage as LeadStage,
        when:    fmtWhen(r.created_at),
      })),
    })
  },

  addLead: async (data, coachId) => {
    const { data: row, error } = await supabase
      .from('leads')
      .insert({ coach_id: coachId, ...data })
      .select()
      .single()
    if (error || !row) return
    set(s => ({
      leads: [{
        id:      row.id,
        name:    row.name,
        goal:    row.goal,
        source:  row.source,
        plan:    row.plan,
        value:   row.value,
        contact: row.contact,
        stage:   row.stage as LeadStage,
        when:    'agora',
      }, ...s.leads],
    }))
  },

  updateStage: async (id, stage) => {
    set(s => ({ leads: s.leads.map(l => l.id === id ? { ...l, stage } : l) }))
    await supabase.from('leads').update({ stage }).eq('id', id)
  },
}))
