import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'
const CIRC = 2 * Math.PI * 70
const STORAGE_KEY = 'kinea_exec_progress'
const WEIGHT_STEP = 2.5

interface ExerciseData {
  name:        string
  muscle:      string
  sets:        number
  defaultReps: number
  restSec:     number
}

interface SetResult { reps: number; weight: number }

interface SavedProgress {
  workoutId: number
  exIdx:     number
  setsDone:  SetResult[]
  reps:      number
  weight:    number
}

function parseReps(reps: string): number { return parseInt(reps) || 12 }

function fmtWeight(w: number): string {
  return w === Math.floor(w) ? `${w}` : w.toFixed(1).replace('.', ',')
}

function loadSaved(workoutId: number, totalExs: number): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s: SavedProgress = JSON.parse(raw)
    if (s.workoutId !== workoutId || s.exIdx >= totalExs) return null
    return s
  } catch { return null }
}

function saveProg(p: SavedProgress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch {}
}

function clearProg() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export default function Execucao() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuthStore()

  const state = location.state as { workoutId?: number; workoutName?: string } | null

  const workoutIdRef  = useRef<number | null>(null)
  const studentIdRef  = useRef<number | null>(null)

  const [exercises,    setExercises]    = useState<ExerciseData[]>([])
  const [workoutName,  setWorkoutName]  = useState(state?.workoutName ?? '')
  const [loading,      setLoading]      = useState(true)
  const [resumed,      setResumed]      = useState(false)
  const [lastWeights,  setLastWeights]  = useState<Record<string, number>>({})

  const [exIdx,        setExIdx]        = useState(0)
  const [setsDone,     setSetsDone]     = useState<SetResult[]>([])
  const [reps,         setReps]         = useState(12)
  const [weight,       setWeight]       = useState(0)
  const [timerSec,     setTimerSec]     = useState(60)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => { if (user?.id) void loadExercises() }, [user?.id])

  async function loadExercises() {
    setLoading(true)
    let workoutId = state?.workoutId

    // Busca o student_id numérico
    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (studentRow) studentIdRef.current = (studentRow as any).id

    if (!workoutId && studentIdRef.current) {
      const { data: asgn } = await supabase
        .from('workout_assignments')
        .select('workout_id, workouts ( name )')
        .eq('student_id', studentIdRef.current)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single()
      if (asgn) {
        workoutId = (asgn as any).workout_id
        if (!state?.workoutName) setWorkoutName((asgn as any).workouts?.name ?? '')
      }
    }

    if (!workoutId) { setLoading(false); return }
    workoutIdRef.current = workoutId

    const { data: exRows } = await supabase
      .from('exercises')
      .select('name, muscle_group, sets, reps, rest_sec')
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true })

    if (!exRows || exRows.length === 0) { setLoading(false); return }

    const mapped: ExerciseData[] = (exRows as any[]).map(e => ({
      name:        e.name,
      muscle:      e.muscle_group || '—',
      sets:        e.sets,
      defaultReps: parseReps(e.reps),
      restSec:     e.rest_sec ?? 60,
    }))
    setExercises(mapped)

    // Carrega últimas cargas para esses exercícios
    if (studentIdRef.current) {
      const names = mapped.map(e => e.name)
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('exercise_name, weight_kg')
        .eq('student_id', studentIdRef.current)
        .in('exercise_name', names)
        .order('logged_at', { ascending: false })
      const lw: Record<string, number> = {}
      for (const log of (logs ?? []) as any[]) {
        if (!(log.exercise_name in lw)) lw[log.exercise_name] = Number(log.weight_kg)
      }
      setLastWeights(lw)

      // Restaura progresso salvo ou define defaults do primeiro exercício
      const saved = loadSaved(workoutId, mapped.length)
      if (saved) {
        setExIdx(saved.exIdx)
        setSetsDone(saved.setsDone)
        setReps(saved.reps)
        setWeight(saved.weight)
        setTimerSec(mapped[saved.exIdx].restSec)
        setResumed(true)
        setTimeout(() => setResumed(false), 2500)
      } else {
        setReps(mapped[0].defaultReps)
        setWeight(lw[mapped[0].name] ?? 0)
        setTimerSec(mapped[0].restSec)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => {
      setTimerSec(s => {
        const max = exercises[exIdx]?.restSec ?? 60
        if (s <= 1) { setTimerRunning(false); return max }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning, exIdx, exercises])

  async function saveLog(exerciseName: string, completedReps: number, completedWeight: number) {
    if (!studentIdRef.current) return
    await supabase.from('exercise_logs').insert({
      student_id:    studentIdRef.current,
      workout_id:    workoutIdRef.current,
      exercise_name: exerciseName,
      weight_kg:     completedWeight,
      reps:          completedReps,
    })
    setLastWeights(prev => ({ ...prev, [exerciseName]: completedWeight }))
  }

  function handleSerieConc() {
    const wid  = workoutIdRef.current
    const next: SetResult[] = [...setsDone, { reps, weight }]
    void saveLog(ex.name, reps, weight)

    if (next.length >= ex.sets) {
      if (exIdx < totalExs - 1) {
        const nextIdx = exIdx + 1
        const nextEx  = exercises[nextIdx]
        const nextW   = lastWeights[nextEx.name] ?? 0
        setExIdx(nextIdx)
        setSetsDone([])
        setReps(nextEx.defaultReps)
        setWeight(nextW)
        setTimerSec(nextEx.restSec)
        if (wid) saveProg({ workoutId: wid, exIdx: nextIdx, setsDone: [], reps: nextEx.defaultReps, weight: nextW })
      } else {
        clearProg()
        navigate('/aluno/treinos')
        return
      }
    } else {
      setSetsDone(next)
      if (wid) saveProg({ workoutId: wid, exIdx, setsDone: next, reps, weight })
    }
    setTimerSec(ex.restSec)
    setTimerRunning(true)
  }

  if (loading) {
    return (
      <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ font: `500 14px ${FF}`, color: '#8B97AD' }}>Carregando treino…</div>
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ font: `700 16px ${FF}`, color: '#FAEEDA', textAlign: 'center' }}>Nenhum exercício encontrado neste treino.</div>
        <button onClick={() => navigate('/aluno/treinos')} style={{ height: 42, padding: '0 20px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}>
          Voltar
        </button>
      </div>
    )
  }

  const ex         = exercises[exIdx]
  const totalExs   = exercises.length
  const currentSet = setsDone.length
  const timerMax   = ex.restSec
  const totalSets  = exercises.reduce((a, e) => a + e.sets, 0)
  const doneSets   = exercises.slice(0, exIdx).reduce((a, e) => a + e.sets, 0) + setsDone.length
  const progress   = totalSets > 0 ? doneSets / totalSets : 0
  const timerOffset = (1 - timerSec / timerMax) * CIRC
  const isLast     = currentSet >= ex.sets - 1 && exIdx >= totalExs - 1
  const prevWeight = lastWeights[ex.name]

  return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/aluno/treinos')} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color="#FAEEDA" strokeWidth={2} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `600 12px ${FF}`, color: '#8B97AD' }}>{workoutName || 'Treino'}</div>
          <div style={{ font: `500 11px ${FF}`, color: '#E8542A', marginTop: 2 }}>Exercício {exIdx + 1} de {totalExs}</div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Progress bar */}
      <div style={{ margin: '0 18px 20px', background: 'rgba(255,255,255,.1)', height: 4, borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#E8542A', borderRadius: 4, transition: 'width 400ms ease' }} />
      </div>

      {/* Resume toast */}
      {resumed && (
        <div style={{ margin: '-12px 18px 14px', background: 'rgba(76,175,138,.15)', border: '1px solid rgba(76,175,138,.3)', borderRadius: 10, padding: '8px 14px', font: `600 12px ${FF}`, color: '#4CAF8A', textAlign: 'center' }}>
          Treino retomado do ponto onde você parou
        </div>
      )}

      {/* Exercise name */}
      <div style={{ padding: '0 22px 16px' }}>
        <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>
          {ex.muscle.toUpperCase()}
        </div>
        <div style={{ font: `900 28px ${FF}`, color: '#FAEEDA', letterSpacing: '-.7px', marginBottom: 8 }}>
          {ex.name}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: 'rgba(232,84,42,.2)', borderRadius: 20, padding: '5px 12px', font: `600 11px ${FF}`, color: '#E8542A' }}>
            {ex.sets} séries × {ex.defaultReps} reps
          </span>
          {prevWeight !== undefined && (
            <span style={{ background: 'rgba(255,255,255,.08)', borderRadius: 20, padding: '5px 12px', font: `600 11px ${FF}`, color: '#8B97AD' }}>
              Última: {fmtWeight(prevWeight)} kg
            </span>
          )}
        </div>
      </div>

      {/* Timer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={160} height={160} viewBox="0 0 160 160" onClick={() => setTimerRunning(r => !r)} style={{ cursor: 'pointer' }}>
          <circle cx={80} cy={80} r={70} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
          <circle cx={80} cy={80} r={70} fill="none" stroke="#E8542A" strokeWidth={8}
            strokeDasharray={CIRC} strokeDashoffset={timerOffset} strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ transition: timerRunning ? 'stroke-dashoffset .9s linear' : 'none' }}
          />
          <text x={80} y={72} textAnchor="middle" fill="#FAEEDA" style={{ font: `900 42px ${FF}` }}>
            {String(timerSec).padStart(2, '0')}
          </text>
          <text x={80} y={100} textAnchor="middle" fill="#8B97AD" style={{ font: `500 12px ${FF}` }}>
            {timerRunning ? 'descanso' : 'toque para iniciar'}
          </text>
        </svg>
      </div>

      {/* Sets block */}
      <div style={{ margin: '0 18px', background: 'rgba(255,255,255,.06)', borderRadius: 18, padding: 18, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: ex.sets }).map((_, i) => {

            // Série concluída
            if (i < setsDone.length) return (
              <div key={i} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: '#4CAF8A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={13} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ font: `600 13px ${FF}`, color: '#8B97AD', flex: 1 }}>Série {i + 1}</span>
                <span style={{ font: `700 12px ${FF}`, color: '#4CAF8A' }}>
                  {setsDone[i].reps} reps
                  {setsDone[i].weight > 0 && ` · ${fmtWeight(setsDone[i].weight)} kg`}
                </span>
              </div>
            )

            // Série atual — com controles de reps e carga
            if (i === setsDone.length) return (
              <div key={i} style={{ background: 'rgba(232,84,42,.12)', border: '1.5px solid rgba(232,84,42,.3)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 22, height: 22, background: 'rgba(232,84,42,.2)', border: '1.5px solid #E8542A', borderRadius: 6, flexShrink: 0 }} />
                  <span style={{ font: `700 13px ${FF}`, color: '#FAEEDA' }}>Série {i + 1} — atual</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {/* Reps */}
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Repetições</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button onClick={() => setReps(r => Math.max(1, r - 1))} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ font: `800 20px ${FF}`, color: '#FAEEDA' }}>{reps}</span>
                      <button onClick={() => setReps(r => r + 1)} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  {/* Carga */}
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Carga (kg)</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button onClick={() => setWeight(w => Math.max(0, +(w - WEIGHT_STEP).toFixed(1)))} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ font: `800 20px ${FF}`, color: '#FAEEDA' }}>{fmtWeight(weight)}</span>
                      <button onClick={() => setWeight(w => +(w + WEIGHT_STEP).toFixed(1))} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            )

            // Série futura
            return (
              <div key={i} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, flexShrink: 0 }} />
                <span style={{ font: `600 13px ${FF}`, color: 'rgba(139,151,173,.5)' }}>Série {i + 1}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 18px 32px' }}>
        <button
          onClick={handleSerieConc}
          style={{ width: '100%', padding: 16, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 16px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}
        >
          {isLast ? 'Concluir Treino' : 'Série concluída'}
        </button>
      </div>

    </div>
  )
}
