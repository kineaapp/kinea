import { useState, useRef, useEffect, type DragEvent } from 'react'
import { getInitials, avatarPalette } from '../../data/mock'

const FF = '"Libre Franklin",sans-serif'

// ── Types ───────────────────────────────────────────────────
type Goal = 'Hipertrofia' | 'Emagrecimento' | 'Força' | 'Condicionamento' | 'Mobilidade'

interface Exercise {
  _k:     number
  name:   string
  muscle: string
  scheme: string
  rest:   string
}

interface LibraryExercise {
  name:   string
  muscle: string
  scheme: string
  rest:   string
}

interface Treino {
  id:       number
  name:     string
  split:    string
  goal:     Goal
  duration: string
  assigned: number
  ex:       Exercise[]
}

// ── Constants ───────────────────────────────────────────────
const GOAL_STYLE: Record<Goal, { color: string; bg: string }> = {
  Hipertrofia:    { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:  { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:          { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento:{ color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:     { color: '#5a4ea0', bg: '#ece9f6' },
}

const GOALS = Object.keys(GOAL_STYLE) as Goal[]

const MUSCLE_CHIPS = ['Peito', 'Dorsal', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Core', 'Corpo todo']

const SEED_TREINOS: Treino[] = [
  { id:1, name:'Treino A — Peito e Tríceps', split:'Push · Hipertrofia', goal:'Hipertrofia', duration:'55 min', assigned:14,
    ex:[ {_k:100,name:'Supino reto com barra',muscle:'Peito',scheme:'4 × 8',rest:'90s'},
         {_k:101,name:'Supino inclinado halteres',muscle:'Peito superior',scheme:'3 × 10',rest:'75s'},
         {_k:102,name:'Crucifixo na máquina',muscle:'Peito',scheme:'3 × 12',rest:'60s'},
         {_k:103,name:'Tríceps testa',muscle:'Tríceps',scheme:'4 × 10',rest:'60s'},
         {_k:104,name:'Tríceps corda',muscle:'Tríceps',scheme:'3 × 15',rest:'45s'} ] },
  { id:2, name:'Treino B — Costas e Bíceps', split:'Pull · Hipertrofia', goal:'Hipertrofia', duration:'60 min', assigned:12,
    ex:[ {_k:200,name:'Barra fixa',muscle:'Dorsal',scheme:'4 × 8',rest:'90s'},
         {_k:201,name:'Remada curvada',muscle:'Dorsal',scheme:'4 × 10',rest:'75s'},
         {_k:202,name:'Puxada frontal',muscle:'Dorsal',scheme:'3 × 12',rest:'60s'},
         {_k:203,name:'Rosca direta',muscle:'Bíceps',scheme:'4 × 10',rest:'60s'},
         {_k:204,name:'Rosca martelo',muscle:'Bíceps',scheme:'3 × 12',rest:'45s'} ] },
  { id:3, name:'Treino C — Pernas completo', split:'Legs · Força', goal:'Força', duration:'70 min', assigned:9,
    ex:[ {_k:300,name:'Agachamento livre',muscle:'Quadríceps',scheme:'5 × 5',rest:'120s'},
         {_k:301,name:'Leg press 45°',muscle:'Quadríceps',scheme:'4 × 8',rest:'90s'},
         {_k:302,name:'Cadeira extensora',muscle:'Quadríceps',scheme:'3 × 12',rest:'60s'},
         {_k:303,name:'Mesa flexora',muscle:'Posterior',scheme:'4 × 10',rest:'60s'},
         {_k:304,name:'Panturrilha em pé',muscle:'Panturrilha',scheme:'4 × 15',rest:'45s'} ] },
  { id:4, name:'Full Body Iniciante', split:'Full body · 3×/semana', goal:'Condicionamento', duration:'45 min', assigned:21,
    ex:[ {_k:400,name:'Agachamento livre',muscle:'Pernas',scheme:'3 × 12',rest:'60s'},
         {_k:401,name:'Supino máquina',muscle:'Peito',scheme:'3 × 12',rest:'60s'},
         {_k:402,name:'Puxada frontal',muscle:'Dorsal',scheme:'3 × 12',rest:'60s'},
         {_k:403,name:'Desenvolvimento halteres',muscle:'Ombros',scheme:'3 × 12',rest:'60s'},
         {_k:404,name:'Prancha abdominal',muscle:'Core',scheme:'3 × 40s',rest:'45s'} ] },
  { id:5, name:'HIIT Queima 20min', split:'Cardio · Intervalado', goal:'Emagrecimento', duration:'20 min', assigned:18,
    ex:[ {_k:500,name:'Burpees',muscle:'Corpo todo',scheme:'4 × 30s',rest:'20s'},
         {_k:501,name:'Mountain climber',muscle:'Core',scheme:'4 × 30s',rest:'20s'},
         {_k:502,name:'Polichinelo',muscle:'Corpo todo',scheme:'4 × 30s',rest:'20s'},
         {_k:503,name:'Agachamento com salto',muscle:'Pernas',scheme:'4 × 30s',rest:'20s'} ] },
  { id:6, name:'Ombros e Trapézio', split:'Push · Isolado', goal:'Hipertrofia', duration:'40 min', assigned:7,
    ex:[ {_k:600,name:'Desenvolvimento militar',muscle:'Ombros',scheme:'4 × 8',rest:'90s'},
         {_k:601,name:'Elevação lateral',muscle:'Deltoide lateral',scheme:'4 × 12',rest:'45s'},
         {_k:602,name:'Elevação frontal',muscle:'Deltoide anterior',scheme:'3 × 12',rest:'45s'},
         {_k:603,name:'Encolhimento halteres',muscle:'Trapézio',scheme:'4 × 15',rest:'45s'} ] },
  { id:7, name:'Mobilidade e Alongamento', split:'Recovery · Diário', goal:'Mobilidade', duration:'25 min', assigned:11,
    ex:[ {_k:700,name:'Gato-camelo',muscle:'Coluna',scheme:'3 × 10',rest:'30s'},
         {_k:701,name:'Alongamento de quadril',muscle:'Quadril',scheme:'3 × 40s',rest:'20s'},
         {_k:702,name:'Rotação torácica',muscle:'Tórax',scheme:'3 × 12',rest:'20s'},
         {_k:703,name:'Cachorro olhando p/ baixo',muscle:'Cadeia posterior',scheme:'3 × 45s',rest:'20s'} ] },
  { id:8, name:'Core e Abdômen', split:'Core · Isolado', goal:'Condicionamento', duration:'30 min', assigned:15,
    ex:[ {_k:800,name:'Prancha frontal',muscle:'Core',scheme:'4 × 45s',rest:'30s'},
         {_k:801,name:'Abdominal infra',muscle:'Abdômen inferior',scheme:'4 × 15',rest:'30s'},
         {_k:802,name:'Prancha lateral',muscle:'Oblíquos',scheme:'3 × 30s',rest:'30s'},
         {_k:803,name:'Russian twist',muscle:'Oblíquos',scheme:'3 × 20',rest:'30s'} ] },
]

function buildInitialLibrary(): LibraryExercise[] {
  const seen = new Set<string>()
  const lib: LibraryExercise[] = []
  for (const t of SEED_TREINOS) {
    for (const ex of t.ex) {
      const key = ex.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        lib.push({ name: ex.name, muscle: ex.muscle, scheme: ex.scheme, rest: ex.rest })
      }
    }
  }
  return lib
}

const STUDENT_SEED = [
  { id:1, name:'Tatiane Ribeiro', goal:'Emagrecimento' },
  { id:2, name:'Rafael Antunes',  goal:'Hipertrofia' },
  { id:3, name:'Beatriz Camargo', goal:'Condicionamento' },
  { id:4, name:'Eduardo Nunes',   goal:'Força' },
  { id:5, name:'Larissa Fonseca', goal:'Recomposição' },
  { id:6, name:'Marcelo Vieira',  goal:'Emagrecimento' },
]

// ── Toast ───────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Workout card ─────────────────────────────────────────────
function TreinoCard({ t, onClick }: { t: Treino; onClick: (id: number) => void }) {
  const g = GOAL_STYLE[t.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
  return (
    <div
      onClick={() => onClick(t.id)}
      style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 22px rgba(27,42,74,.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={g.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/>
          </svg>
        </div>
        <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '5px 11px', whiteSpace: 'nowrap' }}>{t.goal}</span>
      </div>
      <div>
        <div style={{ font: `800 16.5px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', lineHeight: 1.25 }}>{t.name}</div>
        <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a', marginTop: 4 }}>{t.split}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid #f4efe3', paddingTop: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{t.ex.length} ex.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span style={{ font: `600 12px ${FF}`, color: '#6b6657' }}>{t.duration}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>{t.assigned}</span>
        </div>
      </div>
    </div>
  )
}

// ── Exercise row ─────────────────────────────────────────────
function ExRow({ ex, order, tagBg, tagColor, dragOverId, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: {
  ex:          Exercise
  order:       number
  tagBg:       string
  tagColor:    string
  dragOverId:  number | null
  onDragStart: (e: DragEvent<HTMLDivElement>, k: number) => void
  onDragEnd:   (e: DragEvent<HTMLDivElement>) => void
  onDragOver:  (e: DragEvent<HTMLDivElement>, k: number) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop:      (e: DragEvent<HTMLDivElement>, k: number) => void
}) {
  const isOver = dragOverId === ex._k
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, ex._k)}
      onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, ex._k)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, ex._k)}
      style={{
        background: isOver ? '#fdf3ee' : '#fff',
        boxShadow: isOver ? 'inset 0 0 0 2px #E8542A' : 'none',
        border: '1px solid #ece7d9', borderRadius: 12, padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab', transition: 'background .1s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c1b0" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
        <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
      </svg>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: tagBg, color: tagColor, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 11px ${FF}`, flexShrink: 0 }}>
        {order}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
        <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>{ex.muscle}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ font: `800 14px ${FF}`, color: '#1B2A4A' }}>{ex.scheme}</div>
        <div style={{ font: `500 11px ${FF}`, color: '#b0a99c' }}>desc. {ex.rest}</div>
      </div>
    </div>
  )
}

// ── New exercise modal ────────────────────────────────────────
function NewExerciseModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd:   (ex: Omit<Exercise, '_k'>) => void
}) {
  const [name,   setName]   = useState('')
  const [muscle, setMuscle] = useState('')
  const [series, setSeries] = useState('3')
  const [reps,   setReps]   = useState('12')
  const [rest,   setRest]   = useState('60s')
  const [err,    setErr]    = useState('')

  function handleAdd() {
    if (!name.trim()) { setErr('Informe o nome do exercício.'); return }
    const scheme = `${series.trim() || '3'} × ${reps.trim() || '12'}`
    onAdd({ name: name.trim(), muscle: muscle.trim() || '—', scheme, rest: rest.trim() || '60s' })
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A',
    outline: 'none', boxSizing: 'border-box',
  }
  const numBase: React.CSSProperties = { ...inputBase, font: `700 15px ${FF}`, textAlign: 'center' }

  function focusOn(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#E8542A'
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,84,42,.13)'
  }
  function focusOff(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#d9d3c4'
    e.currentTarget.style.boxShadow   = 'none'
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(0,0,0,.35)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Novo exercício</h2>
            <p style={{ font: `400 12.5px ${FF}`, color: '#9a948a', margin: '4px 0 0' }}>Preencha os campos e clique em adicionar</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Nome */}
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Nome do exercício</label>
        <input
          type="text" value={name} placeholder="Ex: Supino reto com barra"
          onChange={e => { setName(e.target.value); setErr('') }}
          onFocus={focusOn} onBlur={focusOff}
          style={{ ...inputBase, border: `1.5px solid ${err ? '#c4421e' : '#d9d3c4'}`, marginBottom: err ? 6 : 18 }}
        />
        {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginBottom: 14 }}>{err}</div>}

        {/* Grupo muscular */}
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>Grupo muscular</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {MUSCLE_CHIPS.map(m => (
            <button
              key={m} type="button" onClick={() => setMuscle(m)}
              style={{ border: `1.5px solid ${muscle === m ? '#E8542A' : '#e0d9c8'}`, background: muscle === m ? '#fdf3ee' : '#fff', color: muscle === m ? '#E8542A' : '#7c7869', font: `600 11.5px ${FF}`, borderRadius: 18, padding: '6px 12px', cursor: 'pointer' }}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text" value={muscle} placeholder="Ou escreva um grupo personalizado…"
          onChange={e => setMuscle(e.target.value)}
          onFocus={focusOn} onBlur={focusOff}
          style={{ ...inputBase, height: 42, font: `400 13.5px ${FF}`, marginBottom: 20 }}
        />

        {/* Séries × Reps × Descanso */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: 12, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Séries</label>
            <input type="text" value={series} onChange={e => setSeries(e.target.value)} onFocus={focusOn} onBlur={focusOff} style={numBase} />
          </div>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Reps / Duração</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: `700 18px ${FF}`, color: '#c9c1b0', flexShrink: 0 }}>×</span>
              <input type="text" value={reps} onChange={e => setReps(e.target.value)} onFocus={focusOn} onBlur={focusOff} placeholder="12 ou 30s" style={{ ...numBase, flex: 1, width: 'auto' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Descanso</label>
            <input type="text" value={rest} onChange={e => setRest(e.target.value)} onFocus={focusOn} onBlur={focusOff} placeholder="60s" style={numBase} />
          </div>
        </div>

        {/* Preview */}
        {name.trim() && (
          <div style={{ background: '#faf7ee', border: '1px solid #e0d9c8', borderRadius: 11, padding: '11px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name.trim()}</div>
            <div style={{ font: `600 11.5px ${FF}`, color: '#9a948a', flexShrink: 0 }}>{muscle || '—'}</div>
            <div style={{ font: `800 13px ${FF}`, color: '#1B2A4A', flexShrink: 0 }}>{series || '3'} × {reps || '12'}</div>
            <div style={{ font: `500 11px ${FF}`, color: '#b0a99c', flexShrink: 0 }}>desc. {rest || '60s'}</div>
          </div>
        )}

        <button
          type="button" onClick={handleAdd}
          style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          Adicionar exercício
        </button>
      </div>
    </div>
  )
}

// ── Exercise picker modal ─────────────────────────────────────
function ExercisePickerModal({ library, onSelect, onCreateNew, onClose }: {
  library:     LibraryExercise[]
  onSelect:    (ex: Omit<Exercise, '_k'>) => void
  onCreateNew: () => void
  onClose:     () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? library.filter(ex => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q))
    : library

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.55)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

        <div style={{ padding: '22px 22px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Adicionar exercício</h2>
            <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar exercício…"
              style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#faf7ee', padding: '0 14px 0 36px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' as const }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', font: `500 13.5px ${FF}`, color: '#a89f8e' }}>
              Nenhum exercício encontrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
              {filtered.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(ex)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 11, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .1s, background .1s' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#E8542A'; el.style.background = '#fdf3ee' }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#ece7d9'; el.style.background = '#fff' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                    <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>{ex.muscle}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>{ex.scheme}</div>
                    <div style={{ font: `500 10.5px ${FF}`, color: '#b0a99c' }}>desc. {ex.rest}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px 20px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          <button
            type="button"
            onClick={onCreateNew}
            style={{ width: '100%', height: 46, border: '1.5px dashed #d8d1c0', background: 'none', color: '#7c7869', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#E8542A'; el.style.color = '#E8542A' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = '#d8d1c0'; el.style.color = '#7c7869' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Criar novo exercício
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Treino drawer ────────────────────────────────────────────
function TreinoDrawer({ treino, library, onClose, onOpenAssign, onDuplicate, onUpdate, onAddToLibrary, onDelete }: {
  treino:          Treino
  library:         LibraryExercise[]
  onClose:         () => void
  onOpenAssign:    () => void
  onDuplicate:     () => void
  onUpdate:        (t: Treino) => void
  onAddToLibrary:  (ex: LibraryExercise) => void
  onDelete:        () => void
}) {
  const g = GOAL_STYLE[treino.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
  const [exercises,   setExercises]   = useState<Exercise[]>(treino.ex)
  const [_dragId,     setDragId]      = useState<number | null>(null)
  const [dragOver,    setDragOver]    = useState<number | null>(null)
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [exModalOpen,   setExModalOpen]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const dragRef  = useRef<number | null>(null)
  const nextExK  = useRef(Date.now())

  useEffect(() => { setExercises(treino.ex) }, [treino.id])

  function handleDragStart(e: DragEvent<HTMLDivElement>, k: number) {
    dragRef.current = k; setDragId(k)
    try { e.dataTransfer.effectAllowed = 'move' } catch {}
    e.currentTarget.style.opacity = '0.5'
  }
  function handleDragEnd(e: DragEvent<HTMLDivElement>) {
    e.currentTarget.style.opacity = '1'; setDragId(null); setDragOver(null); dragRef.current = null
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>, k: number) {
    e.preventDefault(); if (dragOver !== k) setDragOver(k)
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
  }
  function handleDrop(e: DragEvent<HTMLDivElement>, targetK: number) {
    e.preventDefault(); setDragOver(null)
    const fromK = dragRef.current; if (!fromK || fromK === targetK) return
    const arr = [...exercises]
    const from = arr.findIndex(x => x._k === fromK)
    const to   = arr.findIndex(x => x._k === targetK)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    setExercises(arr); onUpdate({ ...treino, ex: arr })
  }

  function handleAddEx(data: Omit<Exercise, '_k'>) {
    const ex: Exercise = { ...data, _k: nextExK.current++ }
    const updated = [...exercises, ex]
    setExercises(updated)
    onUpdate({ ...treino, ex: updated })
    onAddToLibrary({ name: data.name, muscle: data.muscle, scheme: data.scheme, rest: data.rest })
    setExModalOpen(false)
  }

  function handlePickEx(data: Omit<Exercise, '_k'>) {
    const ex: Exercise = { ...data, _k: nextExK.current++ }
    const updated = [...exercises, ex]
    setExercises(updated)
    onUpdate({ ...treino, ex: updated })
    setPickerOpen(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '94vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '24px 24px 22px', position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
          <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '5px 11px' }}>{treino.goal}</span>
          <h2 style={{ font: `800 22px ${FF}`, color: '#fff', letterSpacing: '-.4px', margin: '13px 0 5px' }}>{treino.name}</h2>
          <div style={{ font: `500 12.5px ${FF}`, color: '#aeb9cc' }}>{treino.split} · {exercises.length} exercícios · {treino.duration}</div>
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>Exercícios</div>
            <span style={{ font: `400 11px ${FF}`, color: '#b0a99c' }}>arraste para reordenar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {exercises.map((ex, i) => (
              <ExRow
                key={ex._k}
                ex={ex} order={i + 1} tagBg={g.bg} tagColor={g.color}
                dragOverId={dragOver}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}   onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ))}
          </div>
          <button
            type="button" onClick={() => setPickerOpen(true)}
            style={{ marginTop: 10, width: '100%', border: '1.5px dashed #d8d1c0', background: 'none', color: '#9a948a', font: `600 12.5px ${FF}`, cursor: 'pointer', padding: 11, borderRadius: 10 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.color = '#E8542A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d8d1c0'; e.currentTarget.style.color = '#9a948a' }}
          >
            + Adicionar exercício
          </button>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '16px 24px', background: '#fff', borderTop: '1px solid #ece7d9' }}>
          {deleteConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ font: `600 13px ${FF}`, color: '#c4421e', textAlign: 'center' }}>
                Excluir <strong>"{treino.name}"</strong>?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button" onClick={() => setDeleteConfirm(false)}
                  style={{ flex: 1, height: 44, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                >
                  Cancelar
                </button>
                <button
                  type="button" onClick={onDelete}
                  style={{ flex: 1, height: 44, border: 'none', background: '#c4421e', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #a33519' }}
                >
                  Sim, excluir
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button" onClick={() => setDeleteConfirm(true)}
                aria-label="Excluir treino"
                style={{ width: 46, height: 46, border: '1.5px solid #e0d9c8', background: '#fff', color: '#a89f8e', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4421e'; e.currentTarget.style.color = '#c4421e'; e.currentTarget.style.background = '#fdf3ee' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.color = '#a89f8e'; e.currentTarget.style.background = '#fff' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
              <button
                type="button" onClick={onDuplicate}
                style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                Duplicar
              </button>
              <button
                type="button" onClick={onOpenAssign}
                style={{ flex: 2, height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
                Atribuir a aluno
              </button>
            </div>
          )}
        </div>
      </div>
      {pickerOpen && (
        <ExercisePickerModal
          library={library}
          onSelect={handlePickEx}
          onCreateNew={() => { setPickerOpen(false); setExModalOpen(true) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {exModalOpen && <NewExerciseModal onClose={() => setExModalOpen(false)} onAdd={handleAddEx} />}
    </>
  )
}

// ── Assign modal ─────────────────────────────────────────────
function AssignModal({ treinoName, selected, onToggle, onConfirm, onClose }: {
  treinoName: string
  selected:   Set<number>
  onToggle:   (id: number) => void
  onConfirm:  () => void
  onClose:    () => void
}) {
  const n = selected.size
  const label = n ? `Atribuir a ${n} aluno${n > 1 ? 's' : ''}` : 'Atribuir treino'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Atribuir treino</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <p style={{ font: `400 13px ${FF}`, color: '#9a948a', margin: '0 0 16px' }}>
          <strong style={{ color: '#1B2A4A' }}>{treinoName}</strong> — selecione os alunos
        </p>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {STUDENT_SEED.map(s => {
            const sel = selected.has(s.id)
            const pal = avatarPalette(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${sel ? '#E8542A' : '#ece7d9'}`, background: sel ? '#fdf3ee' : '#fff', borderRadius: 12, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background .1s, border-color .1s' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                  {getInitials(s.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a' }}>{s.goal}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? '#E8542A' : '#d2cbbb'}`, background: sel ? '#E8542A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .1s, border-color .1s' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sel ? 1 : 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              </button>
            )
          })}
        </div>
        <button type="button" onClick={onConfirm} style={{ marginTop: 16, width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
          {label}
        </button>
      </div>
    </div>
  )
}

// ── New treino modal ─────────────────────────────────────────
function NewTreinoModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd:   (name: string, goal: Goal) => void
}) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<Goal>('Hipertrofia')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Novo treino</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Nome do treino</label>
        <input
          type="text" placeholder="Ex: Treino A — Peito e Tríceps" value={name}
          onChange={e => setName(e.target.value)}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 14 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
        />

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>Objetivo</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
          {GOALS.map(g => {
            const s = GOAL_STYLE[g]; const active = goal === g
            return (
              <button
                key={g} type="button" onClick={() => setGoal(g)}
                style={{ border: `1.5px solid ${active ? s.color : '#e0d9c8'}`, background: active ? s.color : '#fff', color: active ? '#fff' : '#7c7869', font: `600 12.5px ${FF}`, borderRadius: 20, padding: '8px 14px', cursor: 'pointer' }}
              >
                {g}
              </button>
            )
          })}
        </div>
        <button
          type="button" onClick={() => onAdd(name, goal)}
          style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          Criar e montar exercícios
        </button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function Treinos() {
  const [treinos,    setTreinos]    = useState<Treino[]>(() => SEED_TREINOS.map(t => ({ ...t, ex: t.ex.map(e => ({ ...e })) })))
  const [library,    setLibrary]    = useState<LibraryExercise[]>(buildInitialLibrary)
  const [query,      setQuery]      = useState('')
  const [filter,     setFilter]     = useState<Goal | 'all'>('all')
  const [openId,     setOpenId]     = useState<number | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [newOpen,    setNewOpen]    = useState(false)
  const [toast,      setToast]      = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextId   = useRef(SEED_TREINOS.length + 1)
  const nextK    = useRef(9000)

  function handleAddToLibrary(ex: LibraryExercise) {
    setLibrary(prev => {
      if (prev.some(e => e.name.toLowerCase() === ex.name.toLowerCase())) return prev
      return [...prev, ex]
    })
  }

  useEffect(() => () => clearTimeout(toastRef.current), [])

  function showToast(msg: string) {
    setToast(msg); clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1900)
  }

  const q = query.trim().toLowerCase()
  const visible = treinos.filter(t => {
    const okGoal = filter === 'all' || t.goal === filter
    const okQ    = !q || t.name.toLowerCase().includes(q) || t.split.toLowerCase().includes(q)
    return okGoal && okQ
  })

  const totalCount    = treinos.length
  const assignedCount = treinos.reduce((a, t) => a + t.assigned, 0)
  const openTreino    = openId !== null ? treinos.find(t => t.id === openId) ?? null : null

  function handleUpdate(updated: Treino) {
    setTreinos(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  function handleToggleStudent(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleConfirmAssign() {
    const n = selected.size
    if (!n) { showToast('Selecione ao menos um aluno.'); return }
    setTreinos(prev => prev.map(t => t.id === openId ? { ...t, assigned: t.assigned + n } : t))
    setAssignOpen(false); setOpenId(null); setSelected(new Set())
    showToast(`${n} aluno${n > 1 ? 's' : ''} recebeu o treino.`)
  }

  function handleDuplicate(id: number) {
    const original = treinos.find(t => t.id === id)
    if (!original) return
    const newId = nextId.current++
    let baseK = nextK.current
    const copy: Treino = {
      ...original,
      id:       newId,
      name:     original.name + ' (cópia)',
      assigned: 0,
      ex:       original.ex.map(ex => ({ ...ex, _k: baseK++ })),
    }
    nextK.current = baseK
    setTreinos(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
    setOpenId(newId)
    showToast('Treino duplicado.')
  }

  function handleDelete(id: number) {
    setTreinos(prev => prev.filter(t => t.id !== id))
    setOpenId(null)
    showToast('Treino excluído.')
  }

  function handleAddTreino(name: string, goal: Goal) {
    if (!name.trim()) { showToast('Dê um nome ao treino.'); return }
    const id = nextId.current++
    const t: Treino = { id, name: name.trim(), split: goal + ' · Novo', goal, duration: '— min', assigned: 0, ex: [] }
    setTreinos(prev => [t, ...prev])
    setNewOpen(false); setOpenId(id)
    showToast('Treino criado. Adicione os exercícios.')
  }

  function chipStyle(active: boolean, accent = '#1B2A4A') {
    return {
      border: `1.5px solid ${active ? accent : '#e0d9c8'}`,
      background: active ? accent : '#fff',
      color: active ? '#fff' : '#7c7869',
      font: `600 12.5px ${FF}`,
      borderRadius: 20,
      padding: '8px 14px',
      cursor: 'pointer' as const,
    }
  }

  return (
    <div style={{ padding: '30px 34px 40px', maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Treinos</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
            <strong style={{ color: '#1B2A4A' }}>{totalCount}</strong> modelos na biblioteca ·{' '}
            <strong style={{ color: '#1B2A4A' }}>{assignedCount}</strong> atribuições ativas
          </p>
        </div>
        <button
          type="button" onClick={() => setNewOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Novo treino
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          <input
            type="text" placeholder="Buscar treino…" value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', height: 42, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#fff', padding: '0 14px 0 38px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.12)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>Todos</button>
          {GOALS.map(g => (
            <button key={g} type="button" onClick={() => setFilter(g)} style={chipStyle(filter === g, GOAL_STYLE[g].color)}>{g}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
        {visible.map(t => <TreinoCard key={t.id} t={t} onClick={setOpenId} />)}
        {visible.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d8d1c0', borderRadius: 14 }}>
            Nenhum treino encontrado para este filtro.
          </div>
        )}
      </div>

      {/* Treino detail drawer */}
      {openTreino && (
        <TreinoDrawer
          treino={openTreino}
          library={library}
          onClose={() => setOpenId(null)}
          onOpenAssign={() => { setSelected(new Set()); setAssignOpen(true) }}
          onDuplicate={() => handleDuplicate(openTreino.id)}
          onUpdate={handleUpdate}
          onAddToLibrary={handleAddToLibrary}
          onDelete={() => handleDelete(openTreino.id)}
        />
      )}

      {/* Assign modal */}
      {assignOpen && openTreino && (
        <AssignModal
          treinoName={openTreino.name}
          selected={selected}
          onToggle={handleToggleStudent}
          onConfirm={handleConfirmAssign}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {/* New treino modal */}
      {newOpen && <NewTreinoModal onClose={() => setNewOpen(false)} onAdd={handleAddTreino} />}

      <Toast msg={toast} />
    </div>
  )
}
