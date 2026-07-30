import { useState, useRef, useEffect, type DragEvent } from 'react'
import { getInitials, avatarPalette } from '../../data/mock'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { EXERCISE_LIBRARY } from '../../data/exercicios'
import { useTranslation } from 'react-i18next'

const FF = '"Libre Franklin",sans-serif'

// ── Types ────────────────────────────────────────────────────
type Goal = 'Hipertrofia' | 'Emagrecimento' | 'Força' | 'Condicionamento' | 'Mobilidade'
interface SlotConfig { name: string; goal: Goal }

interface WorkoutOption {
  id: number; name: string; goal: string
  muscle_group: string | null; duration_min: number; ex_count: number
}

interface ProgramSlot {
  id: number; position: number
  workout_id: number | null; workout: WorkoutOption | null
  day_of_week: number | null
}

interface Program {
  id: number; name: string; days_per_week: number
  is_template: boolean; slots: ProgramSlot[]
  applied_count: number
}

interface Exercise { _k: number; name: string; muscle: string; scheme: string; rest: string; superset_group?: number | null }
interface LibraryExercise { name: string; muscle: string; scheme: string; rest: string }
interface Treino {
  id: number; name: string; split: string; goal: Goal
  duration: string; assigned: number; ex: Exercise[]
  workout_type?: 'standard' | 'circuito'
  rounds?: number | null
}

// ── Constants ─────────────────────────────────────────────────
const GOAL_STYLE: Record<Goal, { color: string; bg: string }> = {
  Hipertrofia:    { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:  { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:          { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento:{ color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:     { color: '#5a4ea0', bg: '#ece9f6' },
}
const GOALS = Object.keys(GOAL_STYLE) as Goal[]
const MUSCLE_CHIPS = ['Peito','Dorsal','Ombros','Bíceps','Tríceps','Quadríceps','Posterior','Glúteos','Panturrilha','Core','Corpo todo']
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const slotLabel = (pos: number) => String.fromCharCode(64 + pos)

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 90, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 22px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Program Card ──────────────────────────────────────────────
function ProgramCard({ program, onClick }: { program: Program; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      onClick={onClick}
      style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 22px rgba(27,42,74,.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {program.is_template && (
            <span style={{ font: `600 10px ${FF}`, color: '#5a4ea0', background: '#ece9f6', borderRadius: 20, padding: '4px 9px' }}>Template</span>
          )}
          <span style={{ font: `600 10px ${FF}`, color: '#1B2A4A', background: '#eef1f6', borderRadius: 20, padding: '4px 9px' }}>{program.days_per_week}×/semana</span>
        </div>
      </div>
      <div>
        <div style={{ font: `800 16.5px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', marginBottom: 6 }}>{program.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {program.slots.map(s => (
            <div key={s.position} style={{ display: 'flex', alignItems: 'center', gap: 5, background: s.workout ? '#f4efe3' : '#f9f7f3', border: `1px solid ${s.workout ? '#d6cfbe' : '#e8e2d8'}`, borderRadius: 8, padding: '4px 9px' }}>
              <span style={{ font: `800 10px ${FF}`, color: '#E8542A' }}>{t('coach_workouts.workout_slot', { slot: slotLabel(s.position) })}</span>
              {s.workout && <span style={{ font: `400 11px ${FF}`, color: '#7c7869' }}>{s.workout.name}</span>}
              {!s.workout && <span style={{ font: `400 11px ${FF}`, color: '#b0a99c' }}>{t('coach_workouts.empty_slot')}</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid #f4efe3', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{t('coach_workouts.applied_students', { count: program.applied_count })}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{program.slots.filter(s => s.workout).length}/{program.days_per_week} {t('coach_workouts.workouts_count')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Workout picker (for slot) ─────────────────────────────────
function WorkoutPickerModal({ workouts, onSelect, onClose }: {
  workouts: WorkoutOption[]; onSelect: (w: WorkoutOption) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? workouts.filter(w => w.name.toLowerCase().includes(q) || (w.goal ?? '').toLowerCase().includes(q)) : workouts

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '22px 22px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0 }}>{t('coach_workouts.pick_workout')}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('coach_workouts.search_workout_ph')}
              style={{ width: '100%', height: 38, border: '1.5px solid #e0d9c8', borderRadius: 9, background: '#faf7ee', padding: '0 12px 0 32px', font: `400 13px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
          {filtered.length === 0
            ? <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>{t('coach_workouts.no_workout_found')}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(w => {
                  const g = GOAL_STYLE[w.goal as Goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
                  return (
                    <button key={w.id} type="button" onClick={() => onSelect(w)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .1s, background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fdf3ee' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#ece7d9'; e.currentTarget.style.background = '#fff' }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ font: `800 10px ${FF}`, color: g.color }}>{w.goal.slice(0,3).toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                        <div style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>{w.muscle_group ?? w.goal} · {w.ex_count} ex. · {w.duration_min} min</div>
                      </div>
                    </button>
                  )
                })}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

// ── Apply Program Modal ────────────────────────────────────────
function ApplyProgramModal({ programName, students, onConfirm, onClose }: {
  programName: string
  students:    { id: number; name: string; goal: string }[]
  onConfirm:   (ids: number[]) => void
  onClose:     () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  function toggle(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const n = selected.size
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0 }}>{t('coach_workouts.apply_program')}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <p style={{ font: `400 12.5px ${FF}`, color: '#9a948a', margin: '0 0 16px' }}>
          <strong style={{ color: '#1B2A4A' }}>{programName}</strong> — {t('coach_workouts.select_students_hint')}
        </p>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {students.length === 0 && (
            <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>{t('coach_workouts.no_students')}</div>
          )}
          {students.map(s => {
            const sel = selected.has(s.id)
            const pal = avatarPalette(s.id)
            return (
              <button key={s.id} type="button" onClick={() => toggle(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${sel ? '#E8542A' : '#ece7d9'}`, background: sel ? '#fdf3ee' : '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                  {getInitials(s.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>{s.goal}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? '#E8542A' : '#d2cbbb'}`, background: sel ? '#E8542A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" style={{ opacity: sel ? 1 : 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => { if (n) onConfirm(Array.from(selected)) }}
          disabled={n === 0}
          style={{ marginTop: 16, width: '100%', height: 46, border: 'none', background: n ? '#E8542A' : '#e0d9c8', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: n ? 'pointer' : 'default', boxShadow: n ? '0 2px 0 #c4421e' : 'none' }}>
          {n ? t('coach_workouts.apply_to_students', { count: n }) : t('coach_workouts.select_students_btn')}
        </button>
      </div>
    </div>
  )
}

// ── Create Workout Modal (dentro do programa) ──────────────────
function CreateWorkoutModal({ library, onClose, onCreated }: {
  library:   LibraryExercise[]
  onClose:   () => void
  onCreated: (wo: WorkoutOption, t: Treino) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [name,       setName]       = useState('')
  const [goal,       setGoal]       = useState<Goal>('Hipertrofia')
  const [exercises,  setExercises]  = useState<Exercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exModal,    setExModal]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const nextK = useRef(Date.now())

  function addEx(data: Omit<Exercise, '_k'>) {
    setExercises(p => [...p, { ...data, _k: nextK.current++ }])
  }

  async function handleSave() {
    if (!name.trim()) { setErr(t('coach_workouts.err_no_workout_name')); return }
    if (!user?.id) return
    setSaving(true)
    const { data: w, error } = await supabase
      .from('workouts')
      .insert({ coach_id: user.id, name: name.trim(), goal, muscle_group: goal + ' · Novo', duration_min: 45 })
      .select().single()
    if (error || !w) { setSaving(false); setErr(t('coach_workouts.err_create_workout')); return }
    if (exercises.length > 0) {
      const scheme = (ex: Exercise) => { const m = ex.scheme.match(/^(\d+)\s*[×x]\s*(.+)$/); return m ? { sets: parseInt(m[1]), reps: m[2].trim() } : { sets: 3, reps: ex.scheme } }
      await supabase.from('exercises').insert(exercises.map((ex, i) => {
        const { sets, reps } = scheme(ex)
        return { workout_id: (w as any).id, name: ex.name, muscle_group: ex.muscle, sets, reps, rest_sec: parseInt(ex.rest) || 60, sort_order: i }
      }))
    }
    const wo: WorkoutOption = { id: (w as any).id, name: (w as any).name, goal, muscle_group: (w as any).muscle_group, duration_min: 45, ex_count: exercises.length }
    const treino: Treino    = { id: (w as any).id, name: (w as any).name, split: (w as any).muscle_group, goal, duration: '45 min', assigned: 0, ex: exercises }
    setSaving(false)
    onCreated(wo, treino)
  }

  const gs = GOAL_STYLE[goal]
  const GOAL_LABELS: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_hypertrophy'), Emagrecimento: t('coach_workouts.goal_weight_loss'),
    Força: t('coach_workouts.goal_strength'), Condicionamento: t('coach_workouts.goal_conditioning'), Mobilidade: t('coach_workouts.goal_mobility'),
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.65)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.38)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '24px 26px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>{t('coach_workouts.create_workout')}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Nome */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.workout_name')}</label>
            <input
              autoFocus type="text" placeholder="Ex: Peito e Tríceps" value={name}
              onChange={e => { setName(e.target.value); setErr('') }}
              style={{ width: '100%', height: 44, border: `1.5px solid ${err ? '#c4421e' : '#d9d3c4'}`, borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' as const }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
              onBlur={e => { e.currentTarget.style.borderColor = err ? '#c4421e' : '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginTop: 5 }}>{err}</div>}
          </div>

          {/* Objetivo */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>{t('coach_workouts.objective')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {GOALS.map(g => {
                const s = GOAL_STYLE[g]
                return (
                  <button key={g} type="button" onClick={() => setGoal(g)}
                    style={{ border: `1.5px solid ${goal === g ? s.color : '#e0d9c8'}`, background: goal === g ? s.color : '#fff', color: goal === g ? '#fff' : '#7c7869', font: `600 12px ${FF}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer' }}>
                    {GOAL_LABELS[g]}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 10 }}>
            {t('coach_workouts.exercises_optional_label')} <span style={{ color: '#c9c1b0', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— {t('coach_workouts.optional')}</span>
          </div>
        </div>

        {/* Lista de exercícios */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px', minHeight: 0 }}>
          {exercises.length === 0 && (
            <div style={{ padding: '14px 0', font: `400 13px ${FF}`, color: '#a89f8e', textAlign: 'center' }}>{t('coach_workouts.no_exercises_added')}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map((ex, i) => (
              <div key={ex._k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#faf7ee', border: '1px solid #e0d9c8', borderRadius: 11, padding: '10px 12px' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: gs.bg, color: gs.color, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 10px ${FF}`, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                  <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{ex.muscle} · {ex.scheme} · desc. {ex.rest}</div>
                </div>
                <button type="button" onClick={() => setExercises(p => p.filter(e => e._k !== ex._k))}
                  style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: '#b0a99c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#c4421e'; e.currentTarget.style.background = '#fbe6e1' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#b0a99c'; e.currentTarget.style.background = 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPickerOpen(true)}
            style={{ width: '100%', border: '1.5px dashed #d8d1c0', background: 'none', color: '#9a948a', borderRadius: 10, padding: '10px 0', font: `600 12.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '10px 0 20px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#9a948a' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            {t('coach_workouts.add_exercise')}
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 26px 24px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ width: '100%', height: 48, border: 'none', background: saving ? '#e0d9c8' : '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 0 #c4421e' }}>
            {saving ? t('coach_workouts.creating') : t('coach_workouts.create_and_add_slot')}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <ExercisePickerModal
          library={library}
          onSelect={d => { addEx(d); setPickerOpen(false) }}
          onCreateNew={() => { setPickerOpen(false); setExModal(true) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {exModal && (
        <NewExerciseModal
          onClose={() => setExModal(false)}
          onAdd={d => { addEx(d); setExModal(false) }}
        />
      )}
    </div>
  )
}

// ── Program Builder Drawer ─────────────────────────────────────
function ProgramBuilderDrawer({ program, workouts, library, onClose, onUpdate, onApply, onDelete, onWorkoutCreated }: {
  program:          Program
  workouts:         WorkoutOption[]
  library:          LibraryExercise[]
  onClose:          () => void
  onUpdate:         (p: Program) => void
  onApply:          () => void
  onDelete:         () => void
  onWorkoutCreated: (wo: WorkoutOption, t: Treino) => void
}) {
  const { t } = useTranslation()
  const DAYS_T = [
    t('coach_workouts.day_sun'), t('coach_workouts.day_mon'), t('coach_workouts.day_tue'),
    t('coach_workouts.day_wed'), t('coach_workouts.day_thu'), t('coach_workouts.day_fri'), t('coach_workouts.day_sat'),
  ]
  const [slots, setSlots] = useState<ProgramSlot[]>(program.slots)
  const [pickerSlot,   setPickerSlot]   = useState<number | null>(null)
  const [createSlot,   setCreateSlot]   = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [renamingName, setRenamingName] = useState(false)
  const [draftName, setDraftName] = useState(program.name)
  const savingRef = useRef<Record<number, boolean>>({})

  useEffect(() => { setSlots(program.slots) }, [program.id])
  useEffect(() => { setDraftName(program.name) }, [program.id])

  async function handleRenameProgram() {
    const name = draftName.trim()
    setRenamingName(false)
    if (!name || name === program.name) return
    await supabase.from('programs').update({ name }).eq('id', program.id)
    onUpdate({ ...program, name })
  }

  async function assignWorkout(position: number, workout: WorkoutOption) {
    const slot = slots.find(s => s.position === position)!
    if (savingRef.current[slot.id]) return
    savingRef.current[slot.id] = true
    await supabase.from('program_slots').update({ workout_id: workout.id }).eq('id', slot.id)
    savingRef.current[slot.id] = false
    const updated = slots.map(s => s.position === position ? { ...s, workout_id: workout.id, workout } : s)
    setSlots(updated)
    onUpdate({ ...program, slots: updated })
    setPickerSlot(null)
  }

  async function removeWorkout(position: number) {
    const slot = slots.find(s => s.position === position)!
    await supabase.from('program_slots').update({ workout_id: null }).eq('id', slot.id)
    const updated = slots.map(s => s.position === position ? { ...s, workout_id: null, workout: null } : s)
    setSlots(updated)
    onUpdate({ ...program, slots: updated })
  }

  async function setDay(position: number, day: number | null) {
    const slot = slots.find(s => s.position === position)!
    await supabase.from('program_slots').update({ day_of_week: day }).eq('id', slot.id)
    const updated = slots.map(s => s.position === position ? { ...s, day_of_week: day } : s)
    setSlots(updated)
    onUpdate({ ...program, slots: updated })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '95vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '24px 24px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {program.is_template && <span style={{ font: `600 10px ${FF}`, color: '#c9b8f5', background: 'rgba(90,78,160,.35)', borderRadius: 20, padding: '3px 9px' }}>Template</span>}
                <span style={{ font: `600 10px ${FF}`, color: '#aeb9cc', background: 'rgba(255,255,255,.12)', borderRadius: 20, padding: '3px 9px' }}>{program.days_per_week}×/semana</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {renamingName ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleRenameProgram(); if (e.key === 'Escape') { setRenamingName(false); setDraftName(program.name) } }}
                    onBlur={() => void handleRenameProgram()}
                    style={{ flex: 1, font: `800 20px ${FF}`, color: '#fff', background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 8, padding: '4px 10px', outline: 'none', letterSpacing: '-.4px' }}
                  />
                ) : (
                  <h2 style={{ font: `800 22px ${FF}`, color: '#fff', margin: 0, letterSpacing: '-.4px' }}>{program.name}</h2>
                )}
                {!renamingName && (
                  <button type="button" onClick={() => { setRenamingName(true); setDraftName(program.name) }}
                    style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: 'rgba(255,255,255,.55)', width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.2)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'rgba(255,255,255,.55)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
              </div>
              <div style={{ font: `400 12.5px ${FF}`, color: '#aeb9cc', marginTop: 5 }}>
                {t('coach_workouts.slots_filled', { count: slots.filter(s => s.workout).length, total: program.days_per_week })}
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Slots */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {slots.map(slot => {
            const g = slot.workout ? (GOAL_STYLE[slot.workout.goal as Goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }) : null
            return (
              <div key={slot.position}>
                {/* Slot header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 13px ${FF}`, color: '#fff' }}>
                      {slotLabel(slot.position)}
                    </div>
                    <span style={{ font: `700 12px ${FF}`, color: '#1B2A4A', textTransform: 'uppercase', letterSpacing: '.4px' }}>{t('coach_workouts.workout_slot', { slot: slotLabel(slot.position) })}</span>
                  </div>
                  {/* Day picker */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {DAYS_T.map((d, i) => {
                      const active = slot.day_of_week === i
                      return (
                        <button key={i} type="button" onClick={() => setDay(slot.position, active ? null : i)}
                          style={{ width: 30, height: 26, border: `1.5px solid ${active ? '#E8542A' : '#d9d3c4'}`, background: active ? '#E8542A' : '#fff', color: active ? '#fff' : '#7c7869', font: `700 10px ${FF}`, borderRadius: 6, cursor: 'pointer' }}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Slot body */}
                {slot.workout && g ? (
                  <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ font: `800 9px ${FF}`, color: g.color }}>{slot.workout.goal.slice(0,3).toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.workout.name}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                          {slot.workout.muscle_group ?? slot.workout.goal} · {slot.workout.ex_count} ex. · {slot.workout.duration_min} min
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button type="button" onClick={() => setPickerSlot(slot.position)}
                          style={{ height: 32, padding: '0 12px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12px ${FF}`, cursor: 'pointer' }}>
                          {t('coach_workouts.swap')}
                        </button>
                        <button type="button" onClick={() => removeWorkout(slot.position)}
                          style={{ width: 32, height: 32, border: '1.5px solid #e0d9c8', background: '#fff', color: '#a89f8e', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4421e'; e.currentTarget.style.color = '#c4421e' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#a89f8e' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setCreateSlot(slot.position)}
                      style={{ flex: 1, height: 52, border: '2px dashed #E8542A', background: '#fdf3ee', color: '#E8542A', borderRadius: 12, font: `700 12.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fbe4d8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fdf3ee' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      {t('coach_workouts.create_workout')}
                    </button>
                    <button type="button" onClick={() => setPickerSlot(slot.position)}
                      style={{ flex: 1, height: 52, border: '1.5px solid #d8d1c0', background: '#fff', color: '#7c7869', borderRadius: 12, font: `600 12.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#7c7869' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                      {t('coach_workouts.from_library')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '14px 24px 20px', background: '#fff', borderTop: '1px solid #ece7d9' }}>
          {deleteConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ font: `600 13px ${FF}`, color: '#c4421e', textAlign: 'center' }}>{t('coach_workouts.delete_confirm', { name: program.name })}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, height: 44, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer' }}>{t('coach_workouts.cancel')}</button>
                <button onClick={onDelete} style={{ flex: 1, height: 44, border: 'none', background: '#c4421e', color: '#fff', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer' }}>{t('coach_workouts.confirm_delete')}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setDeleteConfirm(true)}
                style={{ width: 46, height: 46, border: '1.5px solid #e0d9c8', background: '#fff', color: '#a89f8e', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4421e'; e.currentTarget.style.color = '#c4421e' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#a89f8e' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
              <button type="button" onClick={onApply}
                style={{ flex: 1, height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
                {t('coach_workouts.apply_to_student')}
              </button>
            </div>
          )}
        </div>
      </div>

      {pickerSlot !== null && (
        <WorkoutPickerModal
          workouts={workouts}
          onSelect={w => assignWorkout(pickerSlot, w)}
          onClose={() => setPickerSlot(null)}
        />
      )}
      {createSlot !== null && (
        <CreateWorkoutModal
          library={library}
          onClose={() => setCreateSlot(null)}
          onCreated={(wo, t) => {
            onWorkoutCreated(wo, t)
            assignWorkout(createSlot, wo)
            setCreateSlot(null)
          }}
        />
      )}
    </>
  )
}

// ── New Program Modal (2-step wizard) ─────────────────────────
const GOAL_SHORT: Record<Goal, string> = {
  Hipertrofia: 'Hip', Emagrecimento: 'Ema', Força: 'For', Condicionamento: 'Con', Mobilidade: 'Mob',
}

function NewProgramModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd:   (name: string, daysPerWeek: number, isTemplate: boolean, slots: SlotConfig[]) => void
}) {
  const { t } = useTranslation()
  const GOAL_LABELS: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_hypertrophy'), Emagrecimento: t('coach_workouts.goal_weight_loss'),
    Força: t('coach_workouts.goal_strength'), Condicionamento: t('coach_workouts.goal_conditioning'), Mobilidade: t('coach_workouts.goal_mobility'),
  }
  const GOAL_SHORT_T: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_short_hyp'), Emagrecimento: t('coach_workouts.goal_short_ema'),
    Força: t('coach_workouts.goal_short_for'), Condicionamento: t('coach_workouts.goal_short_con'), Mobilidade: t('coach_workouts.goal_short_mob'),
  }
  const [step,       setStep]       = useState<1 | 2>(1)
  const [name,       setName]       = useState('')
  const [days,       setDays]       = useState(3)
  const [isTemplate, setIsTemplate] = useState(false)
  const [slots,      setSlots]      = useState<SlotConfig[]>(() =>
    Array.from({ length: 3 }, (_, i) => ({ name: `Treino ${BLOCK_LETTERS[i]}`, goal: 'Hipertrofia' as Goal }))
  )
  const [err, setErr] = useState('')

  function handleDaysChange(d: number) {
    setDays(d)
    setSlots(prev => Array.from({ length: d }, (_, i) => prev[i] ?? { name: `Treino ${BLOCK_LETTERS[i]}`, goal: 'Hipertrofia' as Goal }))
  }

  function updateSlot(i: number, patch: Partial<SlotConfig>) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function goNext() {
    if (!name.trim()) { setErr(t('coach_workouts.err_no_program_name')); return }
    setErr('')
    setStep(2)
  }

  const inp: React.CSSProperties = { width: '100%', height: 40, border: '1.5px solid #d9d3c4', borderRadius: 9, background: '#fff', padding: '0 12px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

        {/* Header */}
        <div style={{ padding: '24px 26px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>
                {step === 1 ? t('coach_workouts.new_program') : t('coach_workouts.configure_workouts')}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                {([1, 2] as const).map(s => (
                  <div key={s} style={{ height: 4, width: s === step ? 22 : 12, borderRadius: 2, background: s <= step ? '#E8542A' : '#e0d9c8', transition: 'all .2s' }} />
                ))}
                <span style={{ font: `500 11px ${FF}`, color: '#b0a99c', marginLeft: 2 }}>{t('coach_workouts.step_of', { step, total: 2 })}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2, marginTop: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ padding: '20px 26px 26px', overflowY: 'auto' }}>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.program_name')}</label>
            <input autoFocus type="text" placeholder="Ex: Hipertrofia 3×, Iniciante Full Body…" value={name}
              onChange={e => { setName(e.target.value); setErr('') }}
              style={{ ...inp, height: 46, font: `400 14px ${FF}`, border: `1.5px solid ${err ? '#c4421e' : '#d9d3c4'}`, marginBottom: err ? 6 : 20 }}
              onFocus={focusOn} onBlur={focusOff}
            />
            {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginBottom: 14 }}>{err}</div>}

            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 10 }}>{t('coach_workouts.workouts_per_week')}</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[2, 3, 4, 5, 6].map(d => (
                <button key={d} type="button" onClick={() => handleDaysChange(d)}
                  style={{ flex: 1, height: 44, border: `1.5px solid ${days === d ? '#E8542A' : '#d9d3c4'}`, background: days === d ? '#E8542A' : '#fff', color: days === d ? '#fff' : '#7c7869', font: `700 15px ${FF}`, borderRadius: 10, cursor: 'pointer' }}>
                  {d}×
                </button>
              ))}
            </div>

            <button type="button" onClick={() => setIsTemplate(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${isTemplate ? '#5a4ea0' : '#d9d3c4'}`, background: isTemplate ? '#ece9f6' : '#fff', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', marginBottom: 24 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isTemplate ? '#5a4ea0' : '#d2cbbb'}`, background: isTemplate ? '#5a4ea0' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" style={{ opacity: isTemplate ? 1 : 0 }}><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{t('coach_workouts.save_as_template')}</div>
                <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{t('coach_workouts.template_hint')}</div>
              </div>
            </button>

            <button type="button" onClick={goNext}
              style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {t('coach_workouts.configure_workouts')}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <div style={{ padding: '8px 26px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f4efe3', borderRadius: 10, marginTop: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                <span style={{ font: `600 12px ${FF}`, color: '#7c6030' }}>{name}</span>
                <span style={{ font: `400 12px ${FF}`, color: '#b0a99c', marginLeft: 'auto' }}>{days}×/semana</span>
              </div>
              <div style={{ font: `500 12px ${FF}`, color: '#9a948a', marginTop: 12, marginBottom: 6 }}>
                Nomeie cada treino e escolha o objetivo — você adiciona os exercícios depois.
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 26px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {slots.map((slot, i) => {
                const gs = GOAL_STYLE[slot.goal]
                return (
                  <div key={i} style={{ background: '#faf7f2', border: '1px solid #e8e2d8', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 13px ${FF}`, color: '#fff', flexShrink: 0 }}>
                        {BLOCK_LETTERS[i]}
                      </div>
                      <input
                        type="text"
                        placeholder={`Ex: Peito e Tríceps`}
                        value={slot.name}
                        onChange={e => updateSlot(i, { name: e.target.value })}
                        style={inp}
                        onFocus={focusOn}
                        onBlur={focusOff}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 5, paddingLeft: 40, flexWrap: 'wrap' }}>
                      {GOALS.map(g => {
                        const s = GOAL_STYLE[g]
                        const active = slot.goal === g
                        return (
                          <button key={g} type="button" onClick={() => updateSlot(i, { goal: g })}
                            style={{ border: `1.5px solid ${active ? s.color : '#ddd7cb'}`, background: active ? s.color : '#fff', color: active ? '#fff' : '#7c7869', font: `700 10.5px ${FF}`, borderRadius: 16, padding: '4px 9px', cursor: 'pointer' }}>
                            {GOAL_SHORT_T[g]}
                          </button>
                        )
                      })}
                      <span style={{ font: `400 11px ${FF}`, color: gs.color, background: gs.bg, borderRadius: 16, padding: '4px 9px', marginLeft: 4 }}>{GOAL_LABELS[slot.goal]}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '14px 26px 24px', flexShrink: 0, borderTop: '1px solid #f0ebe0' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ height: 48, padding: '0 18px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>
                  {t('coach_workouts.back')}
                </button>
                <button type="button" onClick={() => onAdd(name.trim(), days, isTemplate, slots)}
                  style={{ flex: 1, height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                  {t('coach_workouts.create_program', { count: days })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Biblioteca components (existing, kept intact) ────────────
function ExRow({ ex, order, tagBg, tagColor, dragOverId, supersetLetter, onEdit, onDelete, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: {
  ex: { _k: number; name: string; muscle: string; scheme: string; rest: string; superset_group?: number | null }
  order: number; tagBg: string; tagColor: string; dragOverId: number | null
  supersetLetter?: 'A' | 'B'
  onEdit:      (k: number) => void
  onDelete:    (k: number) => void
  onDragStart: (e: DragEvent<HTMLDivElement>, k: number) => void
  onDragEnd:   (e: DragEvent<HTMLDivElement>) => void
  onDragOver:  (e: DragEvent<HTMLDivElement>, k: number) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop:      (e: DragEvent<HTMLDivElement>, k: number) => void
}) {
  const isOver = dragOverId === ex._k
  const isSS = supersetLetter != null
  return (
    <div draggable onDragStart={e => onDragStart(e, ex._k)} onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, ex._k)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, ex._k)}
      style={{ background: isOver ? '#fdf3ee' : '#fff', boxShadow: isOver ? 'inset 0 0 0 2px #E8542A' : 'none', borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab',
        borderTop:    isSS ? '1px solid rgba(232,84,42,.22)' : '1px solid #ece7d9',
        borderRight:  isSS ? '1px solid rgba(232,84,42,.22)' : '1px solid #ece7d9',
        borderBottom: isSS ? '1px solid rgba(232,84,42,.22)' : '1px solid #ece7d9',
        borderLeft:   isSS ? '3px solid #E8542A'              : '1px solid #ece7d9',
      }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9c1b0" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
        <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
      </svg>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: tagBg, color: tagColor, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 10px ${FF}`, flexShrink: 0 }}>{order}</div>
      {supersetLetter && (
        <div style={{ background: '#fdf3ee', border: '1px solid rgba(232,84,42,.4)', borderRadius: 6, padding: '2px 6px', font: `800 8px ${FF}`, color: '#E8542A', flexShrink: 0, letterSpacing: '.5px' }}>
          SS·{supersetLetter}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
        <div style={{ font: `500 11px ${FF}`, color: '#9a948a', marginTop: 2 }}>{ex.muscle}</div>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onEdit(ex._k) }}
        style={{ width: 28, height: 28, border: '1px solid #e0d9c8', background: '#fff', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#9a948a' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#9a948a' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(ex._k) }}
        style={{ width: 28, height: 28, border: '1px solid #e0d9c8', background: '#fff', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#9a948a' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4421e'; e.currentTarget.style.color = '#c4421e'; e.currentTarget.style.background = '#fbe6e1' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#9a948a'; e.currentTarget.style.background = '#fff' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ font: `800 13px ${FF}`, color: '#1B2A4A' }}>{ex.scheme}</div>
        <div style={{ font: `500 10px ${FF}`, color: '#b0a99c' }}>desc. {ex.rest}</div>
      </div>
    </div>
  )
}

function NewExerciseModal({ onClose, onAdd }: { onClose: () => void; onAdd: (ex: Omit<Exercise, '_k'>) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [series, setSeries] = useState('3')
  const [reps, setReps] = useState('12')
  const [rest, setRest] = useState('60s')
  const [err, setErr] = useState('')
  const inp: React.CSSProperties = { width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }
  const num: React.CSSProperties = { ...inp, font: `700 15px ${FF}`, textAlign: 'center' }
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(0,0,0,.35)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0 }}>{t('coach_workouts.new_exercise')}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.exercise_name')}</label>
        <input type="text" value={name} placeholder="Ex: Supino reto com barra" onChange={e => { setName(e.target.value); setErr('') }} onFocus={focusOn} onBlur={focusOff}
          style={{ ...inp, border: `1.5px solid ${err ? '#c4421e' : '#d9d3c4'}`, marginBottom: err ? 6 : 18 }} />
        {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginBottom: 14 }}>{err}</div>}
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>{t('coach_workouts.muscle_group')}</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {MUSCLE_CHIPS.map(m => (
            <button key={m} type="button" onClick={() => setMuscle(m)}
              style={{ border: `1.5px solid ${muscle === m ? '#E8542A' : '#e0d9c8'}`, background: muscle === m ? '#fdf3ee' : '#fff', color: muscle === m ? '#E8542A' : '#7c7869', font: `600 11px ${FF}`, borderRadius: 18, padding: '5px 11px', cursor: 'pointer' }}>{m}</button>
          ))}
        </div>
        <input type="text" value={muscle} placeholder="Ou escreva um grupo personalizado…" onChange={e => setMuscle(e.target.value)} onFocus={focusOn} onBlur={focusOff}
          style={{ ...inp, height: 42, font: `400 13px ${FF}`, marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: 12, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.sets')}</label>
            <input type="text" value={series} onChange={e => setSeries(e.target.value)} onFocus={focusOn} onBlur={focusOff} style={num} />
          </div>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.reps_duration')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: `700 18px ${FF}`, color: '#c9c1b0' }}>×</span>
              <input type="text" value={reps} onChange={e => setReps(e.target.value)} onFocus={focusOn} onBlur={focusOff} placeholder="12 ou 30s" style={{ ...num, flex: 1, width: 'auto' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.rest')}</label>
            <input type="text" value={rest} onChange={e => setRest(e.target.value)} onFocus={focusOn} onBlur={focusOff} placeholder="60s" style={num} />
          </div>
        </div>
        <button type="button" onClick={() => { if (!name.trim()) { setErr(t('coach_workouts.err_no_exercise_name')); return } onAdd({ name: name.trim(), muscle: muscle.trim() || '—', scheme: `${series.trim()||'3'} × ${reps.trim()||'12'}`, rest: rest.trim() || '60s' }) }}
          style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
          {t('coach_workouts.add_exercise')}
        </button>
      </div>
    </div>
  )
}

function ExercisePickerModal({ library, onSelect, onCreateNew, onClose }: {
  library: LibraryExercise[]; onSelect: (ex: Omit<Exercise, '_k'>) => void; onCreateNew: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? library.filter(ex => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q)) : library
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '22px 22px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0 }}>{t('coach_workouts.add_exercise')}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('coach_workouts.search_exercise_ph')}
              style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#faf7ee', padding: '0 14px 0 34px', font: `400 13px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px', minHeight: 0 }}>
          {filtered.length === 0
            ? <div style={{ padding: '28px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>{t('coach_workouts.no_exercise_found')}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
                {filtered.map((ex, i) => (
                  <button key={i} type="button" onClick={() => onSelect(ex)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fdf3ee' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#ece7d9'; e.currentTarget.style.background = '#fff' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                      <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{ex.muscle}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>{ex.scheme}</div>
                      <div style={{ font: `500 10px ${FF}`, color: '#b0a99c' }}>desc. {ex.rest}</div>
                    </div>
                  </button>
                ))}
              </div>
          }
        </div>
        <div style={{ padding: '14px 22px 20px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          <button type="button" onClick={onCreateNew}
            style={{ width: '100%', height: 46, border: '1.5px dashed #d8d1c0', background: 'none', color: '#7c7869', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#7c7869' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            {t('coach_workouts.create_new_exercise')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Exercise Modal ───────────────────────────────────────
function EditExerciseModal({ ex, initSets, initReps, initRest, onClose, onSave }: {
  ex: { name: string; muscle: string }
  initSets: string; initReps: string; initRest: string
  onClose: () => void
  onSave: (scheme: string, rest: string) => void
}) {
  const { t } = useTranslation()
  const [sets, setSets] = useState(initSets)
  const [reps, setReps] = useState(initReps)
  const [rest, setRest] = useState(initRest)
  const inp: React.CSSProperties = { height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 12px', font: `700 15px ${FF}`, color: '#1B2A4A', outline: 'none', textAlign: 'center', boxSizing: 'border-box' as const }
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ font: `800 17px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.3px' }}>{ex.name}</h2>
            <div style={{ font: `500 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>{ex.muscle}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', font: `600 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{t('coach_workouts.sets')}</label>
            <input type="number" min="1" max="20" value={sets} onChange={e => setSets(e.target.value)} onFocus={focusOn} onBlur={focusOff} style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', font: `600 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{t('coach_workouts.reps_time')}</label>
            <input type="text" placeholder="12" value={reps} onChange={e => setReps(e.target.value)} onFocus={focusOn} onBlur={focusOff} style={{ ...inp, width: '100%' }} />
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', font: `600 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{t('coach_workouts.rest')}</label>
          <input type="text" placeholder="60s" value={rest} onChange={e => setRest(e.target.value)} onFocus={focusOn} onBlur={focusOff} style={{ ...inp, width: '100%', textAlign: 'left', padding: '0 14px' }} />
        </div>
        <button type="button"
          onClick={() => onSave(`${sets} × ${reps}`, rest)}
          style={{ width: '100%', height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
          {t('coach_workouts.save')}
        </button>
      </div>
    </div>
  )
}

function TreinoDrawer({ treino, library, onClose, onDuplicate, onUpdate, onAddToLibrary, onDelete }: {
  treino: Treino; library: LibraryExercise[]; onClose: () => void
  onDuplicate: () => void; onUpdate: (t: Treino) => void
  onAddToLibrary: (ex: LibraryExercise) => void; onDelete: () => void
}) {
  const { t } = useTranslation()
  const GOAL_LABELS: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_hypertrophy'), Emagrecimento: t('coach_workouts.goal_weight_loss'),
    Força: t('coach_workouts.goal_strength'), Condicionamento: t('coach_workouts.goal_conditioning'), Mobilidade: t('coach_workouts.goal_mobility'),
  }
  const g = GOAL_STYLE[treino.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
  const [exercises, setExercises] = useState<Exercise[]>(treino.ex)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exModalOpen, setExModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editExKey, setEditExKey] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const nextK = useRef(Date.now())
  const nextSupersetGroupRef = useRef<number>(
    (() => {
      const groups = treino.ex.filter(e => e.superset_group != null).map(e => e.superset_group as number)
      return groups.length > 0 ? Math.max(...groups) + 1 : 1
    })()
  )
  const [localRounds, setLocalRounds] = useState(treino.rounds ?? 3)
  const [circuitPickerOpen, setCircuitPickerOpen] = useState(false)
  useEffect(() => { setExercises(treino.ex) }, [treino.id])
  useEffect(() => { setLocalRounds(treino.rounds ?? 3) }, [treino.id])
  const [renamingName, setRenamingName] = useState(false)
  const [draftName, setDraftName] = useState(treino.name)
  useEffect(() => { setDraftName(treino.name) }, [treino.id])

  async function handleRenameTreino() {
    const name = draftName.trim()
    setRenamingName(false)
    if (!name || name === treino.name) return
    await supabase.from('workouts').update({ name }).eq('id', treino.id)
    onUpdate({ ...treino, name })
  }

  async function handleUpdateRounds(r: number) {
    setLocalRounds(r)
    await supabase.from('workouts').update({ rounds: r }).eq('id', treino.id)
    onUpdate({ ...treino, rounds: r })
  }

  function handleSaveEdit(k: number, scheme: string, rest: string) {
    const updated = exercises.map(ex => ex._k === k ? { ...ex, scheme, rest } : ex)
    setExercises(updated)
    onUpdate({ ...treino, ex: updated })
    setEditExKey(null)
  }
  function toggleSuperset(kA: number, kB: number) {
    const exA = exercises.find(e => e._k === kA)
    const exB = exercises.find(e => e._k === kB)
    if (!exA || !exB) return
    const arePaired = exA.superset_group != null && exA.superset_group === exB.superset_group
    let updated: Exercise[]
    if (arePaired) {
      updated = exercises.map(e => (e._k === kA || e._k === kB) ? { ...e, superset_group: null } : e)
    } else {
      const group = nextSupersetGroupRef.current++
      updated = exercises.map(e => (e._k === kA || e._k === kB) ? { ...e, superset_group: group } : e)
    }
    setExercises(updated)
    onUpdate({ ...treino, ex: updated })
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, k: number) { dragRef.current = k; try { e.dataTransfer.effectAllowed = 'move' } catch {}; e.currentTarget.style.opacity = '0.5' }
  function handleDragEnd(e: DragEvent<HTMLDivElement>) { e.currentTarget.style.opacity = '1'; setDragOver(null); dragRef.current = null }
  function handleDragOver(e: DragEvent<HTMLDivElement>, k: number) { e.preventDefault(); if (dragOver !== k) setDragOver(k) }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }
  function handleDrop(e: DragEvent<HTMLDivElement>, targetK: number) {
    e.preventDefault(); setDragOver(null)
    const fromK = dragRef.current; if (!fromK || fromK === targetK) return
    const arr = [...exercises]
    const from = arr.findIndex(x => x._k === fromK), to = arr.findIndex(x => x._k === targetK)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    setExercises(arr); onUpdate({ ...treino, ex: arr })
  }
  function handleAddEx(data: Omit<Exercise, '_k'>) {
    const ex: Exercise = { ...data, _k: nextK.current++ }
    const updated = [...exercises, ex]; setExercises(updated); onUpdate({ ...treino, ex: updated })
    onAddToLibrary({ name: data.name, muscle: data.muscle, scheme: data.scheme, rest: data.rest }); setExModalOpen(false)
  }
  function handlePickEx(data: Omit<Exercise, '_k'>) {
    const ex: Exercise = { ...data, _k: nextK.current++ }
    const updated = [...exercises, ex]; setExercises(updated); onUpdate({ ...treino, ex: updated }); setPickerOpen(false)
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 60 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '94vw', background: '#F4EFE3', zIndex: 61, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1B2A4A', padding: '24px 24px 22px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
          {treino.workout_type === 'circuito'
            ? <span style={{ font: `700 11px ${FF}`, color: '#b06a12', background: '#f7ecd9', borderRadius: 20, padding: '5px 11px', letterSpacing: '.3px' }}>CIRCUITO</span>
            : <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '5px 11px' }}>{GOAL_LABELS[treino.goal]}</span>
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '13px 0 5px' }}>
            {renamingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleRenameTreino(); if (e.key === 'Escape') { setRenamingName(false); setDraftName(treino.name) } }}
                onBlur={() => void handleRenameTreino()}
                style={{ flex: 1, font: `800 20px ${FF}`, color: '#fff', background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 8, padding: '4px 10px', outline: 'none', letterSpacing: '-.4px' }}
              />
            ) : (
              <h2 style={{ font: `800 22px ${FF}`, color: '#fff', margin: 0, letterSpacing: '-.4px' }}>{treino.name}</h2>
            )}
            {!renamingName && (
              <button type="button" onClick={() => { setRenamingName(true); setDraftName(treino.name) }}
                style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: 'rgba(255,255,255,.55)', width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.2)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'rgba(255,255,255,.55)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
          {treino.workout_type === 'circuito' ? (
            <>
              <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc', marginBottom: 10 }}>{exercises.length} {t('coach_workouts.exercises_count')}</div>
              <div>
                <div style={{ font: `600 10px ${FF}`, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 7 }}>{t('coach_workouts.rounds')}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[2, 3, 4, 5, 6, 8, 10].map(r => (
                    <button key={r} type="button" onClick={() => void handleUpdateRounds(r)}
                      style={{ height: 30, minWidth: 36, padding: '0 8px', border: `1.5px solid ${localRounds === r ? '#E8542A' : 'rgba(255,255,255,.18)'}`, background: localRounds === r ? '#E8542A' : 'rgba(255,255,255,.07)', color: localRounds === r ? '#fff' : 'rgba(255,255,255,.65)', font: `700 11px ${FF}`, borderRadius: 7, cursor: 'pointer' }}>
                      {r}×
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc' }}>{treino.split} · {exercises.length} {t('coach_workouts.exercises_count')} · {treino.duration}</div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>{t('coach_workouts.exercises_title')}</div>
            <span style={{ font: `400 11px ${FF}`, color: '#b0a99c' }}>{t('coach_workouts.drag_hint')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {exercises.map((ex, i) => {
              const next = exercises[i + 1]
              const isSSwithNext = ex.superset_group != null && next?.superset_group === ex.superset_group
              const isSSwithPrev = i > 0 && ex.superset_group != null && exercises[i - 1]?.superset_group === ex.superset_group
              const ssLetter: 'A' | 'B' | undefined = isSSwithNext ? 'A' : (isSSwithPrev ? 'B' : undefined)
              return (
                <div key={ex._k} style={{ marginBottom: i < exercises.length - 1 ? 0 : 9 }}>
                  <ExRow ex={ex} order={i + 1} tagBg={g.bg} tagColor={g.color} dragOverId={dragOver}
                    supersetLetter={ssLetter}
                    onEdit={k => setEditExKey(k)}
                    onDelete={k => {
                      const toDelete = exercises.find(e => e._k === k)
                      let updated = exercises.filter(e => e._k !== k)
                      if (toDelete?.superset_group != null) {
                        const remaining = updated.filter(e => e.superset_group === toDelete.superset_group)
                        if (remaining.length < 2) updated = updated.map(e => e.superset_group === toDelete.superset_group ? { ...e, superset_group: null } : e)
                      }
                      setExercises(updated)
                      onUpdate({ ...treino, ex: updated })
                    }}
                    onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} />
                  {i < exercises.length - 1 && (treino.workout_type === 'circuito' ? (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '3px 10px' }}>
                      <div style={{ flex: 1, height: 1, background: '#e8d9be' }} />
                    </div>
                  ) : isSSwithNext ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
                      <div style={{ flex: 1, height: 2, background: 'rgba(232,84,42,.2)', borderRadius: 1 }} />
                      <span style={{ font: `800 9px ${FF}`, color: '#E8542A', background: '#fdf3ee', border: '1.5px solid rgba(232,84,42,.35)', borderRadius: 20, padding: '3px 10px', letterSpacing: '.5px', flexShrink: 0 }}>{t('coach_workouts.superset')}</span>
                      <button
                        onClick={() => toggleSuperset(ex._k, next!._k)}
                        title="Desfazer superset"
                        style={{ width: 18, height: 18, border: '1px solid rgba(232,84,42,.4)', background: 'rgba(232,84,42,.08)', borderRadius: '50%', cursor: 'pointer', color: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 13px ${FF}`, padding: 0, flexShrink: 0, lineHeight: 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#c4421e'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,84,42,.08)'; e.currentTarget.style.color = '#E8542A' }}
                      >×</button>
                      <div style={{ flex: 1, height: 2, background: 'rgba(232,84,42,.2)', borderRadius: 1 }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
                      <div style={{ flex: 1, height: 1, background: '#ece7d9' }} />
                      <button
                        onClick={() => toggleSuperset(ex._k, next!._k)}
                        style={{ font: `600 9px ${FF}`, color: '#c9c1b0', border: '1px dashed #d8d1c0', borderRadius: 20, padding: '3px 9px', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#E8542A'; e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.borderStyle = 'solid' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#c9c1b0'; e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.borderStyle = 'dashed' }}
                      >{t('coach_workouts.add_superset')}</button>
                      <div style={{ flex: 1, height: 1, background: '#ece7d9' }} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => treino.workout_type === 'circuito' ? setCircuitPickerOpen(true) : setPickerOpen(true)}
            style={{ marginTop: 10, width: '100%', border: '1.5px dashed #d8d1c0', background: 'none', color: '#9a948a', font: `600 12px ${FF}`, cursor: 'pointer', padding: 11, borderRadius: 10 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#9a948a' }}>
            {t('coach_workouts.add_exercise_btn')}
          </button>
        </div>
        <div style={{ flexShrink: 0, padding: '16px 24px', background: '#fff', borderTop: '1px solid #ece7d9' }}>
          {deleteConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ font: `600 13px ${FF}`, color: '#c4421e', textAlign: 'center' }}>{t('coach_workouts.delete_confirm', { name: treino.name })}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, height: 44, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer' }}>{t('coach_workouts.cancel')}</button>
                <button onClick={onDelete} style={{ flex: 1, height: 44, border: 'none', background: '#c4421e', color: '#fff', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer' }}>{t('coach_workouts.confirm_delete')}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(true)}
                style={{ width: 46, height: 46, border: '1.5px solid #e0d9c8', background: '#fff', color: '#a89f8e', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4421e'; e.currentTarget.style.color = '#c4421e' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#a89f8e' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
              <button onClick={onDuplicate}
                style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                {t('coach_workouts.duplicate')}
              </button>
            </div>
          )}
        </div>
      </div>
      {pickerOpen && <ExercisePickerModal library={library} onSelect={handlePickEx} onCreateNew={() => { setPickerOpen(false); setExModalOpen(true) }} onClose={() => setPickerOpen(false)} />}
      {exModalOpen && <NewExerciseModal onClose={() => setExModalOpen(false)} onAdd={handleAddEx} />}
      {circuitPickerOpen && (
        <CircuitAddExModal
          library={library}
          onAdd={ex => { handlePickEx(ex); setCircuitPickerOpen(false) }}
          onClose={() => setCircuitPickerOpen(false)}
        />
      )}
      {editExKey !== null && (() => {
        const ex = exercises.find(e => e._k === editExKey)
        if (!ex) return null
        if (treino.workout_type === 'circuito') {
          return <CircuitEditRepsModal
            ex={ex}
            initReps={ex.scheme}
            onClose={() => setEditExKey(null)}
            onSave={reps => handleSaveEdit(editExKey, reps, '0s')}
          />
        }
        const parsed = ex.scheme.match(/^(\d+)\s*[×x]\s*(.+)$/)
        return <EditExerciseModal
          ex={ex}
          initSets={parsed ? parsed[1] : '3'}
          initReps={parsed ? parsed[2].trim() : ex.scheme}
          initRest={ex.rest}
          onClose={() => setEditExKey(null)}
          onSave={(scheme, rest) => handleSaveEdit(editExKey, scheme, rest)}
        />
      })()}
    </>
  )
}

// ── Circuit Edit Reps Modal ───────────────────────────────────
function CircuitEditRepsModal({ ex, initReps, onClose, onSave }: {
  ex: { name: string; muscle: string }
  initReps: string
  onClose: () => void
  onSave: (reps: string) => void
}) {
  const { t } = useTranslation()
  const [reps, setReps] = useState(initReps)
  const inp: React.CSSProperties = { width: '100%', height: 48, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `700 17px ${FF}`, color: '#1B2A4A', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ font: `800 17px ${FF}`, color: '#1B2A4A', margin: 0 }}>{ex.name}</h2>
            <div style={{ font: `500 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>{ex.muscle}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{t('coach_workouts.reps_per_round')}</label>
        <input autoFocus type="text" value={reps} onChange={e => setReps(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(reps.trim() || '15') }}
          style={{ ...inp, marginBottom: 16 }}
          onFocus={focusOn} onBlur={focusOff}
        />
        <button onClick={() => onSave(reps.trim() || '15')} style={{ width: '100%', height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>{t('coach_workouts.save')}</button>
      </div>
    </div>
  )
}

// ── Circuit Add Exercise Modal ────────────────────────────────
function CircuitAddExModal({ library, onAdd, onClose }: {
  library: LibraryExercise[]
  onAdd: (ex: Omit<Exercise, '_k'>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [step,        setStep]        = useState<'pick' | 'reps'>('pick')
  const [picked,      setPicked]      = useState<LibraryExercise | null>(null)
  const [customName,  setCustomName]  = useState('')
  const [reps,        setReps]        = useState('15')
  const [query,       setQuery]       = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? library.filter(ex => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q)) : library

  function confirm() {
    const name   = picked?.name   ?? customName.trim()
    const muscle = picked?.muscle ?? '—'
    if (!name) return
    onAdd({ name, muscle, scheme: reps.trim() || '15', rest: '0s' })
  }

  if (step === 'reps') {
    const name   = picked?.name   ?? customName
    const muscle = picked?.muscle ?? '—'
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.6)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ font: `800 16px ${FF}`, color: '#1B2A4A' }}>{name}</div>
            <div style={{ font: `500 12px ${FF}`, color: '#9a948a', marginTop: 2 }}>{muscle}</div>
          </div>
          <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_workouts.reps_per_round')}</label>
          <input autoFocus type="text" placeholder="Ex: 15 ou 30s" value={reps} onChange={e => setReps(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            style={{ width: '100%', height: 48, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `700 18px ${FF}`, color: '#1B2A4A', outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 16 }}
            onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('pick')} style={{ flex: 1, height: 44, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}>{t('coach_workouts.back')}</button>
            <button onClick={confirm} style={{ flex: 2, height: 44, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>{t('coach_workouts.add')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.6)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>
        <div style={{ padding: '22px 22px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0 }}>{t('coach_workouts.add_to_circuit')}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('coach_workouts.search_exercise_ph')}
              style={{ width: '100%', height: 38, border: '1.5px solid #e0d9c8', borderRadius: 9, background: '#faf7ee', padding: '0 12px 0 32px', font: `400 13px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>
          {filtered.length === 0
            ? <div style={{ padding: '24px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#a89f8e' }}>{t('coach_workouts.no_exercise_found')}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {filtered.map((ex, i) => (
                  <button key={i} type="button" onClick={() => { setPicked(ex); setStep('reps') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fdf3ee' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#ece7d9'; e.currentTarget.style.background = '#fff' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                      <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{ex.muscle}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
          }
        </div>
        <div style={{ padding: '12px 14px 16px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          <div style={{ font: `600 11px ${FF}`, color: '#9a948a', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 7 }}>{t('coach_workouts.add_manually')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder={t('coach_workouts.exercise_name')} value={customName} onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) { setPicked(null); setStep('reps') } }}
              style={{ flex: 1, height: 38, border: '1.5px solid #e0d9c8', borderRadius: 9, background: '#fff', padding: '0 11px', font: `400 13px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }}
            />
            <button disabled={!customName.trim()} onClick={() => { if (customName.trim()) { setPicked(null); setStep('reps') } }}
              style={{ height: 38, padding: '0 14px', border: 'none', background: customName.trim() ? '#E8542A' : '#e0d9c8', color: '#fff', borderRadius: 9, font: `700 12.5px ${FF}`, cursor: customName.trim() ? 'pointer' : 'default' }}>
              {t('coach_workouts.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New Treino Modal ───────────────────────────────────────────
const BLOCK_LETTERS = 'ABCDEF'
function blockLabel(n: number) { return BLOCK_LETTERS.slice(0, n) }

function NewTreinoModal({ onClose, onAdd, onAddBlock, onAddCircuito, library }: {
  onClose:       () => void
  onAdd:         (name: string, goal: Goal) => void
  onAddBlock:    (goal: Goal, size: number) => void
  onAddCircuito: (name: string, goal: Goal, exs: Omit<Exercise,'_k'>[], rounds: number) => void
  library:       LibraryExercise[]
}) {
  const { t } = useTranslation()
  const GOAL_LABELS: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_hypertrophy'), Emagrecimento: t('coach_workouts.goal_weight_loss'),
    Força: t('coach_workouts.goal_strength'), Condicionamento: t('coach_workouts.goal_conditioning'), Mobilidade: t('coach_workouts.goal_mobility'),
  }
  const [name,             setName]             = useState('')
  const [goal,             setGoal]             = useState<Goal>('Condicionamento')
  const [mode,             setMode]             = useState<'individual' | 'bloco' | 'circuito'>('individual')
  const [blockSize,        setBlockSize]        = useState(3)
  const [rounds,           setRounds]           = useState(3)
  const [circuitExs,       setCircuitExs]       = useState<Omit<Exercise,'_k'>[]>([])
  const [circuitPickerOpen,setCircuitPickerOpen] = useState(false)
  const [err,              setErr]              = useState('')
  function handleSave() {
    if (mode === 'individual') {
      if (!name.trim()) { setErr(t('coach_workouts.err_no_exercise_name')); return }
      onAdd(name.trim(), goal)
    } else if (mode === 'bloco') {
      onAddBlock(goal, blockSize)
    } else {
      if (!name.trim()) { setErr(t('coach_workouts.err_no_circuit_name')); return }
      onAddCircuito(name.trim(), goal, circuitExs, rounds)
    }
  }

  const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8, 10]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

        <div style={{ padding: '24px 26px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>{t('coach_workouts.new_workout')}</h2>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#f4efe3', borderRadius: 10, padding: 4, marginBottom: 20, gap: 2 }}>
            {(['individual', 'bloco', 'circuito'] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setErr('') }}
                style={{ flex: 1, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', font: `700 12px ${FF}`, transition: 'all .15s',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#1B2A4A' : '#9a948a',
                  boxShadow: mode === m ? '0 1px 4px rgba(27,42,74,.1)' : 'none',
                }}>
                {m === 'individual' ? t('coach_workouts.mode_single') : m === 'bloco' ? t('coach_workouts.mode_block') : t('coach_workouts.mode_circuit')}
              </button>
            ))}
          </div>

          {/* Name field (individual & circuito) */}
          {mode !== 'bloco' && (
            <>
              <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>
                {mode === 'circuito' ? t('coach_workouts.circuit_name') : t('coach_workouts.workout_name')}
              </label>
              <input
                autoFocus
                type="text"
                placeholder={mode === 'circuito' ? 'Ex: Circuito HIIT, Circuito Full Body…' : 'Ex: Treino A — Peito e Tríceps'}
                value={name}
                onChange={e => { setName(e.target.value); setErr('') }}
                style={{ width: '100%', height: 46, border: `1.5px solid ${err ? '#c4421e' : '#d9d3c4'}`, borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: err ? 6 : 18, boxSizing: 'border-box' as const }}
                onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
                onBlur={e => { e.currentTarget.style.borderColor = err ? '#c4421e' : '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
              />
              {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginBottom: 12 }}>{err}</div>}
            </>
          )}

          {/* Bloco: size selector */}
          {mode === 'bloco' && (
            <>
              <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 10 }}>{t('coach_workouts.block_size')}</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} type="button" onClick={() => setBlockSize(n)}
                    style={{ flex: 1, height: 56, border: `1.5px solid ${blockSize === n ? '#E8542A' : '#d9d3c4'}`, background: blockSize === n ? '#fdf3ee' : '#fff', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span style={{ font: `800 13px ${FF}`, color: blockSize === n ? '#E8542A' : '#1B2A4A' }}>{blockLabel(blockSize === n ? n : n)}</span>
                    <span style={{ font: `500 10px ${FF}`, color: blockSize === n ? '#E8542A' : '#b0a99c' }}>{t('coach_workouts.block_workout_count', { count: n })}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {Array.from({ length: blockSize }, (_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4efe3', border: '1px solid #e0d9c8', borderRadius: 8, padding: '5px 10px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 10px ${FF}`, color: '#fff', flexShrink: 0 }}>
                      {BLOCK_LETTERS[i]}
                    </div>
                    <span style={{ font: `500 11px ${FF}`, color: '#7c7869' }}>{t('coach_workouts.workout_slot', { slot: BLOCK_LETTERS[i] })}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Goal (not shown for circuito — use Condicionamento) */}
          {mode !== 'circuito' && (
            <>
              <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>{t('coach_workouts.objective')}</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                {GOALS.map(g => {
                  const s = GOAL_STYLE[g]
                  return (
                    <button key={g} type="button" onClick={() => setGoal(g)}
                      style={{ border: `1.5px solid ${goal === g ? s.color : '#e0d9c8'}`, background: goal === g ? s.color : '#fff', color: goal === g ? '#fff' : '#7c7869', font: `600 12.5px ${FF}`, borderRadius: 20, padding: '8px 14px', cursor: 'pointer' }}>
                      {GOAL_LABELS[g]}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Circuito: exercise list header */}
          {mode === 'circuito' && (
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 8 }}>
              {t('coach_workouts.exercises_circuit_label')} <span style={{ color: '#c9c1b0', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— {t('coach_workouts.per_round_hint')}</span>
            </div>
          )}
        </div>

        {/* Circuito: scrollable exercise list */}
        {mode === 'circuito' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 26px', minHeight: 0 }}>
            {circuitExs.length === 0 && (
              <div style={{ padding: '12px 0', font: `400 13px ${FF}`, color: '#a89f8e', textAlign: 'center' }}>{t('coach_workouts.no_exercises_added')}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {circuitExs.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7ecd9', border: '1px solid #e8d9be', borderRadius: 11, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#b06a12', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 10px ${FF}`, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                    <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{ex.muscle}</div>
                  </div>
                  <div style={{ font: `800 14px ${FF}`, color: '#b06a12', flexShrink: 0 }}>{ex.scheme}</div>
                  <button type="button" onClick={() => setCircuitExs(p => p.filter((_, idx) => idx !== i))}
                    style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: '#b0a99c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#c4421e'; e.currentTarget.style.background = '#fbe6e1' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#b0a99c'; e.currentTarget.style.background = 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setCircuitPickerOpen(true)}
              style={{ width: '100%', border: '1.5px dashed #d8d1c0', background: 'none', color: '#9a948a', borderRadius: 10, padding: '10px 0', font: `600 12.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '10px 0 4px' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#9a948a' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              {t('coach_workouts.add_exercise')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: mode === 'circuito' ? '14px 26px 22px' : '18px 26px 24px', flexShrink: 0, borderTop: mode === 'circuito' ? '1px solid #f4efe3' : 'none' }}>
          {/* Rounds selector (circuit only) */}
          {mode === 'circuito' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>{t('coach_workouts.rounds')}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {ROUND_OPTIONS.map(r => (
                  <button key={r} type="button" onClick={() => setRounds(r)}
                    style={{ flex: 1, height: 40, border: `1.5px solid ${rounds === r ? '#E8542A' : '#d9d3c4'}`, background: rounds === r ? '#E8542A' : '#fff', color: rounds === r ? '#fff' : '#7c7869', font: `700 13px ${FF}`, borderRadius: 9, cursor: 'pointer' }}>
                    {r}×
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={handleSave}
            style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
            {mode === 'individual' ? t('coach_workouts.create_workout') : mode === 'bloco' ? t('coach_workouts.create_block', { letters: blockLabel(blockSize) }) : t('coach_workouts.create_circuit', { rounds })}
          </button>
        </div>
      </div>

      {circuitPickerOpen && (
        <CircuitAddExModal
          library={library}
          onAdd={ex => { setCircuitExs(p => [...p, ex]); setCircuitPickerOpen(false) }}
          onClose={() => setCircuitPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function parseScheme(s: string) { const m = s.match(/^(\d+)\s*[×x]\s*(.+)$/); return m ? { sets: parseInt(m[1]), reps: m[2].trim() } : { sets: 3, reps: s } }
function parseRest(r: string)   { return parseInt(r) || 60 }
function parseDuration(d: string) { return parseInt(d) || 45 }

// ── Main ──────────────────────────────────────────────────────
export default function Treinos() {
  const { t } = useTranslation()
  const { user }     = useAuthStore()
  const { students } = useStudentsStore()
  const GOAL_LABELS: Record<Goal, string> = {
    Hipertrofia: t('coach_workouts.goal_hypertrophy'), Emagrecimento: t('coach_workouts.goal_weight_loss'),
    Força: t('coach_workouts.goal_strength'), Condicionamento: t('coach_workouts.goal_conditioning'), Mobilidade: t('coach_workouts.goal_mobility'),
  }

  // Programas tab state
  const [programs,       setPrograms]       = useState<Program[]>([])
  const [openProgramId,  setOpenProgramId]  = useState<number | null>(null)
  const [newProgramOpen, setNewProgramOpen] = useState(false)
  const [applyOpen,      setApplyOpen]      = useState(false)

  // Biblioteca tab state
  const [treinos,     setTreinos]     = useState<Treino[]>([])
  const [library,     setLibrary]     = useState<LibraryExercise[]>(
    EXERCISE_LIBRARY.map(e => ({ name: e.name, muscle: e.muscle, scheme: '3 × 12', rest: '60s' }))
  )
  const [query,       setQuery]       = useState('')
  const [filter,      setFilter]      = useState<Goal | 'all'>('all')
  const [openId,      setOpenId]      = useState<number | null>(null)
  const [newOpen,     setNewOpen]     = useState(false)

  const [tab,   setTab]   = useState<'programas' | 'biblioteca'>('programas')
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextK    = useRef(9000)

  // Cached workouts for slot picker (from treinos)
  const workoutOptions: WorkoutOption[] = treinos.map(tr => ({
    id: tr.id, name: tr.name, goal: tr.goal,
    muscle_group: tr.split || null, duration_min: parseDuration(tr.duration),
    ex_count: tr.ex.length,
  }))

  useEffect(() => {
    if (!user?.id) return
    void fetchPrograms()
    void fetchTreinos()
  }, [user?.id])
  useEffect(() => () => clearTimeout(toastRef.current), [])

  function showToast(msg: string) { setToast(msg); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(''), 1900) }

  // ── Programs ─────────────────────────────────────────────────
  async function fetchPrograms() {
    if (!user?.id) return
    const { data } = await supabase
      .from('programs')
      .select(`
        id, name, days_per_week, is_template, created_at,
        program_slots ( id, position, workout_id, day_of_week,
          workouts ( id, name, goal, muscle_group, duration_min )
        ),
        program_assignments ( id )
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    if (!data) return
    setPrograms((data as any[]).map(p => ({
      id:            p.id,
      name:          p.name,
      days_per_week: p.days_per_week,
      is_template:   p.is_template,
      applied_count: (p.program_assignments ?? []).length,
      slots: [...(p.program_slots ?? [])]
        .sort((a: any, b: any) => a.position - b.position)
        .map((s: any) => ({
          id:          s.id,
          position:    s.position,
          workout_id:  s.workout_id,
          day_of_week: s.day_of_week,
          workout:     s.workouts ? {
            id:           s.workouts.id,
            name:         s.workouts.name,
            goal:         s.workouts.goal,
            muscle_group: s.workouts.muscle_group,
            duration_min: s.workouts.duration_min,
            ex_count:     0,
          } : null,
        })),
    })))
  }

  async function handleCreateProgram(name: string, daysPerWeek: number, isTemplate: boolean, slotConfigs: SlotConfig[]) {
    if (!user?.id) return
    const { data: prog, error } = await supabase
      .from('programs')
      .insert({ coach_id: user.id, name, days_per_week: daysPerWeek, is_template: isTemplate })
      .select()
      .single()
    if (error || !prog) { console.error('[createProgram]', error); showToast(t('coach_workouts.err_create') + ': ' + (error?.message ?? '')); return }

    // Create all workouts at once
    const workoutRows = slotConfigs.map((sc, i) => ({
      coach_id: user.id,
      name: sc.name.trim() || `Treino ${BLOCK_LETTERS[i]}`,
      goal: sc.goal,
      muscle_group: `${sc.goal} · Treino ${BLOCK_LETTERS[i]}`,
      duration_min: 45,
    }))
    const { data: workoutsData, error: wErr } = await supabase.from('workouts').insert(workoutRows).select()
    if (wErr || !workoutsData) { showToast(t('coach_workouts.err_create_workouts')); return }

    // Create slots pointing to each workout
    const slotRows = (workoutsData as any[]).map((w, i) => ({
      program_id: (prog as any).id, position: i + 1, workout_id: w.id, day_of_week: null,
    }))
    await supabase.from('program_slots').insert(slotRows)

    // Add new workouts to biblioteca state
    const newTreinos: Treino[] = (workoutsData as any[]).map((w, i) => ({
      id: w.id, name: w.name, split: w.muscle_group,
      goal: slotConfigs[i].goal, duration: '45 min', assigned: 0, ex: [],
    }))
    setTreinos(prev => [...newTreinos, ...prev])

    setNewProgramOpen(false)
    await fetchPrograms()
    setOpenProgramId((prog as any).id)
    showToast(t('coach_workouts.program_created', { count: daysPerWeek }))
  }

  async function handleApplyProgram(studentIds: number[]) {
    if (!openProgramId) return
    // Deactivate existing programs for these students
    await supabase.from('program_assignments')
      .update({ active: false })
      .in('student_id', studentIds)
    const rows = studentIds.map(id => ({ program_id: openProgramId, student_id: id, active: true }))
    const { error } = await supabase.from('program_assignments').insert(rows)
    if (error) { showToast(t('coach_workouts.err_apply_program')); return }
    const n = studentIds.length
    setApplyOpen(false)
    setPrograms(prev => prev.map(p => p.id === openProgramId ? { ...p, applied_count: p.applied_count + n } : p))
    showToast(t('coach_workouts.program_applied', { count: n }))
  }

  async function handleDeleteProgram(id: number) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    setOpenProgramId(null)
    showToast(t('coach_workouts.program_deleted'))
  }

  function handleUpdateProgram(updated: Program) {
    setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  // ── Biblioteca ────────────────────────────────────────────────
  async function fetchTreinos() {
    if (!user?.id) return
    const { data } = await supabase
      .from('workouts')
      .select('*, exercises(*)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    if (!data) return
    setTreinos((data as any[]).map(w => {
      const isCircuit = w.workout_type === 'circuito'
      return {
        id: w.id, name: w.name, split: w.muscle_group ?? '',
        goal: (w.goal as Goal) ?? 'Hipertrofia',
        duration: w.duration_min ? `${w.duration_min} min` : '— min',
        assigned: 0,
        workout_type: (w.workout_type as 'standard' | 'circuito') ?? 'standard',
        rounds: w.rounds ?? null,
        ex: [...(w.exercises ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order).map((e: any) => ({
          _k: e.id, name: e.name, muscle: e.muscle_group ?? '—',
          scheme: isCircuit ? (e.reps ?? '15') : `${e.sets} × ${e.reps}`,
          rest: isCircuit ? '0s' : (e.rest_sec ? `${e.rest_sec}s` : '60s'),
          superset_group: e.superset_group ?? null,
        })),
      }
    }))
  }

  async function syncExercises(treino: Treino) {
    await supabase.from('exercises').delete().eq('workout_id', treino.id)
    if (!treino.ex.length) return
    const isCircuit = treino.workout_type === 'circuito'
    await supabase.from('exercises').insert(treino.ex.map((ex, i) => {
      if (isCircuit) {
        return { workout_id: treino.id, name: ex.name, muscle_group: ex.muscle, sets: 1, reps: ex.scheme, rest_sec: 0, sort_order: i, superset_group: null }
      }
      const { sets, reps } = parseScheme(ex.scheme)
      return { workout_id: treino.id, name: ex.name, muscle_group: ex.muscle, sets, reps, rest_sec: parseRest(ex.rest), sort_order: i, superset_group: ex.superset_group ?? null }
    }))
  }

  async function handleAddTreino(name: string, goal: Goal) {
    if (!name.trim() || !user?.id) return
    const { data, error } = await supabase
      .from('workouts')
      .insert({ coach_id: user.id, name: name.trim(), goal, muscle_group: goal + ' · Novo', duration_min: 45 })
      .select().single()
    if (error || !data) { showToast(t('coach_workouts.err_create_workout')); return }
    const newTr: Treino = { id: (data as any).id, name: (data as any).name, split: (data as any).muscle_group, goal, duration: '45 min', assigned: 0, ex: [] }
    setTreinos(prev => [newTr, ...prev]); setNewOpen(false); setOpenId((data as any).id)
    showToast(t('coach_workouts.workout_created'))
  }

  async function handleAddBlock(goal: Goal, size: number) {
    if (!user?.id) return
    const rows = Array.from({ length: size }, (_, i) => ({
      coach_id: user.id,
      name: `Treino ${BLOCK_LETTERS[i]}`,
      goal,
      muscle_group: `${goal} · Treino ${BLOCK_LETTERS[i]}`,
      duration_min: 45,
    }))
    const { data, error } = await supabase.from('workouts').insert(rows).select()
    if (error || !data) { showToast(t('coach_workouts.err_create_block')); return }
    const newTreinos: Treino[] = (data as any[]).map(w => ({
      id: w.id, name: w.name, split: w.muscle_group, goal, duration: '45 min', assigned: 0, ex: [],
    }))
    setTreinos(prev => [...newTreinos, ...prev])
    setNewOpen(false)
    setOpenId(newTreinos[0].id)
    showToast(t('coach_workouts.block_created', { letters: blockLabel(size) }))
  }

  async function handleAddCircuito(name: string, goal: Goal, exs: Omit<Exercise,'_k'>[], rounds: number) {
    if (!name.trim() || !user?.id) return
    const { data, error } = await supabase
      .from('workouts')
      .insert({ coach_id: user.id, name: name.trim(), goal, muscle_group: 'Circuito', duration_min: 30, workout_type: 'circuito', rounds })
      .select().single()
    if (error || !data) { showToast(t('coach_workouts.err_create_circuit')); return }
    if (exs.length > 0) {
      await supabase.from('exercises').insert(exs.map((ex, i) => ({
        workout_id: (data as any).id, name: ex.name, muscle_group: ex.muscle,
        sets: 1, reps: ex.scheme, rest_sec: 0, sort_order: i,
      })))
    }
    let baseK = nextK.current
    const newTr: Treino = {
      id: (data as any).id, name: (data as any).name, split: 'Circuito',
      goal, duration: '30 min', assigned: 0,
      workout_type: 'circuito', rounds,
      ex: exs.map(ex => ({ ...ex, _k: baseK++ })),
    }
    nextK.current = baseK
    setTreinos(prev => [newTr, ...prev]); setNewOpen(false); setOpenId((data as any).id)
    showToast(t('coach_workouts.circuit_created', { rounds }))
  }

  async function handleDuplicate(id: number) {
    const orig = treinos.find(tr => tr.id === id)
    if (!orig || !user?.id) return
    const { data: newW } = await supabase.from('workouts')
      .insert({ coach_id: user.id, name: orig.name + ' (cópia)', goal: orig.goal, muscle_group: orig.split, duration_min: parseDuration(orig.duration) })
      .select().single()
    if (!newW) return
    if (orig.ex.length) {
      await supabase.from('exercises').insert(orig.ex.map((ex, i) => {
        const { sets, reps } = parseScheme(ex.scheme)
        return { workout_id: (newW as any).id, name: ex.name, muscle_group: ex.muscle, sets, reps, rest_sec: parseRest(ex.rest), sort_order: i, superset_group: ex.superset_group ?? null }
      }))
    }
    let baseK = nextK.current
    const copy: Treino = { id: (newW as any).id, name: (newW as any).name, split: orig.split, goal: orig.goal, duration: orig.duration, assigned: 0, ex: orig.ex.map(ex => ({ ...ex, _k: baseK++ })) }
    nextK.current = baseK
    setTreinos(prev => { const idx = prev.findIndex(tr => tr.id === id); const next = [...prev]; next.splice(idx + 1, 0, copy); return next })
    setOpenId((newW as any).id); showToast(t('coach_workouts.workout_duplicated'))
  }

  async function handleDeleteTreino(id: number) {
    await supabase.from('workouts').delete().eq('id', id)
    setTreinos(prev => prev.filter(tr => tr.id !== id)); setOpenId(null); showToast(t('coach_workouts.workout_deleted'))
  }

  function handleUpdate(updated: Treino) {
    setTreinos(prev => prev.map(tr => tr.id === updated.id ? updated : tr)); void syncExercises(updated)
  }

  function handleAddToLibrary(ex: LibraryExercise) {
    setLibrary(prev => prev.some(e => e.name.toLowerCase() === ex.name.toLowerCase()) ? prev : [...prev, ex])
  }

  const openProgram   = programs.find(p => p.id === openProgramId) ?? null
  const openTreino    = treinos.find(tr => tr.id === openId) ?? null
  const q             = query.trim().toLowerCase()
  const visibleTreinos = treinos.filter(tr => {
    const okGoal = filter === 'all' || tr.goal === filter
    const okQ    = !q || tr.name.toLowerCase().includes(q) || tr.split.toLowerCase().includes(q)
    return okGoal && okQ
  })

  function chipStyle(active: boolean, accent = '#1B2A4A') {
    return { border: `1.5px solid ${active ? accent : '#e0d9c8'}`, background: active ? accent : '#fff', color: active ? '#fff' : '#7c7869', font: `600 12.5px ${FF}`, borderRadius: 20, padding: '8px 14px', cursor: 'pointer' as const }
  }

  return (
    <div style={{ padding: '30px 34px 40px', maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>{t('coach_workouts.title')}</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
            <strong style={{ color: '#1B2A4A' }}>{programs.length}</strong> {t('coach_workouts.programs_count', { count: programs.length })} · <strong style={{ color: '#1B2A4A' }}>{treinos.length}</strong> {t('coach_workouts.library_count', { count: treinos.length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'programas' && (
            <button onClick={() => setNewProgramOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              {t('coach_workouts.new_program')}
            </button>
          )}
          {tab === 'biblioteca' && (
            <button onClick={() => setNewOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              {t('coach_workouts.new_workout')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, background: '#f4efe3', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24 }}>
        {(['programas', 'biblioteca'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 9, cursor: 'pointer', font: `700 13px ${FF}`, transition: 'all .15s',
              background: tab === tabKey ? '#fff' : 'transparent',
              color: tab === tabKey ? '#1B2A4A' : '#9a948a',
              boxShadow: tab === tabKey ? '0 1px 4px rgba(27,42,74,.1)' : 'none',
            }}>
            {tabKey === 'programas' ? t('coach_workouts.tab_programs') : t('coach_workouts.tab_library')}
          </button>
        ))}
      </div>

      {/* Programas tab */}
      {tab === 'programas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {programs.map(p => <ProgramCard key={p.id} program={p} onClick={() => setOpenProgramId(p.id)} />)}
          {programs.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', border: '1.5px dashed #d8d1c0', borderRadius: 16 }}>
              <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>{t('coach_workouts.no_programs_title')}</div>
              <div style={{ font: `400 13px ${FF}`, color: '#a89f8e', marginBottom: 18 }}>{t('coach_workouts.no_programs_hint')}</div>
              <button onClick={() => setNewProgramOpen(true)}
                style={{ height: 40, padding: '0 20px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                {t('coach_workouts.create_first_program')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Biblioteca tab */}
      {tab === 'biblioteca' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
              <input type="text" placeholder={t('coach_workouts.search_workout_ph')} value={query} onChange={e => setQuery(e.target.value)}
                style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#fff', padding: '0 14px 0 36px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }} />
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>{t('coach_workouts.filter_all')}</button>
              {GOALS.map(g => <button key={g} type="button" onClick={() => setFilter(g)} style={chipStyle(filter === g, GOAL_STYLE[g].color)}>{GOAL_LABELS[g]}</button>)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {visibleTreinos.map(tr => {
              const g = GOAL_STYLE[tr.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
              return (
                <div key={tr.id} onClick={() => setOpenId(tr.id)}
                  style={{ background: '#fff', border: `1px solid ${tr.workout_type === 'circuito' ? '#e8d9be' : '#ece7d9'}`, borderRadius: 16, padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .15s, transform .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 22px rgba(27,42,74,.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: tr.workout_type === 'circuito' ? '#f7ecd9' : g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tr.workout_type === 'circuito'
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={g.color} strokeWidth="2" strokeLinecap="round"><path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/></svg>
                      }
                    </div>
                    {tr.workout_type === 'circuito'
                      ? <span style={{ font: `700 11px ${FF}`, color: '#b06a12', background: '#f7ecd9', borderRadius: 20, padding: '5px 11px', letterSpacing: '.2px' }}>CIRCUITO</span>
                      : <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '5px 11px' }}>{GOAL_LABELS[tr.goal]}</span>
                    }
                  </div>
                  <div>
                    <div style={{ font: `800 15px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px' }}>{tr.name}</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>{tr.split}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, borderTop: `1px solid ${tr.workout_type === 'circuito' ? '#f0e6d2' : '#f4efe3'}`, paddingTop: 11 }}>
                    <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{tr.ex.length} ex.</span>
                    {tr.workout_type === 'circuito'
                      ? <span style={{ font: `600 12px ${FF}`, color: '#b06a12' }}>{tr.rounds ?? 3} rounds</span>
                      : <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{tr.duration}</span>
                    }
                  </div>
                </div>
              )
            })}
            {visibleTreinos.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d8d1c0', borderRadius: 14 }}>
                {t('coach_workouts.no_workout_found')}
              </div>
            )}
          </div>
        </>
      )}

      {/* Program builder drawer */}
      {openProgram && (
        <ProgramBuilderDrawer
          program={openProgram}
          workouts={workoutOptions}
          library={library}
          onClose={() => setOpenProgramId(null)}
          onUpdate={handleUpdateProgram}
          onApply={() => setApplyOpen(true)}
          onDelete={() => handleDeleteProgram(openProgram.id)}
          onWorkoutCreated={(_wo, t) => setTreinos(prev => [t, ...prev])}
        />
      )}

      {/* Apply program modal */}
      {applyOpen && openProgram && (
        <ApplyProgramModal
          programName={openProgram.name}
          students={students}
          onConfirm={handleApplyProgram}
          onClose={() => setApplyOpen(false)}
        />
      )}

      {/* Biblioteca drawer */}
      {openTreino && (
        <TreinoDrawer
          treino={openTreino}
          library={library}
          onClose={() => setOpenId(null)}
          onDuplicate={() => handleDuplicate(openTreino.id)}
          onUpdate={handleUpdate}
          onAddToLibrary={handleAddToLibrary}
          onDelete={() => handleDeleteTreino(openTreino.id)}
        />
      )}

      {newProgramOpen && <NewProgramModal onClose={() => setNewProgramOpen(false)} onAdd={(n, d, t, s) => void handleCreateProgram(n, d, t, s)} />}
      {newOpen && (
        <NewTreinoModal
          onClose={() => setNewOpen(false)}
          onAdd={handleAddTreino}
          onAddBlock={handleAddBlock}
          onAddCircuito={handleAddCircuito}
          library={library}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}
