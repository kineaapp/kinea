export type SemColor  = 'green' | 'yellow' | 'red'
export type PayStatus = 'active' | 'pending' | 'overdue'

export interface Student {
  id:    number
  name:  string
  goal:  string
  plan:  string
  pay:   PayStatus
  sem:   SemColor
  next:  string
  email: string
  since: string
}

export const ROSTER: Student[] = [
  { id:0,  name:'June Mazotini',   goal:'Hipertrofia',       plan:'Mensal',     pay:'active',  sem:'green',  next:'27 jun', email:'june.m@email.com',    since:'mar/2025' },
  { id:1,  name:'Carlos Henrique', goal:'Emagrecimento',     plan:'Trimestral', pay:'overdue', sem:'red',    next:'—',      email:'carlos.h@email.com',  since:'jan/2025' },
  { id:2,  name:'Aline Souza',     goal:'Recomposição',      plan:'Semestral',  pay:'active',  sem:'green',  next:'01 jul', email:'aline.s@email.com',   since:'out/2024' },
  { id:3,  name:'Diego Farias',    goal:'Hipertrofia',       plan:'Mensal',     pay:'pending', sem:'yellow', next:'04 jul', email:'diego.f@email.com',   since:'abr/2025' },
  { id:4,  name:'Bruno Tavares',   goal:'Força',             plan:'Mensal',     pay:'active',  sem:'green',  next:'29 jun', email:'bruno.t@email.com',   since:'fev/2025' },
  { id:5,  name:'Patrícia Lemos',  goal:'Condicionamento',   plan:'Permuta',    pay:'active',  sem:'yellow', next:'08 jul', email:'patricia.l@email.com',since:'nov/2024' },
  { id:6,  name:'Marina Klein',    goal:'Emagrecimento',     plan:'Trimestral', pay:'overdue', sem:'red',    next:'—',      email:'marina.k@email.com',  since:'dez/2024' },
  { id:7,  name:'Lucas Prado',     goal:'Anamnese pendente', plan:'—',          pay:'pending', sem:'yellow', next:'—',      email:'lucas.p@email.com',   since:'jun/2025' },
  { id:8,  name:'Renata Bastos',   goal:'Hipertrofia',       plan:'Semestral',  pay:'active',  sem:'green',  next:'11 jul', email:'renata.b@email.com',  since:'set/2024' },
  { id:9,  name:'Gustavo Lima',    goal:'Força',             plan:'Mensal',     pay:'active',  sem:'green',  next:'02 jul', email:'gustavo.l@email.com', since:'jan/2025' },
  { id:10, name:'Fernanda Rocha',  goal:'Emagrecimento',     plan:'Trimestral', pay:'pending', sem:'yellow', next:'05 jul', email:'fernanda.r@email.com',since:'mar/2025' },
  { id:11, name:'Thiago Moraes',   goal:'Recomposição',      plan:'Mensal',     pay:'active',  sem:'green',  next:'14 jul', email:'thiago.m@email.com',  since:'fev/2025' },
  { id:12, name:'Camila Duarte',   goal:'Condicionamento',   plan:'Mensal',     pay:'active',  sem:'red',    next:'—',      email:'camila.d@email.com',  since:'mai/2025' },
  { id:13, name:'Rodrigo Pinto',   goal:'Hipertrofia',       plan:'Semestral',  pay:'active',  sem:'green',  next:'18 jul', email:'rodrigo.p@email.com', since:'ago/2024' },
]

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
  if (s === 'green')  return { color: '#2b9d5f', label: 'Engajado', last: 'check-in hoje' }
  if (s === 'yellow') return { color: '#E0A93B', label: 'Em alerta', last: 'há 6 dias'   }
  return                     { color: '#E0533B', label: 'Inativo',   last: 'há 11 dias'  }
}

export function avatarPalette(idx: number): [string, string] {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length]
}
