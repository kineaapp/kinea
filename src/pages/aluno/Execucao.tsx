import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'
const CIRC = 2 * Math.PI * 70
const STORAGE_KEY = 'kinea_exec_progress'

interface ExerciseData {
  name:           string
  muscle:         string
  sets:           number
  defaultReps:    number
  restSec:        number
  superset_group: number | null
}

interface SetResult     { reps: number; weight: number; logId?: number }
interface CompletedSet  { exerciseName: string; reps: number; weight: number }

interface SavedProgress {
  workoutId:    number
  exIdx:        number
  setsDone:     SetResult[]
  reps:         number
  weight:       number
  allCompleted: CompletedSet[]
  startedAt:    number
}

type Phase = 'loading' | 'already_done' | 'workout' | 'feedback' | 'summary'

function parseReps(reps: string): number { return parseInt(reps) || 12 }

function fmtWeight(w: number): string {
  return w === Math.floor(w) ? `${w}` : w.toFixed(1).replace('.', ',')
}

function fmtDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m} min`
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxW: number, lineH: number,
) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); line = word; y += lineH
    } else { line = test }
  }
  if (line) ctx.fillText(line, x, y)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y);     ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h);     ctx.arcTo(x, y + h,     x, y + h - r,     r)
  ctx.lineTo(x, y + r);         ctx.arcTo(x, y,         x + r, y,         r)
  ctx.closePath()
}

export default function Execucao() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuthStore()
  const state = location.state as { workoutId?: number; workoutName?: string } | null

  const workoutIdRef  = useRef<number | null>(null)
  const studentIdRef  = useRef<number | null>(null)
  const startedAtRef  = useRef<number>(0)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const sharingRef    = useRef(false)

  const [phase,               setPhase]               = useState<Phase>('loading')
  const [exercises,           setExercises]           = useState<ExerciseData[]>([])
  const [workoutName,         setWorkoutName]         = useState(state?.workoutName ?? '')
  const [resumed,             setResumed]             = useState(false)
  const [lastWeights,         setLastWeights]         = useState<Record<string, number>>({})
  const [lastReps,            setLastReps]            = useState<Record<string, number>>({})
  const [allCompleted,        setAllCompleted]        = useState<CompletedSet[]>([])
  const [workoutDurationSec,  setWorkoutDurationSec]  = useState(0)

  const [exIdx,        setExIdx]        = useState(0)
  const [setsDone,     setSetsDone]     = useState<SetResult[]>([])
  const [reps,         setReps]         = useState(12)
  const [weight,       setWeight]       = useState(0)
  const [timerSec,     setTimerSec]     = useState(60)
  const [timerRunning, setTimerRunning] = useState(false)

  // Superset state
  const [isMidSuperset,       setIsMidSuperset]       = useState(false)
  const [supersetAIdx,        setSupersetAIdx]        = useState<number | null>(null)
  const [supersetASetsDone,   setSupersetASetsDone]   = useState<SetResult[]>([])

  // Circuit state
  const [isCircuit,        setIsCircuit]        = useState(false)
  const [totalRounds,      setTotalRounds]      = useState(3)
  const [currentRound,     setCurrentRound]     = useState(1)
  const [circuitExIdx,     setCircuitExIdx]     = useState(0)
  const [roundRestActive,  setRoundRestActive]  = useState(false)
  const [roundRestSec,     setRoundRestSec]     = useState(90)
  const [roundRestRunning, setRoundRestRunning] = useState(false)

  // per-exercise sets history (for navigation)
  const [exerciseSetsDone, setExerciseSetsDone] = useState<Record<number, SetResult[]>>({})

  // upcoming panel
  const [showUpcoming, setShowUpcoming] = useState(false)

  // edit set
  const [editSetIdx,  setEditSetIdx]  = useState<number | null>(null)
  const [editReps,    setEditReps]    = useState(0)
  const [editWeight,  setEditWeight]  = useState(0)

  // feedback
  const [fbIntensity, setFbIntensity] = useState(3)
  const [fbPain,      setFbPain]      = useState(0)
  const [fbNotes,     setFbNotes]     = useState('')
  const [fbSaving,    setFbSaving]    = useState(false)

  // share
  const [shareAskPhoto, setShareAskPhoto] = useState(false)
  const [sharing,       setSharing]       = useState(false)

  useEffect(() => { if (user?.id) void loadExercises() }, [user?.id])

  async function loadExercises() {
    setPhase('loading')
    let workoutId = state?.workoutId

    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (studentRow) studentIdRef.current = (studentRow as any).id

    if (!workoutId && studentIdRef.current) {
      const { data: asgn } = await supabase
        .from('workout_assignments')
        .select('workout_id, workouts ( name )')
        .eq('student_id', studentIdRef.current)
        .order('assigned_at', { ascending: false })
        .limit(1).single()
      if (asgn) {
        workoutId = (asgn as any).workout_id
        if (!state?.workoutName) setWorkoutName((asgn as any).workouts?.name ?? '')
      }
    }

    if (!workoutId) { setPhase('workout'); return }
    workoutIdRef.current = workoutId

    const { data: wMeta } = await supabase
      .from('workouts').select('workout_type, rounds').eq('id', workoutId).single()
    if ((wMeta as any)?.workout_type === 'circuito') {
      setIsCircuit(true)
      setTotalRounds((wMeta as any).rounds ?? 3)
    }

    // Bloqueia se já realizou hoje
    if (studentIdRef.current) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { data: existing } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('student_id', studentIdRef.current)
        .eq('workout_id', workoutId)
        .gte('completed_at', todayStart.toISOString())
        .maybeSingle()
      if (existing) { setPhase('already_done'); return }
    }

    const { data: exRows } = await supabase
      .from('exercises')
      .select('name, muscle_group, sets, reps, rest_sec, superset_group')
      .eq('workout_id', workoutId)
      .order('sort_order', { ascending: true })

    if (!exRows || exRows.length === 0) { setPhase('workout'); return }

    const mapped: ExerciseData[] = (exRows as any[]).map(e => ({
      name:           e.name,
      muscle:         e.muscle_group || '—',
      sets:           e.sets,
      defaultReps:    parseReps(e.reps),
      restSec:        e.rest_sec ?? 60,
      superset_group: e.superset_group ?? null,
    }))
    setExercises(mapped)

    if (studentIdRef.current) {
      const names = mapped.map(e => e.name)
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('exercise_name, weight_kg, reps')
        .eq('student_id', studentIdRef.current)
        .in('exercise_name', names)
        .order('logged_at', { ascending: false })
      const lw: Record<string, number> = {}
      const lr: Record<string, number> = {}
      for (const log of (logs ?? []) as any[]) {
        if (!(log.exercise_name in lw)) lw[log.exercise_name] = Number(log.weight_kg)
        if (!(log.exercise_name in lr) && log.reps != null) lr[log.exercise_name] = Number(log.reps)
      }
      setLastWeights(lw)
      setLastReps(lr)

      const saved = loadSaved(workoutId, mapped.length)
      if (saved) {
        setExIdx(saved.exIdx)
        setSetsDone(saved.setsDone)
        setReps(saved.reps)
        setWeight(saved.weight)
        setAllCompleted(saved.allCompleted ?? [])
        setTimerSec(mapped[saved.exIdx].restSec)
        startedAtRef.current = saved.startedAt || Date.now()
        setResumed(true)
        setTimeout(() => setResumed(false), 2500)
      } else {
        setReps(mapped[0].defaultReps)
        setWeight(lw[mapped[0].name] ?? 0)
        setTimerSec(mapped[0].restSec)
        startedAtRef.current = Date.now()
      }
    }
    setPhase('workout')
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

  useEffect(() => {
    if (!roundRestRunning) return
    const id = setInterval(() => {
      setRoundRestSec(s => { if (s <= 1) { setRoundRestRunning(false); return 0 }; return s - 1 })
    }, 1000)
    return () => clearInterval(id)
  }, [roundRestRunning])

  useEffect(() => {
    if (roundRestSec === 0 && roundRestActive) {
      setRoundRestActive(false)
      setCurrentRound(r => r + 1)
      setCircuitExIdx(0)
      setRoundRestSec(90)
    }
  }, [roundRestSec, roundRestActive])

  async function saveLog(exerciseName: string, completedReps: number, completedWeight: number): Promise<number | null> {
    if (!studentIdRef.current) return null
    const { data } = await supabase.from('exercise_logs').insert({
      student_id:    studentIdRef.current,
      workout_id:    workoutIdRef.current,
      exercise_name: exerciseName,
      weight_kg:     completedWeight,
      reps:          completedReps,
    }).select('id').single()
    setLastWeights(prev => ({ ...prev, [exerciseName]: completedWeight }))
    setLastReps(prev => ({ ...prev, [exerciseName]: completedReps }))
    return (data as any)?.id ?? null
  }

  function openEditSet(i: number) {
    setEditSetIdx(i)
    setEditReps(setsDone[i].reps)
    setEditWeight(setsDone[i].weight)
  }

  async function handleEditSetSave() {
    if (editSetIdx === null) return
    const sr      = setsDone[editSetIdx]
    const updated = setsDone.map((s, i) => i === editSetIdx ? { ...s, reps: editReps, weight: editWeight } : s)
    setSetsDone(updated)

    let count = 0
    const newAll = allCompleted.map(s => {
      if (s.exerciseName === ex.name) {
        if (count === editSetIdx) { count++; return { ...s, reps: editReps, weight: editWeight } }
        count++
      }
      return s
    })
    setAllCompleted(newAll)

    if (sr.logId) {
      await supabase.from('exercise_logs').update({ reps: editReps, weight_kg: editWeight }).eq('id', sr.logId)
    }
    setEditSetIdx(null)
  }

  async function handleSerieConc() {
    const wid   = workoutIdRef.current
    const ex    = exercises[exIdx]
    const logId = await saveLog(ex.name, reps, weight)
    const newSet: SetResult = { reps, weight, logId: logId ?? undefined }
    const newAll: CompletedSet[] = [...allCompleted, { exerciseName: ex.name, reps, weight }]
    setAllCompleted(newAll)

    // ── Superset: finishing the second exercise (B) ──────────────────────
    if (isMidSuperset && supersetAIdx !== null) {
      const exA    = exercises[supersetAIdx]
      const moreRounds = supersetASetsDone.length < exA.sets
      if (moreRounds) {
        // Go back to A for next round
        const nw = lastWeights[exA.name] ?? 0
        setExIdx(supersetAIdx)
        setSetsDone(supersetASetsDone)
        setReps(exA.defaultReps)
        setWeight(nw)
        setTimerSec(ex.restSec)
        setTimerRunning(true)
        setIsMidSuperset(false)
        if (wid) saveProg({ workoutId: wid, exIdx: supersetAIdx, setsDone: supersetASetsDone, reps: exA.defaultReps, weight: nw, allCompleted: newAll, startedAt: startedAtRef.current })
      } else {
        // Superset fully done — advance past B
        setIsMidSuperset(false)
        setSupersetASetsDone([])
        setSupersetAIdx(null)
        const nextIdx = exIdx + 1
        if (nextIdx < exercises.length) {
          const nex = exercises[nextIdx]
          const nw  = lastWeights[nex.name] ?? 0
          setExIdx(nextIdx); setSetsDone([]); setReps(nex.defaultReps)
          setWeight(nw); setTimerSec(nex.restSec); setTimerRunning(true)
          if (wid) saveProg({ workoutId: wid, exIdx: nextIdx, setsDone: [], reps: nex.defaultReps, weight: nw, allCompleted: newAll, startedAt: startedAtRef.current })
        } else {
          clearProg(); setTimerRunning(false)
          setWorkoutDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
          setPhase('feedback')
        }
      }
      return
    }

    // ── Superset: finishing the first exercise (A) ───────────────────────
    const nextEx = exercises[exIdx + 1]
    const isFirstOfSS = ex.superset_group != null && nextEx?.superset_group === ex.superset_group
    if (isFirstOfSS) {
      const newSetsDone = [...setsDone, newSet]
      setSupersetAIdx(exIdx)
      setSupersetASetsDone(newSetsDone)
      setIsMidSuperset(true)
      const nw = lastWeights[nextEx.name] ?? 0
      setExIdx(exIdx + 1); setSetsDone([]); setReps(nextEx.defaultReps)
      setWeight(nw); setTimerSec(nextEx.restSec)
      // No rest timer — immediate switch to B
      return
    }

    // ── Normal single-exercise flow ──────────────────────────────────────
    const next: SetResult[] = [...setsDone, newSet]
    if (next.length >= ex.sets) {
      setExerciseSetsDone(prev => ({ ...prev, [exIdx]: next }))
      if (exIdx < exercises.length - 1) {
        const ni  = exIdx + 1
        const nex = exercises[ni]
        const nw  = lastWeights[nex.name] ?? 0
        setExIdx(ni); setSetsDone([]); setReps(nex.defaultReps)
        setWeight(nw); setTimerSec(nex.restSec)
        if (wid) saveProg({ workoutId: wid, exIdx: ni, setsDone: [], reps: nex.defaultReps, weight: nw, allCompleted: newAll, startedAt: startedAtRef.current })
      } else {
        clearProg(); setTimerRunning(false)
        setWorkoutDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
        setPhase('feedback'); return
      }
    } else {
      setSetsDone(next)
      if (wid) saveProg({ workoutId: wid, exIdx, setsDone: next, reps, weight, allCompleted: newAll, startedAt: startedAtRef.current })
    }
    setTimerSec(ex.restSec)
    setTimerRunning(true)
  }

  async function handleCircuitExConc() {
    const ex = exercises[circuitExIdx]
    await saveLog(ex.name, ex.defaultReps, 0)
    const newAll: CompletedSet[] = [...allCompleted, { exerciseName: ex.name, reps: ex.defaultReps, weight: 0 }]
    setAllCompleted(newAll)
    if (circuitExIdx < exercises.length - 1) { setCircuitExIdx(i => i + 1); return }
    if (currentRound < totalRounds) {
      setRoundRestActive(true); setRoundRestSec(90); setRoundRestRunning(true)
    } else {
      clearProg(); setRoundRestRunning(false)
      setWorkoutDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
      setPhase('feedback')
    }
  }

  function skipRoundRest() {
    setRoundRestRunning(false); setRoundRestActive(false)
    setCurrentRound(r => r + 1); setCircuitExIdx(0); setRoundRestSec(90)
  }

  function goToExercise(newIdx: number) {
    if (newIdx < 0 || newIdx >= exercises.length) return
    const restored = exerciseSetsDone[newIdx] ?? []
    setExerciseSetsDone(prev => ({ ...prev, [exIdx]: setsDone }))
    const nex = exercises[newIdx]
    const nw  = lastWeights[nex.name] ?? 0
    const nr  = restored.length > 0 ? restored[restored.length - 1].reps : nex.defaultReps
    setExIdx(newIdx)
    setSetsDone(restored)
    setReps(nr)
    setWeight(nw)
    setTimerSec(nex.restSec)
    setTimerRunning(false)
    const wid = workoutIdRef.current
    if (wid) saveProg({ workoutId: wid, exIdx: newIdx, setsDone: restored, reps: nr, weight: nw, allCompleted, startedAt: startedAtRef.current })
  }

  async function handleFeedbackSubmit() {
    if (studentIdRef.current && workoutIdRef.current) {
      setFbSaving(true)
      await supabase.from('workout_sessions').insert({
        student_id: studentIdRef.current,
        workout_id: workoutIdRef.current,
        intensity:  fbIntensity,
        pain:       fbPain,
        notes:      fbNotes || null,
      })
      setFbSaving(false)
    }
    setPhase('summary')
  }

  async function generateShareImage(photoFile?: File): Promise<Blob | null> {
    const W = 1080, H = 1920
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    if (photoFile) {
      await new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => {
          const scale = Math.max(W / img.width, H / img.height)
          const sw = img.width * scale, sh = img.height * scale
          ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = URL.createObjectURL(photoFile)
      })
      ctx.fillStyle = 'rgba(27,42,74,0.78)'
      ctx.fillRect(0, 0, W, H)
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#1B2A4A')
      grad.addColorStop(1, '#0f1a2e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
    }

    ctx.fillStyle = '#E8542A'
    ctx.font = `700 56px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('KINEA', W / 2, 130)

    const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    ctx.fillStyle = '#8B97AD'
    ctx.font = `400 34px sans-serif`
    ctx.fillText(dateStr, W / 2, 185)

    ctx.fillStyle = '#FAEEDA'
    ctx.font = `900 76px sans-serif`
    wrapText(ctx, workoutName, W / 2, 300, W - 100, 92)

    const totalSets = allCompleted.length
    const totalLoad = allCompleted.reduce((sum, s) => sum + s.reps * s.weight, 0)
    const statsY = 480
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, 50, statsY, W - 100, 190, 30); ctx.fill()

    const cols = isCircuit ? [
      { label: 'Duração',    value: fmtDuration(workoutDurationSec) },
      { label: 'Rounds',     value: `${totalRounds}` },
      { label: 'Exercícios', value: `${exercises.length}` },
    ] : [
      { label: 'Duração',     value: fmtDuration(workoutDurationSec) },
      { label: 'Séries',      value: `${totalSets}` },
      { label: 'Carga total', value: totalLoad > 0 ? `${Math.round(totalLoad).toLocaleString('pt-BR')}kg` : '—' },
    ]
    const colW = (W - 100) / 3
    cols.forEach((c, i) => {
      const cx = 50 + colW * i + colW / 2
      ctx.fillStyle = '#FAEEDA'; ctx.font = `900 52px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(c.value, cx, statsY + 85)
      ctx.fillStyle = '#8B97AD'; ctx.font = `400 28px sans-serif`
      ctx.fillText(c.label, cx, statsY + 135)
    })

    let y = statsY + 240
    ctx.fillStyle = '#8B97AD'; ctx.font = `600 30px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText('EXERCÍCIOS', 60, y); y += 20

    const exNames = [...new Set(allCompleted.map(s => s.exerciseName))]
    for (const name of exNames.slice(0, 8)) {
      const sets = allCompleted.filter(s => s.exerciseName === name)
      y += 64
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      roundRect(ctx, 50, y - 40, W - 100, 58, 14); ctx.fill()
      ctx.fillStyle = '#FAEEDA'; ctx.font = `600 30px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(name, 80, y)
      ctx.fillStyle = '#E8542A'; ctx.font = `700 28px sans-serif`; ctx.textAlign = 'right'
      ctx.fillText(`${sets.length} série${sets.length !== 1 ? 's' : ''}`, W - 80, y)
    }

    ctx.fillStyle = 'rgba(139,151,173,0.5)'; ctx.font = `400 28px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('kinea.app', W / 2, H - 80)

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }

  async function doShare(photoFile?: File) {
    if (sharingRef.current) return
    sharingRef.current = true
    setSharing(true)
    setShareAskPhoto(false)
    try {
      const blob = await generateShareImage(photoFile)
      if (!blob) return
      const file = new File([blob], 'treino-kinea.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Treino concluído: ${workoutName}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'treino-kinea.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* user cancelled */ }
    setSharing(false)
    sharingRef.current = false
  }

  // ── already done ─────────────────────────────────────────────────────────────
  if (phase === 'already_done') return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 32 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(76,175,138,.15)', border: '1.5px solid rgba(76,175,138,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={36} color="#4CAF8A" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: `900 22px ${FF}`, color: '#FAEEDA', marginBottom: 10 }}>Treino concluído hoje!</div>
        <div style={{ font: `400 14px ${FF}`, color: '#8B97AD', lineHeight: 1.65, maxWidth: 260 }}>
          Você já realizou este treino hoje. Descanse e volte amanhã mais forte 💪
        </div>
      </div>
      <button onClick={() => navigate('/aluno/treinos')}
        style={{ height: 48, padding: '0 28px', background: '#E8542A', border: 'none', borderRadius: 12, font: `700 14px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
        Ver meus treinos
      </button>
    </div>
  )

  // ── loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ font: `500 14px ${FF}`, color: '#8B97AD' }}>Carregando treino…</div>
    </div>
  )

  // ── feedback ──────────────────────────────────────────────────────────────────
  if (phase === 'feedback') {
    const INTENSITY = [
      { v: 1, label: 'Muito\nfácil', emoji: '😴' },
      { v: 2, label: 'Fácil',        emoji: '🙂' },
      { v: 3, label: 'Moderado',     emoji: '💪' },
      { v: 4, label: 'Difícil',      emoji: '🔥' },
      { v: 5, label: 'Exaustivo',    emoji: '😤' },
    ]
    const PAIN = [
      { v: 0, label: 'Nenhuma' },
      { v: 1, label: 'Leve' },
      { v: 2, label: 'Moderada' },
      { v: 3, label: 'Intensa' },
    ]
    return (
      <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(76,175,138,.15)', border: '1.5px solid rgba(76,175,138,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={22} color="#4CAF8A" />
          </div>
          <div>
            <div style={{ font: `900 20px ${FF}`, color: '#FAEEDA' }}>Treino concluído!</div>
            <div style={{ font: `400 12px ${FF}`, color: '#8B97AD' }}>Nos conta como foi</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 20px 12px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ font: `700 13px ${FF}`, color: '#FAEEDA', marginBottom: 14 }}>Intensidade do treino</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {INTENSITY.map(opt => (
                <button key={opt.v} onClick={() => setFbIntensity(opt.v)}
                  style={{ flex: 1, padding: '10px 4px', border: `1.5px solid ${fbIntensity === opt.v ? '#E8542A' : 'rgba(255,255,255,.1)'}`, borderRadius: 12, background: fbIntensity === opt.v ? 'rgba(232,84,42,.15)' : 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <span style={{ font: `600 9px ${FF}`, color: fbIntensity === opt.v ? '#E8542A' : '#8B97AD', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.2 }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ font: `700 13px ${FF}`, color: '#FAEEDA', marginBottom: 14 }}>Sentiu dor durante o treino?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {PAIN.map(opt => (
                <button key={opt.v} onClick={() => setFbPain(opt.v)}
                  style={{ flex: 1, padding: '12px 6px', border: `1.5px solid ${fbPain === opt.v ? '#E8542A' : 'rgba(255,255,255,.1)'}`, borderRadius: 12, background: fbPain === opt.v ? 'rgba(232,84,42,.15)' : 'rgba(255,255,255,.05)', cursor: 'pointer', font: `600 12px ${FF}`, color: fbPain === opt.v ? '#E8542A' : '#8B97AD' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ font: `700 13px ${FF}`, color: '#FAEEDA', marginBottom: 12 }}>Observações <span style={{ font: `400 12px ${FF}`, color: '#8B97AD' }}>(opcional)</span></div>
            <textarea
              value={fbNotes}
              onChange={e => setFbNotes(e.target.value)}
              placeholder="Alguma dificuldade, sensação ou ponto de atenção?"
              rows={4}
              style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 14px', font: `400 13px ${FF}`, color: '#FAEEDA', resize: 'none', outline: 'none', boxSizing: 'border-box' } as React.CSSProperties}
            />
          </div>
        </div>

        <div style={{ padding: '12px 20px 36px' }}>
          <button onClick={handleFeedbackSubmit} disabled={fbSaving}
            style={{ width: '100%', height: 52, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 16px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E', opacity: fbSaving ? 0.7 : 1 }}>
            {fbSaving ? 'Salvando…' : 'Ver resumo do treino →'}
          </button>
        </div>
      </div>
    )
  }

  // ── summary ───────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    const totalSetsCount = allCompleted.length
    const totalLoad      = allCompleted.reduce((sum, s) => sum + s.reps * s.weight, 0)
    const exSummary = exercises.map(e => ({
      name: e.name,
      sets: allCompleted.filter(s => s.exerciseName === e.name).length,
    })).filter(e => e.sets > 0)

    return (
      <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <input ref={photoInputRef} type="file" accept="image/*"
          capture={'environment' as any} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void doShare(f) }}
        />

        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(76,175,138,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={20} color="#4CAF8A" />
            </div>
            <div style={{ font: `900 18px ${FF}`, color: '#FAEEDA' }}>Resumo do treino</div>
          </div>
          <button onClick={() => navigate('/aluno/treinos')}
            style={{ height: 34, padding: '0 14px', background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 8, font: `600 12px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <div style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginBottom: 4 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ font: `900 26px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px', marginBottom: 22 }}>
            {workoutName}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 26 }}>
            {(isCircuit ? [
              { label: 'Duração',    value: fmtDuration(workoutDurationSec) },
              { label: 'Rounds',     value: `${totalRounds}` },
              { label: 'Exercícios', value: `${exercises.length}` },
            ] : [
              { label: 'Duração',     value: fmtDuration(workoutDurationSec) },
              { label: 'Séries',      value: `${totalSetsCount}` },
              { label: 'Carga total', value: totalLoad > 0 ? `${Math.round(totalLoad).toLocaleString('pt-BR')} kg` : '—' },
            ]).map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ font: `900 ${s.label === 'Carga total' && totalLoad >= 10000 ? '16px' : '22px'} ${FF}`, color: '#FAEEDA' }}>{s.value}</div>
                <div style={{ font: `400 10px ${FF}`, color: '#8B97AD', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ font: `700 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            {isCircuit ? 'Exercícios do circuito' : 'Por exercício'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {isCircuit
              ? exercises.map((e, i) => (
                  <div key={e.name} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(232,84,42,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ font: `700 10px ${FF}`, color: '#E8542A' }}>{i + 1}</span>
                      </div>
                      <span style={{ font: `600 13px ${FF}`, color: '#FAEEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    </div>
                    <span style={{ font: `700 12px ${FF}`, color: '#E8542A', flexShrink: 0, marginLeft: 12 }}>
                      {e.defaultReps} reps × {totalRounds}
                    </span>
                  </div>
                ))
              : exSummary.map(e => (
                  <div key={e.name} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ font: `600 13px ${FF}`, color: '#FAEEDA', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    <span style={{ font: `700 12px ${FF}`, color: '#E8542A', flexShrink: 0, marginLeft: 12 }}>
                      {e.sets} série{e.sets !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>

        <div style={{ padding: '12px 20px 36px' }}>
          <button onClick={() => setShareAskPhoto(true)} disabled={sharing}
            style={{ width: '100%', height: 52, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 15px ${FF}`, color: '#fff', cursor: sharing ? 'default' : 'pointer', boxShadow: '0 4px 0 #C4421E', opacity: sharing ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {sharing ? 'Gerando imagem…' : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Compartilhar resumo
              </>
            )}
          </button>
        </div>

        {shareAskPhoto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShareAskPhoto(false)}>
            <div style={{ background: '#1e3056', borderRadius: '20px 20px 0 0', padding: '28px 20px 44px', width: '100%' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, margin: '0 auto 22px' }} />
              <div style={{ font: `900 17px ${FF}`, color: '#FAEEDA', textAlign: 'center', marginBottom: 8 }}>Adicionar foto de fundo?</div>
              <div style={{ font: `400 13px ${FF}`, color: '#8B97AD', textAlign: 'center', marginBottom: 26, lineHeight: 1.55 }}>
                Tire uma foto e ela será usada como fundo do card do treino.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { setShareAskPhoto(false); photoInputRef.current?.click() }}
                  style={{ height: 52, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 14px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
                  Sim, tirar foto
                </button>
                <button onClick={() => void doShare()}
                  style={{ height: 52, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 14, font: `600 14px ${FF}`, color: '#FAEEDA', cursor: 'pointer' }}>
                  Não, só o resumo
                </button>
                <button onClick={() => setShareAskPhoto(false)}
                  style={{ height: 44, background: 'transparent', border: 'none', borderRadius: 12, font: `500 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── circuit execution ─────────────────────────────────────────────────────────
  if (isCircuit && phase === 'workout' && exercises.length > 0) {
    const circEx        = exercises[circuitExIdx]
    const isLastExRound = circuitExIdx >= exercises.length - 1
    const isLastRound   = currentRound >= totalRounds
    const circProgress  = ((currentRound - 1) * exercises.length + circuitExIdx) / (totalRounds * exercises.length)
    const restMax       = 90
    const restOff       = (1 - roundRestSec / restMax) * CIRC

    if (roundRestActive) {
      return (
        <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => navigate('/aluno/treinos')}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={20} color="#FAEEDA" strokeWidth={2} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: `600 12px ${FF}`, color: '#8B97AD' }}>{workoutName || 'Circuito'}</div>
              <div style={{ font: `700 11px ${FF}`, color: '#4CAF8A', marginTop: 2 }}>
                Round {currentRound} de {totalRounds} concluído!
              </div>
            </div>
            <div style={{ width: 36 }} />
          </div>

          <div style={{ margin: '0 18px 0', background: 'rgba(255,255,255,.1)', height: 4, borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${(currentRound / totalRounds) * 100}%`, background: '#4CAF8A', borderRadius: 4, transition: 'width 400ms ease' }} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(76,175,138,.15)', border: '1.5px solid rgba(76,175,138,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Check size={34} color="#4CAF8A" />
            </div>
            <div style={{ font: `900 24px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px', marginBottom: 6 }}>
              Round {currentRound} concluído!
            </div>
            <div style={{ font: `400 13px ${FF}`, color: '#8B97AD', marginBottom: 36, textAlign: 'center', lineHeight: 1.55 }}>
              {currentRound < totalRounds
                ? `Prepare-se para o Round ${currentRound + 1} de ${totalRounds}`
                : 'Último round — descanse e finalize!'}
            </div>

            <svg width={160} height={160} viewBox="0 0 160 160"
              onClick={skipRoundRest} style={{ cursor: 'pointer', marginBottom: 10 }}>
              <circle cx={80} cy={80} r={70} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
              <circle cx={80} cy={80} r={70} fill="none" stroke="#4CAF8A" strokeWidth={8}
                strokeDasharray={CIRC} strokeDashoffset={restOff} strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: roundRestRunning ? 'stroke-dashoffset .9s linear' : 'none' }}
              />
              <text x={80} y={72} textAnchor="middle" fill="#FAEEDA" style={{ font: `900 42px ${FF}` }}>
                {String(roundRestSec).padStart(2, '0')}
              </text>
              <text x={80} y={100} textAnchor="middle" fill="#8B97AD" style={{ font: `500 12px ${FF}` }}>
                {roundRestRunning ? 'descanso' : 'toque para avançar'}
              </text>
            </svg>
            <span style={{ font: `400 11px ${FF}`, color: '#8B97AD' }}>toque no timer para pular</span>
          </div>

          <div style={{ padding: '12px 18px 40px' }}>
            <button onClick={skipRoundRest}
              style={{ width: '100%', padding: 16, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 14, font: `700 15px ${FF}`, color: '#FAEEDA', cursor: 'pointer' }}>
              Começar Round {currentRound + 1} →
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/aluno/treinos')}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} color="#FAEEDA" strokeWidth={2} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ font: `600 12px ${FF}`, color: '#8B97AD' }}>{workoutName || 'Circuito'}</div>
            <div style={{ font: `700 12px ${FF}`, color: '#E8542A', marginTop: 2 }}>
              Round {currentRound} de {totalRounds}
            </div>
          </div>
          <button onClick={() => setShowUpcoming(true)} title="Ver exercícios"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ margin: '0 18px 22px', background: 'rgba(255,255,255,.1)', height: 4, borderRadius: 4 }}>
          <div style={{ height: '100%', width: `${circProgress * 100}%`, background: '#E8542A', borderRadius: 4, transition: 'width 400ms ease' }} />
        </div>

        <div style={{ padding: '0 22px 12px' }}>
          <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 7 }}>
            {circEx.muscle.toUpperCase()} · {circuitExIdx + 1} DE {exercises.length}
          </div>
          <div style={{ font: `900 30px ${FF}`, color: '#FAEEDA', letterSpacing: '-.7px' }}>
            {circEx.name}
          </div>
        </div>

        {/* Target reps — big circle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 22px' }}>
          <div style={{ width: 164, height: 164, borderRadius: '50%', background: 'rgba(232,84,42,.1)', border: '2.5px solid rgba(232,84,42,.32)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ font: `900 54px ${FF}`, color: '#E8542A', lineHeight: 1 }}>{circEx.defaultReps}</span>
            <span style={{ font: `500 13px ${FF}`, color: '#8B97AD', marginTop: 7 }}>reps</span>
          </div>
        </div>

        {/* Exercise strip */}
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {exercises.map((e, i) => {
              const done    = i < circuitExIdx
              const current = i === circuitExIdx
              return (
                <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: done ? '#4CAF8A' : current ? 'rgba(232,84,42,.2)' : 'rgba(255,255,255,.08)', border: current ? '1.5px solid #E8542A' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done
                      ? <Check size={16} color="#fff" strokeWidth={2.5} />
                      : <span style={{ font: `700 12px ${FF}`, color: current ? '#E8542A' : '#8B97AD' }}>{i + 1}</span>
                    }
                  </div>
                  <span style={{ font: `500 9px ${FF}`, color: current ? '#FAEEDA' : done ? '#4CAF8A' : '#8B97AD', maxWidth: 50, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {e.name.split(' ')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '8px 18px 40px' }}>
          <button onClick={() => void handleCircuitExConc()}
            style={{ width: '100%', padding: 18, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 16px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
            {isLastExRound && isLastRound
              ? 'Concluir Circuito'
              : isLastExRound
                ? `Concluir Round ${currentRound} →`
                : 'Próximo exercício →'
            }
          </button>
          {(circuitExIdx > 0 || circuitExIdx < exercises.length - 1) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {circuitExIdx > 0 && (
                <button onClick={() => setCircuitExIdx(i => i - 1)}
                  style={{ flex: 1, height: 42, background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, font: `600 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                  ← Anterior
                </button>
              )}
              {circuitExIdx < exercises.length - 1 && (
                <button onClick={() => setCircuitExIdx(i => i + 1)}
                  style={{ flex: 1, height: 42, background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, font: `600 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                  Próximo →
                </button>
              )}
            </div>
          )}
        </div>

        {showUpcoming && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
            onClick={() => setShowUpcoming(false)}>
            <div style={{ background: '#1e3056', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, margin: '0 auto 20px' }} />
              <div style={{ font: `700 15px ${FF}`, color: '#FAEEDA', marginBottom: 4 }}>Exercícios do circuito</div>
              <div style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginBottom: 16 }}>
                Round {currentRound} de {totalRounds} · {circuitExIdx + 1} de {exercises.length}
              </div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exercises.map((e, i) => {
                  const done    = i < circuitExIdx
                  const current = i === circuitExIdx
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: current ? 'rgba(232,84,42,.12)' : done ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)', border: `1.5px solid ${current ? 'rgba(232,84,42,.35)' : 'transparent'}`, borderRadius: 12, padding: '12px 14px', opacity: done ? 0.5 : 1 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: done ? '#4CAF8A' : current ? 'rgba(232,84,42,.25)' : 'rgba(255,255,255,.1)', border: current ? '1.5px solid #E8542A' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {done
                          ? <Check size={14} color="#fff" strokeWidth={2.5} />
                          : <span style={{ font: `700 11px ${FF}`, color: current ? '#E8542A' : '#8B97AD' }}>{i + 1}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `600 13px ${FF}`, color: current ? '#FAEEDA' : done ? '#8B97AD' : '#FAEEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.name}
                        </div>
                        <div style={{ font: `400 11px ${FF}`, color: '#8B97AD', marginTop: 2 }}>
                          {e.muscle} · {e.defaultReps} reps
                        </div>
                      </div>
                      {current && (
                        <span style={{ font: `600 10px ${FF}`, color: '#E8542A', background: 'rgba(232,84,42,.18)', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>ATUAL</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── workout ───────────────────────────────────────────────────────────────────
  if (exercises.length === 0) return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ font: `700 16px ${FF}`, color: '#FAEEDA', textAlign: 'center' }}>Nenhum exercício encontrado neste treino.</div>
      <button onClick={() => navigate('/aluno/treinos')}
        style={{ height: 42, padding: '0 20px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}>
        Voltar
      </button>
    </div>
  )

  const ex         = exercises[exIdx]
  const totalExs   = exercises.length
  const timerMax   = ex.restSec
  const totalSets  = exercises.reduce((a, e) => a + e.sets, 0)
  const doneSets   = isMidSuperset && supersetAIdx !== null
    ? exercises.slice(0, supersetAIdx).reduce((a, e) => a + e.sets, 0) + supersetASetsDone.length + setsDone.length
    : exercises.slice(0, exIdx).reduce((a, e) => a + e.sets, 0) + setsDone.length
  const progress   = totalSets > 0 ? doneSets / totalSets : 0
  const timerOff   = (1 - timerSec / timerMax) * CIRC

  const isLast = (() => {
    if (isMidSuperset && supersetAIdx !== null) {
      const exA = exercises[supersetAIdx]
      return supersetASetsDone.length >= exA.sets && exIdx >= totalExs - 1
    }
    const nextEx = exercises[exIdx + 1]
    if (ex.superset_group != null && nextEx?.superset_group === ex.superset_group) return false
    return setsDone.length >= ex.sets - 1 && exIdx >= totalExs - 1
  })()

  const prevWeight   = lastWeights[ex.name]
  const prevReps     = lastReps[ex.name]
  const supersetPartner = isMidSuperset && supersetAIdx !== null
    ? exercises[supersetAIdx]
    : (!isMidSuperset && ex.superset_group != null && exercises[exIdx + 1]?.superset_group === ex.superset_group)
      ? exercises[exIdx + 1]
      : null
  const supersetRound = isMidSuperset ? supersetASetsDone.length : setsDone.length

  return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/aluno/treinos')}
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color="#FAEEDA" strokeWidth={2} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `600 12px ${FF}`, color: '#8B97AD' }}>{workoutName || 'Treino'}</div>
          {supersetPartner
            ? <div style={{ font: `700 11px ${FF}`, color: '#E8542A', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <span style={{ background: 'rgba(232,84,42,.18)', borderRadius: 10, padding: '1px 7px' }}>SUPERSET</span>
                <span style={{ color: '#8B97AD', fontWeight: 400 }}>série {supersetRound + 1} de {ex.sets}</span>
              </div>
            : <div style={{ font: `500 11px ${FF}`, color: '#E8542A', marginTop: 2 }}>Exercício {exIdx + 1} de {totalExs}</div>
          }
        </div>
        <button onClick={() => setShowUpcoming(true)}
          title="Ver próximos exercícios"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>
      </div>

      <div style={{ margin: '0 18px 20px', background: 'rgba(255,255,255,.1)', height: 4, borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#E8542A', borderRadius: 4, transition: 'width 400ms ease' }} />
      </div>

      {resumed && (
        <div style={{ margin: '-12px 18px 14px', background: 'rgba(76,175,138,.15)', border: '1px solid rgba(76,175,138,.3)', borderRadius: 10, padding: '8px 14px', font: `600 12px ${FF}`, color: '#4CAF8A', textAlign: 'center' }}>
          Treino retomado do ponto onde você parou
        </div>
      )}

      <div style={{ padding: '0 22px 16px' }}>
        <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>
          {ex.muscle.toUpperCase()}{supersetPartner ? ` · ${isMidSuperset ? 'B' : 'A'}` : ''}
        </div>
        <div style={{ font: `900 28px ${FF}`, color: '#FAEEDA', letterSpacing: '-.7px', marginBottom: 8 }}>
          {ex.name}
        </div>
        {supersetPartner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: '8px 12px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B97AD" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            <span style={{ font: `500 11px ${FF}`, color: '#8B97AD' }}>
              {isMidSuperset ? 'Após' : 'Em seguida'}: <span style={{ color: '#FAEEDA', fontWeight: 700 }}>{supersetPartner.name}</span>
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: 'rgba(232,84,42,.2)', borderRadius: 20, padding: '5px 12px', font: `600 11px ${FF}`, color: '#E8542A' }}>
            {ex.sets} séries × {ex.defaultReps} reps
          </span>
          {(prevWeight !== undefined || prevReps !== undefined) && (
            <span style={{ background: 'rgba(255,255,255,.08)', borderRadius: 20, padding: '5px 12px', font: `600 11px ${FF}`, color: '#8B97AD' }}>
              Última:{prevReps !== undefined ? ` ${prevReps} reps` : ''}{prevWeight !== undefined && prevReps !== undefined ? ' ·' : ''}{prevWeight !== undefined ? ` ${fmtWeight(prevWeight)} kg` : ''}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={160} height={160} viewBox="0 0 160 160" onClick={() => setTimerRunning(r => !r)} style={{ cursor: 'pointer' }}>
          <circle cx={80} cy={80} r={70} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
          <circle cx={80} cy={80} r={70} fill="none" stroke="#E8542A" strokeWidth={8}
            strokeDasharray={CIRC} strokeDashoffset={timerOff} strokeLinecap="round"
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

      <div style={{ margin: '0 18px', background: 'rgba(255,255,255,.06)', borderRadius: 18, padding: 18, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: ex.sets }).map((_, i) => {
            if (i < setsDone.length) return (
              <div key={i} onClick={() => openEditSet(i)}
                style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 22, height: 22, background: '#4CAF8A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={13} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ font: `600 13px ${FF}`, color: '#8B97AD', flex: 1 }}>Série {i + 1}</span>
                <span style={{ font: `700 12px ${FF}`, color: '#4CAF8A' }}>
                  {setsDone[i].reps} reps{setsDone[i].weight > 0 ? ` · ${fmtWeight(setsDone[i].weight)} kg` : ''}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55, flexShrink: 0 }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
            )
            if (i === setsDone.length) return (
              <div key={i} style={{ background: 'rgba(232,84,42,.12)', border: '1.5px solid rgba(232,84,42,.3)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 22, height: 22, background: 'rgba(232,84,42,.2)', border: '1.5px solid #E8542A', borderRadius: 6, flexShrink: 0 }} />
                  <span style={{ font: `700 13px ${FF}`, color: '#FAEEDA' }}>Série {i + 1} — atual</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Repetições</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button onClick={() => setReps(r => Math.max(1, r - 1))} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ font: `800 20px ${FF}`, color: '#FAEEDA' }}>{reps}</span>
                      <button onClick={() => setReps(r => r + 1)} style={{ width: 30, height: 30, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Carga (kg)</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        value={weight === 0 ? '' : weight}
                        onChange={e => {
                          const v = parseFloat(e.target.value.replace(',', '.'))
                          setWeight(isNaN(v) ? 0 : Math.max(0, v))
                        }}
                        placeholder="0"
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', font: `800 20px ${FF}`, color: '#FAEEDA', textAlign: 'center', WebkitAppearance: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
            return (
              <div key={i} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, flexShrink: 0 }} />
                <span style={{ font: `600 13px ${FF}`, color: 'rgba(139,151,173,.5)' }}>Série {i + 1}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '16px 18px 32px' }}>
        <button onClick={() => void handleSerieConc()}
          style={{ width: '100%', padding: 16, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 16px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
          {isLast
            ? 'Concluir Treino'
            : (!isMidSuperset && supersetPartner)
              ? `Série concluída → ${supersetPartner.name}`
              : 'Série concluída'}
        </button>
        {!isMidSuperset && (exIdx > 0 || exIdx < totalExs - 1) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {exIdx > 0 && (
              <button onClick={() => goToExercise(exIdx - 1)}
                style={{ flex: 1, height: 42, background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, font: `600 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                ← Anterior
              </button>
            )}
            {exIdx < totalExs - 1 && (
              <button onClick={() => goToExercise(exIdx + 1)}
                style={{ flex: 1, height: 42, background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, font: `600 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                Próximo →
              </button>
            )}
          </div>
        )}
      </div>

      {showUpcoming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setShowUpcoming(false)}>
          <div style={{ background: '#1e3056', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ font: `700 15px ${FF}`, color: '#FAEEDA', marginBottom: 16 }}>
              Exercícios do treino
              <span style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginLeft: 8 }}>
                {exIdx + 1} de {exercises.length}
              </span>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exercises.map((e, i) => {
                const isDone    = i < exIdx || (i === exIdx && setsDone.length >= e.sets)
                const isCurrent = i === exIdx && setsDone.length < e.sets
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isCurrent ? 'rgba(232,84,42,.12)' : isDone ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)',
                    border: `1.5px solid ${isCurrent ? 'rgba(232,84,42,.35)' : 'transparent'}`,
                    borderRadius: 12, padding: '12px 14px',
                    opacity: isDone ? 0.5 : 1,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: isDone ? '#4CAF8A' : isCurrent ? 'rgba(232,84,42,.25)' : 'rgba(255,255,255,.1)',
                      border: isCurrent ? '1.5px solid #E8542A' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isDone
                        ? <Check size={14} color="#fff" strokeWidth={2.5} />
                        : <span style={{ font: `700 11px ${FF}`, color: isCurrent ? '#E8542A' : '#8B97AD' }}>{i + 1}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `600 13px ${FF}`, color: isCurrent ? '#FAEEDA' : isDone ? '#8B97AD' : '#FAEEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.name}
                      </div>
                      <div style={{ font: `400 11px ${FF}`, color: '#8B97AD', marginTop: 2 }}>
                        {e.muscle} · {e.sets}×{e.defaultReps} reps
                      </div>
                    </div>
                    {isCurrent && (
                      <span style={{ font: `600 10px ${FF}`, color: '#E8542A', background: 'rgba(232,84,42,.18)', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
                        ATUAL
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {editSetIdx !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setEditSetIdx(null)}>
          <div style={{ background: '#1e3056', borderRadius: '20px 20px 0 0', padding: '28px 20px 44px', width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, margin: '0 auto 22px' }} />
            <div style={{ font: `700 16px ${FF}`, color: '#FAEEDA', marginBottom: 20 }}>
              Editar série {editSetIdx + 1}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 12px' }}>
                <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Repetições</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button onClick={() => setEditReps(r => Math.max(1, r - 1))}
                    style={{ width: 34, height: 34, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 20px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ font: `800 24px ${FF}`, color: '#FAEEDA' }}>{editReps}</span>
                  <button onClick={() => setEditReps(r => r + 1)}
                    style={{ width: 34, height: 34, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 20px ${FF}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>

              <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '14px 12px' }}>
                <div style={{ font: `500 10px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Carga (kg)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={editWeight === 0 ? '' : editWeight}
                    onChange={e => {
                      const v = parseFloat(e.target.value.replace(',', '.'))
                      setEditWeight(isNaN(v) ? 0 : Math.max(0, v))
                    }}
                    placeholder="0"
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', font: `800 24px ${FF}`, color: '#FAEEDA', textAlign: 'center', WebkitAppearance: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => void handleEditSetSave()}
                style={{ height: 52, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 15px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
                Salvar
              </button>
              <button onClick={() => setEditSetIdx(null)}
                style={{ height: 44, background: 'transparent', border: 'none', borderRadius: 12, font: `500 13px ${FF}`, color: '#8B97AD', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
