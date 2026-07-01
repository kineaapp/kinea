import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreHorizontal, Check } from 'lucide-react'

const EXERCISES = [
  { name: 'Supino Reto',        category: 'PEITO',   muscle: 'Peitoral Maior',    equipment: 'Barra',      sets: 4, defaultReps: 12 },
  { name: 'Crucifixo Inclinado',category: 'PEITO',   muscle: 'Peitoral',          equipment: 'Halteres',   sets: 3, defaultReps: 15 },
  { name: 'Tríceps Corda',      category: 'TRÍCEPS', muscle: 'Tríceps Braquial',  equipment: 'Cabo',       sets: 4, defaultReps: 12 },
  { name: 'Paralelas',          category: 'TRÍCEPS', muscle: 'Tríceps',           equipment: 'Paralelas',  sets: 3, defaultReps: 10 },
  { name: 'Supino Inclinado',   category: 'PEITO',   muscle: 'Peitoral Superior', equipment: 'Halteres',   sets: 3, defaultReps: 12 },
  { name: 'Extensão Tríceps',   category: 'TRÍCEPS', muscle: 'Tríceps',           equipment: 'Barra W',    sets: 3, defaultReps: 12 },
  { name: 'Crossover',          category: 'PEITO',   muscle: 'Peitoral',          equipment: 'Cabo',       sets: 3, defaultReps: 15 },
  { name: 'Mergulho',           category: 'TRÍCEPS', muscle: 'Tríceps',           equipment: 'Banco',      sets: 3, defaultReps: 12 },
]

const TIMER_MAX = 60
const CIRC = 2 * Math.PI * 70

export default function Execucao() {
  const navigate = useNavigate()
  const [exIdx, setExIdx] = useState(0)
  const [setsDone, setSetsDone] = useState<number[]>([])
  const [reps, setReps] = useState(EXERCISES[0].defaultReps)
  const [timerSec, setTimerSec] = useState(TIMER_MAX)
  const [timerRunning, setTimerRunning] = useState(false)

  const ex = EXERCISES[exIdx]
  const totalExs = EXERCISES.length
  const currentSet = setsDone.length

  const totalSets = EXERCISES.reduce((a, e) => a + e.sets, 0)
  const doneSets  = EXERCISES.slice(0, exIdx).reduce((a, e) => a + e.sets, 0) + setsDone.length
  const progress  = totalSets > 0 ? doneSets / totalSets : 0
  const timerOffset = (1 - timerSec / TIMER_MAX) * CIRC

  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => {
      setTimerSec(s => {
        if (s <= 1) { setTimerRunning(false); return TIMER_MAX }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  function handleSerieConc() {
    const next = [...setsDone, reps]
    if (next.length >= ex.sets) {
      if (exIdx < totalExs - 1) {
        const nextEx = EXERCISES[exIdx + 1]
        setExIdx(exIdx + 1)
        setSetsDone([])
        setReps(nextEx.defaultReps)
      } else {
        navigate('/aluno/treinos')
        return
      }
    } else {
      setSetsDone(next)
    }
    setTimerSec(TIMER_MAX)
    setTimerRunning(true)
  }

  const isLast = currentSet >= ex.sets - 1 && exIdx >= totalExs - 1

  return (
    <div style={{ background: '#1B2A4A', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/aluno/treinos')} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color="#FAEEDA" strokeWidth={2} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>Peito e Tríceps A</div>
          <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#E8542A', marginTop: 2 }}>Exercício {exIdx + 1} de {totalExs}</div>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MoreHorizontal size={20} color="#FAEEDA" strokeWidth={2} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ margin: '0 18px 20px', background: 'rgba(255,255,255,.1)', height: 4, borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#E8542A', borderRadius: 4, transition: 'width 400ms ease' }} />
      </div>

      {/* Exercise name */}
      <div style={{ padding: '0 22px 16px' }}>
        <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>
          {ex.category}
        </div>
        <div style={{ font: `900 28px "Libre Franklin",sans-serif`, color: '#FAEEDA', letterSpacing: '-.7px', marginBottom: 12 }}>
          {ex.name}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: 'rgba(232,84,42,.2)', borderRadius: 20, padding: '5px 12px', font: `600 11px "Libre Franklin",sans-serif`, color: '#E8542A' }}>
            {ex.muscle}
          </span>
          <span style={{ background: 'rgba(255,255,255,.08)', borderRadius: 20, padding: '5px 12px', font: `600 11px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>
            {ex.equipment}
          </span>
        </div>
      </div>

      {/* Timer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg
          width={160} height={160} viewBox="0 0 160 160"
          onClick={() => setTimerRunning(r => !r)}
          style={{ cursor: 'pointer' }}
        >
          <circle cx={80} cy={80} r={70} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
          <circle
            cx={80} cy={80} r={70} fill="none"
            stroke="#E8542A" strokeWidth={8}
            strokeDasharray={CIRC}
            strokeDashoffset={timerOffset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ transition: timerRunning ? 'stroke-dashoffset .9s linear' : 'none' }}
          />
          <text x={80} y={72} textAnchor="middle" fill="#FAEEDA" style={{ font: `900 42px "Libre Franklin",sans-serif` }}>
            {String(timerSec).padStart(2, '0')}
          </text>
          <text x={80} y={100} textAnchor="middle" fill="#8B97AD" style={{ font: `500 12px "Libre Franklin",sans-serif` }}>
            {timerRunning ? 'descanso' : 'toque para iniciar'}
          </text>
        </svg>
      </div>

      {/* Sets block */}
      <div style={{ margin: '0 18px', background: 'rgba(255,255,255,.06)', borderRadius: 18, padding: 18, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: ex.sets }).map((_, i) => {
            if (i < setsDone.length) return (
              <div key={i} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: '#4CAF8A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={13} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#8B97AD', flex: 1 }}>Série {i + 1}</span>
                <span style={{ font: `700 13px "Libre Franklin",sans-serif`, color: '#4CAF8A' }}>{setsDone[i]} reps</span>
              </div>
            )

            if (i === setsDone.length) return (
              <div key={i} style={{ background: 'rgba(232,84,42,.12)', border: '1.5px solid rgba(232,84,42,.3)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: 'rgba(232,84,42,.2)', border: '1.5px solid #E8542A', borderRadius: 6, flexShrink: 0 }} />
                <span style={{ font: `700 13px "Libre Franklin",sans-serif`, color: '#FAEEDA', flex: 1 }}>Série {i + 1} — atual</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setReps(r => Math.max(1, r - 1))} style={{ width: 28, height: 28, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px "Libre Franklin",sans-serif`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#FAEEDA', minWidth: 24, textAlign: 'center' }}>{reps}</span>
                  <button onClick={() => setReps(r => r + 1)} style={{ width: 28, height: 28, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#FAEEDA', font: `700 18px "Libre Franklin",sans-serif`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            )

            return (
              <div key={i} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, flexShrink: 0 }} />
                <span style={{ font: `600 13px "Libre Franklin",sans-serif`, color: 'rgba(139,151,173,.5)' }}>Série {i + 1}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 18px 32px' }}>
        <button
          onClick={handleSerieConc}
          style={{ width: '100%', padding: 16, background: '#E8542A', border: 'none', borderRadius: 14, font: `700 16px "Libre Franklin",sans-serif`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}
        >
          {isLast ? 'Concluir Treino' : 'Série concluída'}
        </button>
      </div>
    </div>
  )
}
