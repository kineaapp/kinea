import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

const GOAL_STYLE: Record<string, { color: string; bg: string }> = {
  Hipertrofia:     { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:   { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:           { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento: { color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:      { color: '#5a4ea0', bg: '#ece9f6' },
}

interface ExRow {
  id: number
  name: string
  muscle_group: string
  sets: number
  reps: string
  rest_sec: number
  sort_order: number
}

interface WorkoutRow {
  id: number
  name: string
  goal: string
  muscle_group: string
  duration_min: number
  exercises: ExRow[]
}

interface Assignment {
  id: number
  day_of_week: number | null
  workout: WorkoutRow
}

export default function Treinos() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expandedId,  setExpandedId]  = useState<number | null>(null)

  useEffect(() => { if (user?.id) void load() }, [user?.id])

  async function load() {
    setLoading(true)
    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', user!.id)
      .single()

    if (!studentRow) { setLoading(false); return }

    const { data } = await supabase
      .from('workout_assignments')
      .select(`
        id,
        day_of_week,
        workouts (
          id, name, goal, muscle_group, duration_min,
          exercises ( id, name, muscle_group, sets, reps, rest_sec, sort_order )
        )
      `)
      .eq('student_id', (studentRow as any).id)
      .order('assigned_at', { ascending: false })

    if (data) {
      setAssignments(
        (data as any[]).map(a => ({
          id:          a.id,
          day_of_week: a.day_of_week,
          workout: {
            ...a.workouts,
            exercises: [...(a.workouts?.exercises ?? [])].sort(
              (x: ExRow, y: ExRow) => x.sort_order - y.sort_order
            ),
          },
        }))
      )
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px 24px', textAlign: 'center', font: `400 13px ${FF}`, color: '#9a948a' }}>
        Carregando treinos…
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '18px 20px 16px' }}>
        <h1 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Meus Treinos</h1>
        <p style={{ font: `400 13px ${FF}`, color: '#7C7869', margin: 0 }}>
          {assignments.length > 0
            ? `${assignments.length} treino${assignments.length > 1 ? 's' : ''} atribuído${assignments.length > 1 ? 's' : ''}`
            : 'Programação semanal'}
        </p>
      </div>

      <div style={{ padding: '0 18px' }}>
        {assignments.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #D6CFBE', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
            <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A' }}>Nenhum treino cadastrado ainda</div>
            <div style={{ font: `400 13px ${FF}`, color: '#9a948a', lineHeight: 1.55, maxWidth: 260 }}>
              Seu coach está preparando sua programação. Você será avisado assim que estiver pronta.
            </div>
            <button
              onClick={() => navigate('/aluno/chat')}
              style={{ marginTop: 4, height: 40, padding: '0 20px', border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}
            >
              Falar com o coach
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {assignments.map(a => {
              const w = a.workout
              const g = GOAL_STYLE[w.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
              const open = expandedId === a.id
              return (
                <div key={a.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ece7d9', overflow: 'hidden' }}>

                  {/* Card header */}
                  <div style={{ padding: '16px 16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '4px 10px' }}>
                        {w.goal}
                      </span>
                      <span style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{w.duration_min} min</span>
                    </div>
                    <div style={{ font: `800 17px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', marginBottom: 3 }}>{w.name}</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>
                      {w.muscle_group} · {w.exercises.length} exercício{w.exercises.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Toggle exercise list */}
                  <button
                    onClick={() => setExpandedId(open ? null : a.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 'none', borderTop: '1px solid #f4efe3', background: '#faf7f3', cursor: 'pointer', font: `600 12px ${FF}`, color: '#7c7869' }}
                  >
                    <span>{open ? 'Ocultar exercícios' : 'Ver exercícios'}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>

                  {/* Exercise list */}
                  {open && (
                    <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {w.exercises.map((ex, i) => (
                        <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f9f6ef', borderRadius: 10, border: '1px solid #ece7d9' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: g.bg, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 10px ${FF}`, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                            <div style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>{ex.muscle_group || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ font: `800 13px ${FF}`, color: '#1B2A4A' }}>{ex.sets} × {ex.reps}</div>
                            <div style={{ font: `400 10px ${FF}`, color: '#b0a99c' }}>desc. {ex.rest_sec}s</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action */}
                  <div style={{ padding: `${open ? '12px' : '0'} 16px 16px`, borderTop: open ? '1px solid #f4efe3' : 'none' }}>
                    <button
                      onClick={() => navigate('/aluno/treinos/exec')}
                      style={{ width: '100%', height: 44, border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Iniciar treino
                    </button>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
