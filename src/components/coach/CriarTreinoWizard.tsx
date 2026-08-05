import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { EXERCISE_LIBRARY } from '../../data/exercicios'
import { getInitials, avatarPalette } from '../../data/mock'
import { calcSuggestionsForSlot, type WeightSuggestion } from '../../lib/progressao'
import type { Student } from '../../data/mock'

const FF = '"Libre Franklin",sans-serif'

// ── Types ────────────────────────────────────────────────────────
type Goal = 'Hipertrofia' | 'Emagrecimento' | 'Força' | 'Condicionamento' | 'Mobilidade'
type Phase = 'Adaptação' | 'Hipertrofia' | 'Força' | 'Deload'
type WorkoutType = 'standard' | 'circuito'
type Technique = 'none' | 'superset' | 'bi_set' | 'drop_set' | 'rest_pause'

interface WizardExercise {
  _k: number
  name: string
  muscle: string
  sets: number
  reps: string
  rest: string
  technique: Technique
  superset_group: number | null
  prescribed_weight_kg: number | null
  suggestion: WeightSuggestion | null
}

interface WizardSlot {
  _k: number
  dayOfWeek: number | null
  name: string
  exercises: WizardExercise[]
}

// ── Constants ────────────────────────────────────────────────────
const GOALS: Goal[] = ['Hipertrofia', 'Emagrecimento', 'Força', 'Condicionamento', 'Mobilidade']
const PHASES: Phase[] = ['Adaptação', 'Hipertrofia', 'Força', 'Deload']
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ROUNDS_OPTIONS = [2, 3, 4, 5, 6, 8, 10]

const GOAL_STYLE: Record<Goal, { color: string; bg: string }> = {
  Hipertrofia:     { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:   { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:           { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento: { color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:      { color: '#5a4ea0', bg: '#ece9f6' },
}

const TECHNIQUE_META: Record<Technique, { label: string; color: string; bg: string }> = {
  none:       { label: 'Normal',     color: '#6b6657', bg: '#f4efe3' },
  superset:   { label: 'Superset',   color: '#1B7a4a', bg: '#e7f3ea' },
  bi_set:     { label: 'Bi-set',     color: '#5a4ea0', bg: '#ece9f6' },
  drop_set:   { label: 'Drop set',   color: '#c4421e', bg: '#fbe6e1' },
  rest_pause: { label: 'Rest-pause', color: '#b06a12', bg: '#f7ecd9' },
}

const STEP_LABELS = [
  'Aluno', 'Objetivo', 'Tipo', 'Divisão', 'Exercícios', 'Revisão', 'Publicar',
]

// ── Helpers ──────────────────────────────────────────────────────
let _k = Date.now()
const nextK = () => ++_k

// ── Exercise Picker Modal ────────────────────────────────────────
function ExPickerModal({ onAdd, onClose }: {
  onAdd: (ex: Omit<WizardExercise, '_k' | 'prescribed_weight_kg' | 'suggestion'>) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')
  const [customMuscle, setCustomMuscle] = useState('')
  const [tab, setTab] = useState<'biblioteca' | 'personalizado'>('biblioteca')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q))
    : EXERCISE_LIBRARY

  function addLibrary(name: string, muscle: string) {
    onAdd({ name, muscle, sets: 3, reps: '12', rest: '60s', technique: 'none', superset_group: null })
  }

  function addCustom() {
    if (!custom.trim()) return
    onAdd({ name: custom.trim(), muscle: customMuscle.trim() || 'Outro', sets: 3, reps: '12', rest: '60s', technique: 'none', superset_group: null })
    onClose()
  }

  const inp: React.CSSProperties = { height: 40, border: '1.5px solid #d9d3c4', borderRadius: 9, background: '#fff', padding: '0 12px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ font: `800 17px ${FF}`, color: '#1B2A4A', margin: 0 }}>Adicionar exercício</h3>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0, background: '#f4efe3', borderRadius: 9, padding: 3, marginBottom: 10 }}>
            {(['biblioteca', 'personalizado'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 33, border: 'none', borderRadius: 7, cursor: 'pointer', font: `700 12.5px ${FF}`, transition: 'all .12s', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1B2A4A' : '#9a948a', boxShadow: tab === t ? '0 1px 4px rgba(27,42,74,.1)' : 'none' }}>
                {t === 'biblioteca' ? 'Biblioteca' : 'Personalizado'}
              </button>
            ))}
          </div>
          {tab === 'biblioteca' && (
            <div style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar exercício ou músculo..."
                style={{ ...inp, width: '100%', paddingLeft: 32 }} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
            </div>
          )}
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 14px' }}>
          {tab === 'biblioteca' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(e => (
                <button key={e.name} type="button" onClick={() => { addLibrary(e.name, e.muscle); onClose() }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .1s, background .1s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fdf3ee' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#ece7d9'; e.currentTarget.style.background = '#fff' }}>
                  <span style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{e.name}</span>
                  <span style={{ font: `500 11px ${FF}`, color: '#9a948a', whiteSpace: 'nowrap' }}>{e.muscle}</span>
                </button>
              ))}
              {filtered.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>Nenhum exercício encontrado</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
              <div>
                <label style={{ display: 'block', font: `600 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>Nome do exercício</label>
                <input autoFocus type="text" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Ex: Rosca concentrada"
                  style={{ ...inp, width: '100%' }} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
              </div>
              <div>
                <label style={{ display: 'block', font: `600 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>Grupo muscular</label>
                <input type="text" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)} placeholder="Ex: Bíceps"
                  style={{ ...inp, width: '100%' }} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
              </div>
              <button onClick={addCustom} disabled={!custom.trim()}
                style={{ height: 44, border: 'none', background: custom.trim() ? '#E8542A' : '#d9d3c4', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: custom.trim() ? 'pointer' : 'not-allowed', boxShadow: custom.trim() ? '0 2px 0 #c4421e' : 'none' }}>
                Adicionar exercício
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Exercise Card (Step 5) ───────────────────────────────────────
function ExerciseCard({ ex, idx, total, isCircuito, onUpdate, onRemove, onPairWithNext }: {
  ex: WizardExercise
  idx: number
  total: number
  isCircuito: boolean
  onUpdate: (updated: WizardExercise) => void
  onRemove: () => void
  onPairWithNext: () => void
}) {
  const [open, setOpen] = useState(false)
  const tm = TECHNIQUE_META[ex.technique]
  const inp: React.CSSProperties = { height: 36, border: '1.5px solid #d9d3c4', borderRadius: 8, background: '#fff', padding: '0 10px', font: `600 13px ${FF}`, color: '#1B2A4A', outline: 'none', width: '100%', boxSizing: 'border-box' }

  const isPaired = ex.superset_group != null
  const canPair = (ex.technique === 'superset' || ex.technique === 'bi_set') && idx < total - 1

  return (
    <div style={{ border: `1.5px solid ${isPaired ? '#d4e8d4' : '#ece7d9'}`, background: isPaired ? '#f6fbf6' : '#fff', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f4efe3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ font: `700 10px ${FF}`, color: '#E8542A' }}>{idx + 1}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
          <div style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>{ex.muscle}</div>
        </div>
        {ex.technique !== 'none' && (
          <span style={{ font: `600 10px ${FF}`, color: tm.color, background: tm.bg, borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>{tm.label}</span>
        )}
        <button onClick={() => setOpen(o => !o)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}/></svg>
        </button>
        <button onClick={onRemove} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c4421e', padding: 2, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Collapsed preview */}
      {!open && (
        <div style={{ display: 'flex', gap: 10, padding: '0 12px 10px', paddingLeft: 44 }}>
          <span style={{ font: `500 12px ${FF}`, color: '#6b6657' }}>
            {isCircuito ? `${ex.reps} reps/round` : `${ex.sets} × ${ex.reps} · ${ex.rest}`}
          </span>
        </div>
      )}

      {/* Expanded edit */}
      {open && (
        <div style={{ padding: '0 12px 14px 12px', borderTop: '1px solid #f0ebe0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isCircuito ? '1fr' : '1fr 1fr 1fr', gap: 8, marginTop: 10, marginBottom: 12 }}>
            {!isCircuito && (
              <div>
                <label style={{ display: 'block', font: `600 9.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 4 }}>Séries</label>
                <input type="number" min="1" max="20" value={ex.sets} onChange={e => onUpdate({ ...ex, sets: parseInt(e.target.value) || 1 })}
                  style={inp} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', font: `600 9.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 4 }}>{isCircuito ? 'Reps / round' : 'Reps'}</label>
              <input type="text" placeholder="12" value={ex.reps} onChange={e => onUpdate({ ...ex, reps: e.target.value })}
                style={inp} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
            </div>
            {!isCircuito && (
              <div>
                <label style={{ display: 'block', font: `600 9.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 4 }}>Descanso</label>
                <input type="text" placeholder="60s" value={ex.rest} onChange={e => onUpdate({ ...ex, rest: e.target.value })}
                  style={inp} onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
              </div>
            )}
          </div>

          {/* Técnica */}
          <div style={{ marginBottom: canPair ? 10 : 0 }}>
            <div style={{ font: `600 9.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>Técnica</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(Object.keys(TECHNIQUE_META) as Technique[]).map(t => {
                const tm2 = TECHNIQUE_META[t]
                const active = ex.technique === t
                return (
                  <button key={t} type="button" onClick={() => onUpdate({ ...ex, technique: t, superset_group: (t === 'none') ? null : ex.superset_group })}
                    style={{ height: 28, padding: '0 10px', border: `1.5px solid ${active ? tm2.color : '#d9d3c4'}`, background: active ? tm2.bg : '#fff', color: active ? tm2.color : '#6b6657', font: `600 11px ${FF}`, borderRadius: 20, cursor: 'pointer', transition: 'all .1s' }}>
                    {tm2.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Parear com próximo (superset / bi-set) */}
          {canPair && (
            <button type="button" onClick={onPairWithNext}
              style={{ marginTop: 8, height: 30, padding: '0 12px', border: `1.5px solid ${isPaired ? '#1B7a4a' : '#d9d3c4'}`, background: isPaired ? '#e7f3ea' : '#fff', color: isPaired ? '#1B7a4a' : '#6b6657', font: `600 11px ${FF}`, borderRadius: 8, cursor: 'pointer', transition: 'all .1s', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="13" height="10" rx="2"/></svg>
              {isPaired ? 'Pareado com próximo' : 'Parear com próximo'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Review Exercise Card (Step 6) ────────────────────────────────
function ReviewExCard({ ex, idx, isCircuito, onWeightChange }: {
  ex: WizardExercise
  idx: number
  isCircuito: boolean
  onWeightChange: (w: number | null) => void
}) {
  const s = ex.suggestion
  const reasonLabel = s?.reason === 'completed' ? 'Progressão sugerida (+5–10%)'
    : s?.reason === 'not_completed' ? 'Mantendo carga (não concluiu tudo)'
    : 'Primeiro treino — defina a carga'
  const reasonColor = s?.reason === 'completed' ? '#1B7a4a' : s?.reason === 'not_completed' ? '#b06a12' : '#9a948a'

  return (
    <div style={{ border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f4efe3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ font: `700 11px ${FF}`, color: '#E8542A' }}>{idx + 1}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{ex.name}</div>
        <div style={{ font: `400 11px ${FF}`, color: '#9a948a', marginBottom: 8 }}>
          {isCircuito ? `${ex.reps} reps/round` : `${ex.sets} × ${ex.reps} · ${ex.rest}`} · {ex.muscle}
        </div>
        <div>
          <div style={{ font: `600 9.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 5 }}>Carga prescrita (kg)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="0" step="0.5"
              placeholder={s?.reason === 'first_time' ? 'Defina a carga' : ''}
              value={ex.prescribed_weight_kg ?? ''}
              onChange={e => {
                const v = parseFloat(e.target.value)
                onWeightChange(isNaN(v) ? null : v)
              }}
              style={{ height: 38, width: 100, border: `1.5px solid ${ex.prescribed_weight_kg != null ? '#E8542A' : '#d9d3c4'}`, borderRadius: 9, background: '#fdf8f2', padding: '0 10px', font: `700 15px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
              onBlur={e => { e.currentTarget.style.borderColor = ex.prescribed_weight_kg != null ? '#E8542A' : '#d9d3c4' }}
            />
            <span style={{ font: `500 12px ${FF}`, color: reasonColor }}>{reasonLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Wizard ───────────────────────────────────────────────────────
export function CriarTreinoWizard({ students, onClose, onCreated }: {
  students: Student[]
  onClose: () => void
  onCreated: () => void
}) {
  const { user } = useAuthStore()

  // Wizard state
  const [step, setStep] = useState(1)
  const [studentId, setStudentId] = useState<number | null>(null)
  const [goal, setGoal] = useState<Goal>('Hipertrofia')
  const [phase, setPhase] = useState<Phase>('Hipertrofia')
  const [workoutType, setWorkoutType] = useState<WorkoutType>('standard')
  const [rounds, setRounds] = useState(3)
  const [slots, setSlots] = useState<WizardSlot[]>([])
  const [activeSlotIdx, setActiveSlotIdx] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Student search
  const [studentQuery, setStudentQuery] = useState('')
  const sq = studentQuery.trim().toLowerCase()
  const visibleStudents = sq ? students.filter(s => s.name.toLowerCase().includes(sq) || s.goal.toLowerCase().includes(sq)) : students

  const selectedStudent = students.find(s => s.id === studentId) ?? null

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2200)
  }

  // Pré-preenche objetivo do aluno ao selecionar
  function handleSelectStudent(s: Student) {
    setStudentId(s.id)
    const g = GOALS.find(g => s.goal.toLowerCase().includes(g.toLowerCase()))
    if (g) setGoal(g)
    setStep(2)
  }

  // Step 4 — adicionar/remover dias
  function toggleDay(day: number) {
    const exists = slots.find(sl => sl.dayOfWeek === day)
    if (exists) {
      setSlots(prev => prev.filter(sl => sl.dayOfWeek !== day))
    } else {
      const newSlot: WizardSlot = { _k: nextK(), dayOfWeek: day, name: '', exercises: [] }
      setSlots(prev => [...prev, newSlot].sort((a, b) => (a.dayOfWeek ?? 7) - (b.dayOfWeek ?? 7)))
    }
  }

  // Step 5 — exercícios por slot
  function updateSlot(slotK: number, updater: (s: WizardSlot) => WizardSlot) {
    setSlots(prev => prev.map(s => s._k === slotK ? updater(s) : s))
  }

  function addExerciseToSlot(slotK: number, ex: Omit<WizardExercise, '_k' | 'prescribed_weight_kg' | 'suggestion'>) {
    updateSlot(slotK, s => ({
      ...s,
      exercises: [...s.exercises, { ...ex, _k: nextK(), prescribed_weight_kg: null, suggestion: null }],
    }))
    setPickerOpen(false)
  }

  function updateExercise(slotK: number, exK: number, updated: WizardExercise) {
    updateSlot(slotK, s => ({ ...s, exercises: s.exercises.map(e => e._k === exK ? updated : e) }))
  }

  function removeExercise(slotK: number, exK: number) {
    updateSlot(slotK, s => ({ ...s, exercises: s.exercises.filter(e => e._k !== exK) }))
  }

  function pairWithNext(slotK: number, exIdx: number) {
    updateSlot(slotK, s => {
      const exs = [...s.exercises]
      const exA = exs[exIdx]
      const exB = exs[exIdx + 1]
      if (!exA || !exB) return s
      const arePaired = exA.superset_group != null && exA.superset_group === exB.superset_group
      if (arePaired) {
        exs[exIdx]     = { ...exA, superset_group: null }
        exs[exIdx + 1] = { ...exB, superset_group: null }
      } else {
        const group = nextK()
        exs[exIdx]     = { ...exA, superset_group: group }
        exs[exIdx + 1] = { ...exB, superset_group: group }
      }
      return { ...s, exercises: exs }
    })
  }

  // Step 5 → 6: busca sugestões de carga
  async function loadSuggestions() {
    if (!studentId) return
    setLoadingSuggestions(true)
    try {
      const updatedSlots = await Promise.all(
        slots.map(async slot => {
          const suggestions = await calcSuggestionsForSlot(
            studentId,
            slot.exercises.map(e => ({ name: e.name, muscle: e.muscle, sets: e.sets, reps: e.reps })),
          )
          return {
            ...slot,
            exercises: slot.exercises.map((ex, i) => ({
              ...ex,
              suggestion: suggestions[i],
              prescribed_weight_kg: suggestions[i]?.weight ?? null,
            })),
          }
        })
      )
      setSlots(updatedSlots)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Avança etapa
  async function goNext() {
    if (step === 1 && !studentId) { showToast('Selecione um aluno para continuar'); return }
    if (step === 4 && slots.length === 0) { showToast('Adicione pelo menos um dia de treino'); return }
    if (step === 5 && slots.some(s => s.exercises.length === 0)) { showToast('Adicione pelo menos 1 exercício por dia'); return }
    if (step === 5) { await loadSuggestions(); setStep(6); return }
    if (step === 6) { setStep(7); return }
    setStep(prev => (prev + 1) as typeof step)
  }

  function goBack() {
    if (step === 1) { onClose(); return }
    setStep(prev => (prev - 1) as typeof step)
  }

  // Step 7 — publicar
  async function handlePublish() {
    if (!user?.id || !studentId) return
    setSaving(true)
    try {
      const student = students.find(s => s.id === studentId)
      const programName = `${student?.name ?? 'Aluno'} — ${goal} (${phase})`

      // 1. Criar programa
      const { data: prog, error: pErr } = await supabase
        .from('programs')
        .insert({ coach_id: user.id, name: programName, days_per_week: slots.length, is_template: false })
        .select().single()
      if (pErr || !prog) throw new Error(pErr?.message ?? 'Erro ao criar programa')

      // 2. Criar workouts para cada slot
      const workoutRows = slots.map(sl => ({
        coach_id:     user.id,
        name:         sl.name.trim() || (sl.dayOfWeek != null ? `${DAY_LABELS[sl.dayOfWeek]} - ${goal}` : `Treino`),
        goal,
        phase,
        muscle_group: sl.name.trim() || goal,
        duration_min: workoutType === 'circuito' ? 30 : 45,
        workout_type: workoutType,
        rounds:       workoutType === 'circuito' ? rounds : null,
      }))
      const { data: workoutsData, error: wErr } = await supabase.from('workouts').insert(workoutRows).select()
      if (wErr || !workoutsData) throw new Error(wErr?.message ?? 'Erro ao criar treinos')

      // 3. Criar exercícios para cada workout
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        const workout = (workoutsData as any[])[i]
        if (!slot.exercises.length) continue
        const exRows = slot.exercises.map((ex, j) => ({
          workout_id:            workout.id,
          name:                  ex.name,
          muscle_group:          ex.muscle,
          sets:                  workoutType === 'circuito' ? 1 : ex.sets,
          reps:                  ex.reps,
          rest_sec:              workoutType === 'circuito' ? 0 : (parseInt(ex.rest) || 60),
          sort_order:            j,
          superset_group:        ex.superset_group,
          technique:             ex.technique === 'none' ? null : ex.technique,
          prescribed_weight_kg:  ex.prescribed_weight_kg,
        }))
        await supabase.from('exercises').insert(exRows)
      }

      // 4. Criar program_slots
      const slotRows = (workoutsData as any[]).map((w, i) => ({
        program_id:  (prog as any).id,
        position:    i + 1,
        workout_id:  w.id,
        day_of_week: slots[i].dayOfWeek,
      }))
      await supabase.from('program_slots').insert(slotRows)

      // 5. Desativar programa anterior do aluno e criar nova atribuição
      await supabase.from('program_assignments').update({ active: false }).eq('student_id', studentId)
      await supabase.from('program_assignments').insert({ program_id: (prog as any).id, student_id: studentId, active: true })

      // 6. Registrar notificação para o aluno
      await supabase.from('notifications').insert({
        student_id: studentId,
        coach_id:   user.id,
        type:       'workout_published',
        message:    `Novo treino disponível: ${programName}`,
        read:       false,
      })

      setSaved(true)
      onCreated()
    } catch (err: any) {
      showToast(err.message ?? 'Erro ao publicar treino')
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  const activeSlot = slots[activeSlotIdx] ?? slots[0]

  const btnStyle = (primary = true): React.CSSProperties => ({
    height: 44, padding: '0 24px', border: primary ? 'none' : '1.5px solid #d9d3c4',
    background: primary ? '#E8542A' : '#fff', color: primary ? '#fff' : '#1B2A4A',
    borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer',
    boxShadow: primary ? '0 2px 0 #c4421e' : 'none', transition: 'opacity .1s',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,18,30,.65)', zIndex: 100, display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 680, background: '#F4EFE3', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* Top bar */}
        <div style={{ background: '#1B2A4A', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedStudent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const [bg, fg] = avatarPalette(selectedStudent.id)
                  return (
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ font: `700 11px ${FF}`, color: fg }}>{getInitials(selectedStudent.name)}</span>
                    </div>
                  )
                })()}
                <span style={{ font: `600 13px ${FF}`, color: '#FAEEDA' }}>{selectedStudent.name}</span>
              </div>
            )}
            {!selectedStudent && <span style={{ font: `700 14px ${FF}`, color: '#FAEEDA', letterSpacing: '-.2px' }}>Criar treino</span>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ background: '#1B2A4A', padding: '0 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const done = step > n
              const active = step === n
              return (
                <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ height: 3, borderRadius: 2, background: done ? '#E8542A' : active ? '#FAEEDA' : 'rgba(255,255,255,.15)', transition: 'background .2s' }} />
                  <span style={{ font: `600 9px ${FF}`, color: active ? '#FAEEDA' : done ? '#E8542A' : 'rgba(255,255,255,.3)', letterSpacing: '.3px', textTransform: 'uppercase', textAlign: 'center' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ── Step 1: Selecionar aluno ── */}
          {step === 1 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Selecionar aluno</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 18px' }}>Escolha o aluno para quem este treino será criado.</p>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input type="text" placeholder="Buscar aluno..." value={studentQuery} onChange={e => setStudentQuery(e.target.value)}
                  style={{ width: '100%', height: 42, border: '1.5px solid #d9d3c4', borderRadius: 11, background: '#fff', padding: '0 14px 0 36px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleStudents.map((s, idx) => {
                  const [bg, fg] = avatarPalette(idx)
                  const selected = s.id === studentId
                  return (
                    <button key={s.id} type="button" onClick={() => handleSelectStudent(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${selected ? '#E8542A' : '#d9d3c4'}`, background: selected ? '#fdf3ee' : '#fff', borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all .12s' }}
                      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fdf3ee' } }}
                      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.background = '#fff' } }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ font: `700 13px ${FF}`, color: fg }}>{getInitials(s.name)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{s.name}</div>
                        <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{s.goal || 'Sem objetivo definido'}</div>
                      </div>
                      {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                  )
                })}
                {visibleStudents.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>Nenhum aluno encontrado</div>}
              </div>
            </div>
          )}

          {/* ── Step 2: Objetivo e fase ── */}
          {step === 2 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Objetivo e fase</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 22px' }}>Confirme o objetivo e a fase de periodização.</p>
              <div style={{ marginBottom: 24 }}>
                <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 10 }}>Objetivo</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {GOALS.map(g => {
                    const gs = GOAL_STYLE[g]
                    const active = goal === g
                    return (
                      <button key={g} type="button" onClick={() => setGoal(g)}
                        style={{ height: 38, padding: '0 16px', border: `1.5px solid ${active ? gs.color : '#d9d3c4'}`, background: active ? gs.bg : '#fff', color: active ? gs.color : '#6b6657', font: `700 13px ${FF}`, borderRadius: 20, cursor: 'pointer', transition: 'all .12s' }}>
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 10 }}>Fase de periodização</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {PHASES.map(ph => {
                    const active = phase === ph
                    return (
                      <button key={ph} type="button" onClick={() => setPhase(ph)}
                        style={{ height: 48, border: `1.5px solid ${active ? '#E8542A' : '#d9d3c4'}`, background: active ? '#fdf3ee' : '#fff', color: active ? '#E8542A' : '#1B2A4A', font: `700 14px ${FF}`, borderRadius: 11, cursor: 'pointer', transition: 'all .12s', boxShadow: active ? '0 0 0 3px rgba(232,84,42,.1)' : 'none' }}>
                        {ph}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Tipo de treino ── */}
          {step === 3 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Tipo de treino</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 22px' }}>Escolha como o treino será estruturado.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  { type: 'standard' as WorkoutType, label: 'Padrão', desc: 'Exercícios com séries, repetições e descanso definidos. Ideal para hipertrofia, força e emagrecimento.', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/></svg> },
                  { type: 'circuito' as WorkoutType, label: 'Circuito', desc: 'Exercícios em sequência com múltiplos rounds e pouco descanso. Ideal para condicionamento e mobilidade.', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> },
                ] as const).map(({ type, label, desc, icon }) => {
                  const active = workoutType === type
                  return (
                    <button key={type} type="button" onClick={() => setWorkoutType(type)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 16, border: `2px solid ${active ? '#E8542A' : '#d9d3c4'}`, background: active ? '#fdf3ee' : '#fff', borderRadius: 14, padding: '18px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all .12s', boxShadow: active ? '0 0 0 3px rgba(232,84,42,.1)' : 'none' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 13, background: active ? '#fbe6e1' : '#f4efe3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#E8542A' : '#6b6657', flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div>
                        <div style={{ font: `800 16px ${FF}`, color: active ? '#E8542A' : '#1B2A4A', marginBottom: 5 }}>{label}</div>
                        <div style={{ font: `400 13px ${FF}`, color: '#7c7869', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                      {active && (
                        <div style={{ marginLeft: 'auto', flexShrink: 0, color: '#E8542A' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {workoutType === 'circuito' && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 10 }}>Número de rounds</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ROUNDS_OPTIONS.map(r => (
                      <button key={r} type="button" onClick={() => setRounds(r)}
                        style={{ height: 38, minWidth: 48, padding: '0 12px', border: `1.5px solid ${rounds === r ? '#E8542A' : '#d9d3c4'}`, background: rounds === r ? '#fdf3ee' : '#fff', color: rounds === r ? '#E8542A' : '#6b6657', font: `700 14px ${FF}`, borderRadius: 20, cursor: 'pointer', transition: 'all .12s' }}>
                        {r}×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Divisão de treino ── */}
          {step === 4 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Divisão de treino</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 18px' }}>Selecione os dias e nomeie cada sessão.</p>
              <div style={{ display: 'flex', gap: 7, marginBottom: 22, flexWrap: 'wrap' }}>
                {DAY_LABELS.map((label, i) => {
                  const active = slots.some(sl => sl.dayOfWeek === i)
                  return (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      style={{ height: 38, minWidth: 46, padding: '0 10px', border: `1.5px solid ${active ? '#E8542A' : '#d9d3c4'}`, background: active ? '#fdf3ee' : '#fff', color: active ? '#E8542A' : '#6b6657', font: `700 13px ${FF}`, borderRadius: 9, cursor: 'pointer', transition: 'all .12s' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {slots.length === 0 && (
                <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d9d3c4', borderRadius: 12 }}>
                  Selecione os dias de treino acima
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {slots.map(sl => (
                  <div key={sl._k} style={{ background: '#fff', border: '1.5px solid #e0d9c8', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: '#fdf3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ font: `800 12px ${FF}`, color: '#E8542A' }}>{sl.dayOfWeek != null ? DAY_LABELS[sl.dayOfWeek] : '?'}</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Nome da sessão (ex: Peito e Tríceps)"
                      value={sl.name}
                      onChange={e => updateSlot(sl._k, s => ({ ...s, name: e.target.value }))}
                      style={{ flex: 1, height: 38, border: '1.5px solid #d9d3c4', borderRadius: 8, background: '#faf7ee', padding: '0 12px', font: `600 13.5px ${FF}`, color: '#1B2A4A', outline: 'none' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Prescrever exercícios ── */}
          {step === 5 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Prescrever exercícios</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 16px' }}>Adicione os exercícios e defina séries, repetições e técnicas.</p>

              {/* Slot tabs */}
              {slots.length > 1 && (
                <div style={{ display: 'flex', gap: 0, background: '#e8e0d0', borderRadius: 10, padding: 3, marginBottom: 18, overflowX: 'auto' }}>
                  {slots.map((sl, i) => (
                    <button key={sl._k} type="button" onClick={() => setActiveSlotIdx(i)}
                      style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', font: `700 12.5px ${FF}`, whiteSpace: 'nowrap', padding: '0 12px', transition: 'all .12s', background: activeSlotIdx === i ? '#fff' : 'transparent', color: activeSlotIdx === i ? '#1B2A4A' : '#9a948a', boxShadow: activeSlotIdx === i ? '0 1px 4px rgba(27,42,74,.1)' : 'none' }}>
                      {sl.dayOfWeek != null ? DAY_LABELS[sl.dayOfWeek] : `Treino ${i + 1}`}
                      {sl.name && <span style={{ fontWeight: 400, color: activeSlotIdx === i ? '#7c7869' : '#b0a99c' }}> · {sl.name}</span>}
                    </button>
                  ))}
                </div>
              )}

              {activeSlot && (
                <div>
                  {activeSlot.exercises.length === 0 && (
                    <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d9d3c4', borderRadius: 12, marginBottom: 12 }}>
                      Nenhum exercício ainda
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {activeSlot.exercises.map((ex, i) => (
                      <ExerciseCard
                        key={ex._k}
                        ex={ex}
                        idx={i}
                        total={activeSlot.exercises.length}
                        isCircuito={workoutType === 'circuito'}
                        onUpdate={updated => updateExercise(activeSlot._k, ex._k, updated)}
                        onRemove={() => removeExercise(activeSlot._k, ex._k)}
                        onPairWithNext={() => pairWithNext(activeSlot._k, i)}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setPickerOpen(true)}
                    style={{ width: '100%', height: 42, border: '1.5px dashed #E8542A', background: '#fdf3ee', color: '#E8542A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    Adicionar exercício
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 6: Revisar e ajustar cargas ── */}
          {step === 6 && (
            <div>
              <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Revisar e ajustar</h2>
              <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 16px' }}>Defina a carga prescrita. Sugestões calculadas automaticamente com base no histórico do aluno.</p>

              {loadingSuggestions ? (
                <div style={{ padding: '40px 0', textAlign: 'center', font: `500 13px ${FF}`, color: '#9a948a' }}>
                  Calculando sugestões de progressão...
                </div>
              ) : (
                <>
                  {/* Slot tabs */}
                  {slots.length > 1 && (
                    <div style={{ display: 'flex', gap: 0, background: '#e8e0d0', borderRadius: 10, padding: 3, marginBottom: 18, overflowX: 'auto' }}>
                      {slots.map((sl, i) => (
                        <button key={sl._k} type="button" onClick={() => setActiveSlotIdx(i)}
                          style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', font: `700 12.5px ${FF}`, whiteSpace: 'nowrap', padding: '0 12px', transition: 'all .12s', background: activeSlotIdx === i ? '#fff' : 'transparent', color: activeSlotIdx === i ? '#1B2A4A' : '#9a948a', boxShadow: activeSlotIdx === i ? '0 1px 4px rgba(27,42,74,.1)' : 'none' }}>
                          {sl.dayOfWeek != null ? DAY_LABELS[sl.dayOfWeek] : `Treino ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeSlot && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeSlot.exercises.map((ex, i) => (
                        <ReviewExCard
                          key={ex._k}
                          ex={ex}
                          idx={i}
                          isCircuito={workoutType === 'circuito'}
                          onWeightChange={w => updateSlot(activeSlot._k, s => ({
                            ...s,
                            exercises: s.exercises.map(e => e._k === ex._k ? { ...e, prescribed_weight_kg: w } : e),
                          }))}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 7: Publicar ── */}
          {step === 7 && (
            <div>
              {!saved ? (
                <>
                  <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>Publicar treino</h2>
                  <p style={{ font: `400 13.5px ${FF}`, color: '#7c7869', margin: '0 0 22px' }}>Revise o resumo e publique. O aluno receberá uma notificação.</p>

                  {/* Summary */}
                  <div style={{ background: '#fff', border: '1.5px solid #e0d9c8', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                    <Row label="Aluno" value={selectedStudent?.name ?? '—'} />
                    <Row label="Objetivo" value={goal} />
                    <Row label="Fase" value={phase} />
                    <Row label="Tipo" value={workoutType === 'circuito' ? `Circuito · ${rounds} rounds` : 'Padrão'} />
                    <Row label="Sessões" value={`${slots.length} dia${slots.length !== 1 ? 's' : ''}`} />
                    <Row label="Total de exercícios" value={String(slots.reduce((acc, sl) => acc + sl.exercises.length, 0))} />
                    <div style={{ borderTop: '1px solid #f0ebe0', paddingTop: 12 }}>
                      {slots.map(sl => (
                        <div key={sl._k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          {sl.dayOfWeek != null && <span style={{ font: `700 11px ${FF}`, color: '#E8542A', background: '#fbe6e1', borderRadius: 6, padding: '2px 7px' }}>{DAY_LABELS[sl.dayOfWeek]}</span>}
                          <span style={{ font: `500 12.5px ${FF}`, color: '#1B2A4A' }}>{sl.name || 'Sem nome'}</span>
                          <span style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>· {sl.exercises.length} ex.</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => void handlePublish()} disabled={saving}
                    style={{ width: '100%', height: 50, border: 'none', background: saving ? '#d9d3c4' : '#E8542A', color: '#fff', borderRadius: 12, font: `800 15px ${FF}`, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 3px 0 #c4421e', letterSpacing: '-.2px' }}>
                    {saving ? 'Publicando...' : 'Publicar treino'}
                  </button>
                </>
              ) : (
                /* Success */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
                  <div style={{ width: 72, height: 72, borderRadius: 20, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h2 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.4px' }}>Treino publicado!</h2>
                  <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '0 0 28px', maxWidth: 320 }}>
                    {selectedStudent?.name} foi notificado e já pode acessar o treino no app.
                  </p>
                  <button onClick={onClose} style={{ height: 44, padding: '0 28px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                    Concluir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        {!(step === 7 && saved) && (
          <div style={{ padding: '16px 28px', background: '#fff', borderTop: '1px solid #e8e0d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={goBack} style={btnStyle(false)}>
              {step === 1 ? 'Cancelar' : '← Voltar'}
            </button>
            {step < 7 && (
              <button onClick={() => void goNext()} disabled={loadingSuggestions}
                style={{ ...btnStyle(true), opacity: loadingSuggestions ? 0.6 : 1, cursor: loadingSuggestions ? 'not-allowed' : 'pointer' }}>
                {step === 6 ? 'Finalizar revisão →' : 'Continuar →'}
              </button>
            )}
          </div>
        )}

        {/* Exercise picker modal */}
        {pickerOpen && activeSlot && (
          <ExPickerModal
            onAdd={ex => addExerciseToSlot(activeSlot._k, ex)}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)', zIndex: 120, background: '#1B2A4A', color: '#FAEEDA', font: `600 13px ${FF}`, padding: '12px 20px', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)', whiteSpace: 'nowrap' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helper row (step 7 summary) ──────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ font: `500 13px ${FF}`, color: '#7c7869' }}>{label}</span>
      <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{value}</span>
    </div>
  )
}
