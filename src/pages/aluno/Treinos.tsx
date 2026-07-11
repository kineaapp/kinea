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

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface ExRow {
  id: number; name: string; muscle_group: string
  sets: number; reps: string; rest_sec: number; sort_order: number
}

interface WorkoutDetail {
  id: number; name: string; goal: string; muscle_group: string
  duration_min: number; exercises: ExRow[]
}

interface ProgramSlot {
  id: number; position: number; day_of_week: number | null
  workouts: WorkoutDetail | null
}

interface ActiveProgram { name: string; days_per_week: number; slots: ProgramSlot[] }

// fallback: old workout_assignments
interface Assignment { id: number; day_of_week: number | null; workout: WorkoutDetail }

interface SessionRow {
  id: number; completed_at: string; intensity: number | null; pain: number | null
  notes: string | null; workouts: { name: string } | null
}

const INTENSITY_LABEL: Record<number, { emoji: string; label: string; color: string; bg: string }> = {
  1: { emoji: '😴', label: 'Muito fácil', color: '#1B7a4a', bg: '#e7f3ea' },
  2: { emoji: '🙂', label: 'Fácil',       color: '#1B7a4a', bg: '#e7f3ea' },
  3: { emoji: '💪', label: 'Moderado',    color: '#b06a12', bg: '#f7ecd9' },
  4: { emoji: '🔥', label: 'Difícil',     color: '#c4421e', bg: '#fbe6e1' },
  5: { emoji: '😤', label: 'Exaustivo',   color: '#c4421e', bg: '#fbe6e1' },
}

const PAIN_LABEL: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Sem dor',      color: '#1B7a4a', bg: '#e7f3ea' },
  1: { label: 'Dor leve',     color: '#b06a12', bg: '#f7ecd9' },
  2: { label: 'Dor moderada', color: '#c4421e', bg: '#fbe6e1' },
  3: { label: 'Dor intensa',  color: '#c4421e', bg: '#fbe6e1' },
}

function slotLabel(pos: number) { return String.fromCharCode(64 + pos) }

export default function Treinos() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()
  const [tab,          setTab]          = useState<'treinos' | 'historico'>('treinos')
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null)
  const [assignments,   setAssignments]   = useState<Assignment[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expandedKey,   setExpandedKey]   = useState<string | null>(null)
  const [sessions,      setSessions]      = useState<SessionRow[]>([])
  const [sessLoading,   setSessLoading]   = useState(false)
  const [numericId,     setNumericId]     = useState<number | null>(null)

  useEffect(() => { if (user?.id) void load() }, [user?.id])

  useEffect(() => {
    if (tab === 'historico' && numericId && sessions.length === 0 && !sessLoading) void loadSessions()
  }, [tab, numericId])

  async function loadSessions() {
    if (!numericId) return
    setSessLoading(true)
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, completed_at, intensity, pain, notes, workouts(name)')
      .eq('student_id', numericId)
      .order('completed_at', { ascending: false })
      .limit(50)
    setSessions((data as SessionRow[] | null) ?? [])
    setSessLoading(false)
  }

  async function load() {
    setLoading(true)
    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (!studentRow) { setLoading(false); return }
    const sid = (studentRow as { id: number }).id
    setNumericId(sid)

    // Try active program first
    const { data: paData } = await supabase
      .from('program_assignments')
      .select(`
        programs(
          name, days_per_week,
          program_slots(
            id, position, day_of_week,
            workouts( id, name, goal, muscle_group, duration_min,
              exercises( id, name, muscle_group, sets, reps, rest_sec, sort_order )
            )
          )
        )
      `)
      .eq('student_id', sid)
      .eq('active', true)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paData?.programs) {
      const prog = paData.programs as unknown as {
        name: string; days_per_week: number
        program_slots: (Omit<ProgramSlot, 'workouts'> & { workouts: (WorkoutDetail & { exercises: ExRow[] }) | null })[]
      }
      const slots: ProgramSlot[] = [...(prog.program_slots ?? [])].map(sl => ({
        ...sl,
        workouts: sl.workouts
          ? { ...sl.workouts, exercises: [...(sl.workouts.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order) }
          : null,
      })).sort((a, b) => a.position - b.position)
      setActiveProgram({ name: prog.name, days_per_week: prog.days_per_week, slots })
      setLoading(false)
      return
    }

    // Fallback to old workout_assignments
    const { data } = await supabase
      .from('workout_assignments')
      .select(`id, day_of_week, workouts(id, name, goal, muscle_group, duration_min, exercises(id, name, muscle_group, sets, reps, rest_sec, sort_order))`)
      .eq('student_id', sid)
      .order('assigned_at', { ascending: false })
    if (data) {
      setAssignments(
        (data as any[]).map(a => ({
          id: a.id, day_of_week: a.day_of_week,
          workout: { ...a.workouts, exercises: [...(a.workouts?.exercises ?? [])].sort((x: ExRow, y: ExRow) => x.sort_order - y.sort_order) },
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

  const hasContent = activeProgram || assignments.length > 0

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '18px 20px 10px' }}>
        <h1 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 14px', letterSpacing: '-.5px' }}>Treinos</h1>
        <div style={{ display: 'flex', gap: 6, background: '#f4efe3', borderRadius: 12, padding: 4 }}>
          {(['treinos', 'historico'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, height: 34, border: 'none', borderRadius: 9, cursor: 'pointer', font: `700 13px ${FF}`, transition: 'all .15s',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#1B2A4A' : '#9a948a',
                boxShadow: tab === t ? '0 1px 4px rgba(27,42,74,.1)' : 'none',
              }}>
              {t === 'treinos' ? 'Meus treinos' : 'Histórico'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 18px' }}>
        {tab === 'historico' && (() => {
          if (sessLoading) return (
            <div style={{ padding: '40px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando histórico…</div>
          )
          if (sessions.length === 0) return (
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #D6CFBE', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', marginTop: 8 }}>
              <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A' }}>Nenhum treino concluído ainda</div>
              <div style={{ font: `400 13px ${FF}`, color: '#9a948a', maxWidth: 240, lineHeight: 1.55 }}>Complete um treino para ver seu histórico aqui.</div>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {sessions.map(s => {
                const intensity = s.intensity != null ? INTENSITY_LABEL[s.intensity] : null
                const pain      = s.pain      != null ? PAIN_LABEL[s.pain]           : null
                return (
                  <div key={s.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #ece7d9', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{s.workouts?.name ?? 'Treino'}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                          {new Date(s.completed_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {intensity && (
                        <span style={{ flexShrink: 0, font: `600 11px ${FF}`, color: intensity.color, background: intensity.bg, borderRadius: 20, padding: '4px 10px' }}>
                          {intensity.emoji} {intensity.label}
                        </span>
                      )}
                    </div>
                    {(pain || s.notes) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {pain && pain.label !== 'Sem dor' && (
                          <span style={{ font: `600 11px ${FF}`, color: pain.color, background: pain.bg, borderRadius: 20, padding: '3px 10px' }}>{pain.label}</span>
                        )}
                        {s.notes && (
                          <span style={{ font: `400 12px ${FF}`, color: '#4a4742', background: '#f4efe3', borderRadius: 8, padding: '3px 10px', flex: 1 }}>{s.notes}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {tab === 'treinos' && (!hasContent ? (
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
        ) : activeProgram ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Program banner */}
            <div style={{ background: '#1B2A4A', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ font: `700 15px ${FF}`, color: '#FAEEDA', letterSpacing: '-.3px' }}>{activeProgram.name}</div>
                <div style={{ font: `400 11.5px ${FF}`, color: '#8B97AD', marginTop: 3 }}>
                  {activeProgram.days_per_week} treinos por semana · {activeProgram.slots.length} blocos
                </div>
              </div>
              <span style={{ font: `700 10px ${FF}`, color: '#1B7a4a', background: 'rgba(27,122,74,.18)', border: '1px solid rgba(27,122,74,.3)', borderRadius: 20, padding: '4px 10px', flexShrink: 0 }}>Ativo</span>
            </div>

            {/* Slot cards */}
            {activeProgram.slots.map(sl => {
              const key = `slot-${sl.id}`
              const open = expandedKey === key
              const w = sl.workouts
              const g = w ? (GOAL_STYLE[w.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }) : { color: '#9a948a', bg: '#f4efe3' }

              return (
                <div key={sl.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ece7d9', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 16px 14px' }}>
                    {/* Slot label + day */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ font: `800 13px ${FF}`, color: '#fff', background: '#E8542A', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {slotLabel(sl.position)}
                      </span>
                      <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>Treino {slotLabel(sl.position)}</span>
                      {sl.day_of_week != null && (
                        <span style={{ marginLeft: 'auto', font: `600 11px ${FF}`, color: '#6b5c3e', background: '#f1ece0', borderRadius: 7, padding: '3px 9px' }}>
                          {DAY_NAMES[sl.day_of_week]}
                        </span>
                      )}
                    </div>

                    {w ? (
                      <>
                        <div style={{ font: `800 17px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', marginBottom: 3 }}>{w.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '3px 9px' }}>{w.goal}</span>
                          <span style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>{w.muscle_group} · {w.duration_min} min · {w.exercises.length} exercício{w.exercises.length !== 1 ? 's' : ''}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ font: `400 13px ${FF}`, color: '#9a948a', fontStyle: 'italic' }}>Treino não definido pelo coach ainda</div>
                    )}
                  </div>

                  {w && (
                    <>
                      <button
                        onClick={() => setExpandedKey(open ? null : key)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 'none', borderTop: '1px solid #f4efe3', background: '#faf7f3', cursor: 'pointer', font: `600 12px ${FF}`, color: '#7c7869' }}
                      >
                        <span>{open ? 'Ocultar exercícios' : 'Ver exercícios'}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>

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

                      <div style={{ padding: `${open ? '12px' : '0'} 16px 16px`, borderTop: open ? '1px solid #f4efe3' : 'none' }}>
                        <button
                          onClick={() => navigate('/aluno/treinos/exec', { state: { workoutId: w.id, workoutName: w.name } })}
                          style={{ width: '100%', height: 44, border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          Iniciar treino
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Fallback: old workout_assignments
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {assignments.map(a => {
              const w = a.workout
              const key = `assign-${a.id}`
              const open = expandedKey === key
              const g = GOAL_STYLE[w.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
              return (
                <div key={a.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ece7d9', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '4px 10px' }}>{w.goal}</span>
                      <span style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{w.duration_min} min</span>
                    </div>
                    <div style={{ font: `800 17px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', marginBottom: 3 }}>{w.name}</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>
                      {w.muscle_group} · {w.exercises.length} exercício{w.exercises.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedKey(open ? null : key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 'none', borderTop: '1px solid #f4efe3', background: '#faf7f3', cursor: 'pointer', font: `600 12px ${FF}`, color: '#7c7869' }}
                  >
                    <span>{open ? 'Ocultar exercícios' : 'Ver exercícios'}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
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
                  <div style={{ padding: `${open ? '12px' : '0'} 16px 16px`, borderTop: open ? '1px solid #f4efe3' : 'none' }}>
                    <button
                      onClick={() => navigate('/aluno/treinos/exec', { state: { workoutId: w.id, workoutName: w.name } })}
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
        ))}
      </div>
    </div>
  )
}
