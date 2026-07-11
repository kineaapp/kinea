export type SemColor  = 'green' | 'yellow' | 'red'
export type PayStatus = 'active' | 'pending' | 'overdue'

export type AssessmentFrequency = 'weekly' | 'biweekly' | 'monthly' | null

export interface Student {
  id:                  number
  studentUuid:         string
  name:                string
  goal:                string
  plan:                string
  pay:                 PayStatus
  sem:                 SemColor
  next:                string
  email:               string
  since:               string
  sinceRaw:            string
  cpf:                 string | null
  phone:               string | null
  blocked:             boolean
  assessmentFrequency: AssessmentFrequency
}

export const ROSTER: Student[] = []

export const AVATAR_PALETTE: [string, string][] = [
  ['#eef1f6','#1B2A4A'], ['#fbe6e1','#c4421e'], ['#e7f3ea','#1B7a4a'],
  ['#f7ecd9','#b06a12'], ['#ece9f6','#5a4ea0'],
]

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function payInfo(p: PayStatus) {
  if (p === 'active')  return { label: 'Em dia',   color: '#1B7a4a', bg: '#e7f3ea' }
  if (p === 'pending') return { label: 'Pendente', color: '#b06a12', bg: '#f7ecd9' }
  return                      { label: 'Vencido',  color: '#D2402A', bg: '#fbe6e1' }
}

export function semInfo(s: SemColor) {
  if (s === 'green')  return { color: '#2b9d5f', label: 'Engajado'  }
  if (s === 'yellow') return { color: '#E0A93B', label: 'Em alerta' }
  return                     { color: '#E0533B', label: 'Inativo'   }
}

export function avatarPalette(idx: number): [string, string] {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length]
}
