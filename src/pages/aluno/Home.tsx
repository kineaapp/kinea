import { useNavigate } from 'react-router-dom'
import { MessageCircle, Clock, Layers, BarChart2, Check, X } from 'lucide-react'

function Ring({ percent, color, value, total, label }: {
  percent: number; color: string; value: string; total: string; label: string
}) {
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = (1 - percent) * circ
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={48} height={48} viewBox="0 0 48 48">
        <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={5} />
        <circle
          cx={24} cy={24} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#FAEEDA', lineHeight: 1 }}>
          {value}
          <span style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>/{total}</span>
        </div>
        <div style={{ font: `500 9.5px "Libre Franklin",sans-serif`, color: '#8B97AD', letterSpacing: '.3px', marginTop: 3, textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

type DayState = 'done' | 'miss' | 'today' | 'future' | 'rest'

function CalDay({ label, state }: { label: string; state: DayState }) {
  const base: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const cell: Record<DayState, React.CSSProperties> = {
    done:   { ...base, background: '#4CAF8A' },
    miss:   { ...base, background: '#F4EFE3', border: '1.5px dashed #D6CFBE' },
    today:  { ...base, background: '#E8542A' },
    future: { ...base, background: '#F4EFE3', border: '1.5px solid #E0D9CC' },
    rest:   { ...base, background: '#F4EFE3', border: '1.5px dashed #D6CFBE' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ font: `600 10px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase' }}>{label}</span>
      <div style={cell[state]}>
        {state === 'done'   && <Check size={15} color="#fff" strokeWidth={2.5} />}
        {state === 'miss'   && <X size={13} color="#C5BFB0" strokeWidth={2.5} />}
        {state === 'today'  && <span style={{ font: `800 12px "Libre Franklin",sans-serif`, color: '#fff' }}>H</span>}
        {state === 'rest'   && <span style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#C5BFB0' }}>—</span>}
      </div>
    </div>
  )
}

const EXERCISES = ['Supino Reto', 'Crucifixo', 'Tríceps Corda', 'Paralelas', 'Supino Inclinado', 'Extensão Tríceps']

const WEEK: { label: string; state: DayState }[] = [
  { label: 'S', state: 'done' },
  { label: 'T', state: 'done' },
  { label: 'Q', state: 'today' },
  { label: 'Q', state: 'future' },
  { label: 'S', state: 'future' },
  { label: 'S', state: 'future' },
  { label: 'D', state: 'rest' },
]

export default function Home() {
  const navigate = useNavigate()
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%' }}>
      {/* Nav title */}
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ font: `800 20px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Início</h1>
      </div>

      {/* Hero block */}
      <div style={{ background: '#1B2A4A', padding: '20px 20px 24px', margin: '12px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 5 }}>
              {dateStr}
            </div>
            <div style={{ font: `800 22px "Libre Franklin",sans-serif`, color: '#FAEEDA', letterSpacing: '-.5px' }}>
              Olá, June!
            </div>
          </div>
          <button
            onClick={() => navigate('/aluno/chat')}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}
          >
            <MessageCircle size={20} color="#FAEEDA" strokeWidth={2} />
            <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#E8542A', border: '1.5px solid #1B2A4A' }} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Ring percent={0.80} color="#E8542A" value="4" total="5"    label="Treinos/sem" />
          <Ring percent={0.50} color="#4CAF8A" value="50" total="100%" label="Meta mensal" />
          <Ring percent={1.00} color="#F0B429" value="7" total="7"    label="Sequência"  />
        </div>
      </div>

      {/* Treino de Hoje */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: 0 }}>Treino de Hoje</h2>
          <button onClick={() => navigate('/aluno/treinos')} style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#E8542A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Ver todos
          </button>
        </div>

        <div
          onClick={() => navigate('/aluno/treinos/exec')}
          style={{ background: '#1B2A4A', borderRadius: 18, cursor: 'pointer', boxShadow: '0 6px 24px rgba(27,42,74,.25)', overflow: 'hidden' }}
        >
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 5 }}>
                QUA · PEITO E TRÍCEPS
              </div>
              <div style={{ font: `800 20px "Libre Franklin",sans-serif`, color: '#FAEEDA', letterSpacing: '-.3px', marginBottom: 12 }}>
                Peito e Tríceps A
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={12} color="#8B97AD" strokeWidth={2} />
                  <span style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>50 min</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Layers size={12} color="#8B97AD" strokeWidth={2} />
                  <span style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>8 exercícios</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BarChart2 size={12} color="#8B97AD" strokeWidth={2} />
                  <span style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>Avançado</span>
                </span>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); navigate('/aluno/treinos/exec') }}
              style={{ width: 42, height: 42, borderRadius: 12, background: '#E8542A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
            </button>
          </div>
          <div style={{ background: 'rgba(255,255,255,.05)', padding: '10px 20px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {EXERCISES.map(ex => (
              <span key={ex} style={{ background: 'rgba(255,255,255,.09)', borderRadius: 8, padding: '7px 11px', font: `600 11px "Libre Franklin",sans-serif`, color: '#FAEEDA', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {ex}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mensagem do Coach */}
      <div style={{ padding: '16px 18px 0' }}>
        <h2 style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: '0 0 12px' }}>Mensagem do Coach</h2>
        <div
          onClick={() => navigate('/aluno/chat')}
          style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(27,42,74,.07)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#fff' }}>RS</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 2 }}>Rafael Silva</div>
            <div style={{ font: `400 12.5px "Libre Franklin",sans-serif`, color: '#7C7869', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Ótimo treino hoje! Lembre de caprichar na contração...
            </div>
          </div>
          <span style={{ font: `400 11px "Libre Franklin",sans-serif`, color: '#A39E90', flexShrink: 0 }}>14:32</span>
        </div>
      </div>

      {/* Semana */}
      <div style={{ padding: '16px 18px 28px' }}>
        <h2 style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: '0 0 12px' }}>Semana</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {WEEK.map((d, i) => <CalDay key={i} label={d.label} state={d.state} />)}
        </div>
      </div>
    </div>
  )
}
