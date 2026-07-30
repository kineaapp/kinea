import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useStudentsStore } from '../../store/students'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

interface SessionRow {
  id:           number
  student_id:   number
  workout_id:   number
  intensity:    number
  pain:         number
  notes:        string | null
  completed_at: string
}

function getInitials(name: string) {
  const p = name.trim().split(' ')
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#E8542A','#1B7a4a','#5a4ea0','#b06a12','#1B2A4A','#2a7ab0','#c4421e']

const INTENSITY = [
  { v: 1, emoji: '😴', label: 'Muito fácil', color: '#2a7ab0', bg: '#e8f2fb' },
  { v: 2, emoji: '🙂', label: 'Fácil',       color: '#1B7a4a', bg: '#e7f3ea' },
  { v: 3, emoji: '💪', label: 'Moderado',    color: '#b06a12', bg: '#f7ecd9' },
  { v: 4, emoji: '🔥', label: 'Difícil',     color: '#c4421e', bg: '#fbe6e1' },
  { v: 5, emoji: '😤', label: 'Exaustivo',   color: '#7c1e8c', bg: '#f3e8fb' },
]

const PAIN = [
  { v: 0, label: 'Sem dor',  color: '#1B7a4a', bg: '#e7f3ea' },
  { v: 1, label: 'Leve',     color: '#b06a12', bg: '#f7ecd9' },
  { v: 2, label: 'Moderada', color: '#c4421e', bg: '#fbe6e1' },
  { v: 3, label: 'Intensa',  color: '#7c0000', bg: '#ffd6d6' },
]

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const yestStr  = new Date(Date.now() - 86_400_000).toDateString()
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === todayStr)  return `Hoje, ${time}`
  if (d.toDateString() === yestStr)   return `Ontem, ${time}`
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) + ', ' + time
}

type Period = '7' | '30' | 'all'

export default function CheckinsCoach() {
  const { t }                              = useTranslation()
  const { user }                           = useAuthStore()
  const { students, fetchStudents }        = useStudentsStore()
  const navigate                           = useNavigate()

  const [sessions,      setSessions]      = useState<SessionRow[]>([])
  const [workoutNames,  setWorkoutNames]  = useState<Record<number, string>>({})
  const [loading,       setLoading]       = useState(true)
  const [filterStudent, setFilterStudent] = useState<number | ''>('')
  const [filterPeriod,  setFilterPeriod]  = useState<Period>('30')

  useEffect(() => {
    if (user?.id && students.length === 0) fetchStudents(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || students.length === 0) { setLoading(false); return }

    const ids = students.map(s => s.id)
    if (ids.length === 0) { setSessions([]); setLoading(false); return }

    const cutoff = filterPeriod === '7'
      ? new Date(Date.now() -  7 * 86_400_000).toISOString()
      : filterPeriod === '30'
      ? new Date(Date.now() - 30 * 86_400_000).toISOString()
      : null

    void (async () => {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('workout_sessions')
        .select('id,student_id,workout_id,intensity,pain,notes,completed_at')
        .in('student_id', filterStudent ? [filterStudent] : ids)
        .order('completed_at', { ascending: false })
        .limit(300)

      if (cutoff) q = q.gte('completed_at', cutoff)

      const { data } = await q
      const rows = (data as SessionRow[] | null) ?? []
      setSessions(rows)

      const wids = [...new Set(rows.map(r => r.workout_id))]
      if (wids.length > 0) {
        const { data: wData } = await supabase
          .from('workouts')
          .select('id,name')
          .in('id', wids)
        const map: Record<number, string> = {}
        for (const w of (wData ?? []) as { id: number; name: string }[]) map[w.id] = w.name
        setWorkoutNames(map)
      } else {
        setWorkoutNames({})
      }

      setLoading(false)
    })()
  }, [students.length, filterPeriod, filterStudent])

  const studentMap  = new Map(students.map(s => [s.id, s]))
  const uniqueAlunos = new Set(sessions.map(s => s.student_id)).size

  const PERIOD_OPTS: { value: Period; label: string }[] = [
    { value: '7',   label: '7 dias'   },
    { value: '30',  label: '30 dias'  },
    { value: 'all', label: 'Todos'    },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ font: `800 28px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>
            Check-ins de treino
          </h1>
          {!loading && (
            <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
              {sessions.length === 1 ? '1 check-in' : `${sessions.length} check-ins`}
              {filterStudent === '' && uniqueAlunos > 0 && ` · ${uniqueAlunos} ${uniqueAlunos === 1 ? 'aluno' : 'alunos'}`}
            </p>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f4efe3', borderRadius: 10, padding: 3, gap: 2 }}>
            {PERIOD_OPTS.map(opt => {
              const active = filterPeriod === opt.value
              return (
                <button key={opt.value} type="button" onClick={() => setFilterPeriod(opt.value)}
                  style={{ height: 34, padding: '0 12px', border: 'none', borderRadius: 8, font: `600 12px ${FF}`, cursor: 'pointer', background: active ? '#1B2A4A' : 'transparent', color: active ? '#fff' : '#7c7869', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              )
            })}
          </div>

          <select
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value ? parseInt(e.target.value) : '')}
            style={{ height: 40, border: '1.5px solid #d6cfbe', borderRadius: 10, background: '#fff', padding: '0 12px', font: `500 13px ${FF}`, color: '#1B2A4A', outline: 'none', cursor: 'pointer' }}
          >
            <option value=''>Todos os alunos</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <span style={{ width: 28, height: 28, border: '3px solid #EDE8DC', borderTopColor: '#E8542A', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
        </div>

      ) : sessions.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
          <div style={{ font: `700 16px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>Nenhum check-in encontrado</div>
          <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>
            {filterPeriod !== 'all'
              ? 'Tente ampliar o período ou selecionar "Todos".'
              : 'Os check-ins de treino aparecerão aqui após os alunos completarem um treino.'}
          </div>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => {
            const student = studentMap.get(s.student_id)
            if (!student) return null
            const initials    = getInitials(student.name)
            const avatarColor = AVATAR_COLORS[s.student_id % AVATAR_COLORS.length]
            const intensity   = INTENSITY.find(i => i.v === s.intensity) ?? INTENSITY[2]
            const pain        = PAIN.find(p => p.v === s.pain)        ?? PAIN[0]
            const wName       = workoutNames[s.workout_id] ?? t('coach_checkins.unknown_workout')

            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>

                {/* Top row: avatar + name + date + link */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 13px ${FF}`, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.name}
                      </div>
                      <div style={{ font: `400 11px ${FF}`, color: '#9a948a', marginTop: 1 }}>
                        {fmtDate(s.completed_at)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/coach/alunos/${s.student_id}`, { state: { tab: 'treino' } })}
                    style={{ height: 32, padding: '0 12px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Ver perfil
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                </div>

                {/* Workout name */}
                <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18"/>
                  </svg>
                  {wName}
                </div>

                {/* Intensity + Pain badges */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: intensity.bg, borderRadius: 20, padding: '5px 10px 5px 8px' }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{intensity.emoji}</span>
                    <span style={{ font: `600 11px ${FF}`, color: intensity.color }}>{intensity.label}</span>
                  </div>
                  {s.pain > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: pain.bg, borderRadius: 20, padding: '5px 10px' }}>
                      <span style={{ font: `600 11px ${FF}`, color: pain.color }}>Dor {pain.label.toLowerCase()}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {s.notes && (
                  <div style={{ background: '#faf7ee', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #E8542A', font: `400 12px ${FF}`, color: '#1B2A4A', lineHeight: 1.55, marginTop: 10 }}>
                    {s.notes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
