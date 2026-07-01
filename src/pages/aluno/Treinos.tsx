import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Coffee } from 'lucide-react'

type Status = 'done' | 'today' | 'rest' | 'future'

const DAYS: { day: string; name: string; duration: string; exs: number; status: Status; goal: string }[] = [
  { day: 'SEG', name: 'Peito e Tríceps A', duration: '50 min', exs: 8,  status: 'done',   goal: 'Hipertrofia' },
  { day: 'TER', name: 'Costas e Bíceps A', duration: '45 min', exs: 7,  status: 'done',   goal: 'Hipertrofia' },
  { day: 'QUA', name: 'Peito e Tríceps A', duration: '50 min', exs: 8,  status: 'today',  goal: 'Hipertrofia' },
  { day: 'QUI', name: 'Pernas B',          duration: '60 min', exs: 10, status: 'future', goal: 'Hipertrofia' },
  { day: 'SEX', name: 'Ombros e Tríceps',  duration: '40 min', exs: 6,  status: 'future', goal: 'Hipertrofia' },
  { day: 'SAB', name: 'Descanso ativo',    duration: '—',      exs: 0,  status: 'rest',   goal: '' },
  { day: 'DOM', name: 'Descanso',          duration: '—',      exs: 0,  status: 'rest',   goal: '' },
]

export default function Treinos() {
  const [tab, setTab] = useState<'this' | 'next'>('this')
  const navigate = useNavigate()

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '18px 20px 16px' }}>
        <h1 style={{ font: `800 24px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Meus Treinos</h1>
        <p style={{ font: `400 13px "Libre Franklin",sans-serif`, color: '#7C7869', margin: 0 }}>Programação semanal</p>
      </div>

      {/* Week tabs */}
      <div style={{ padding: '0 18px 16px' }}>
        <div style={{ background: '#EDE8DC', borderRadius: 11, padding: 4, display: 'flex' }}>
          {(['this', 'next'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', borderRadius: 8,
                background: tab === t ? '#1B2A4A' : 'transparent',
                font: `${tab === t ? 700 : 600} 12px "Libre Franklin",sans-serif`,
                color: tab === t ? '#FAEEDA' : '#7C7869',
                transition: 'all 180ms ease',
              }}
            >
              {t === 'this' ? 'Esta semana' : 'Próxima'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DAYS.map((d, i) => {
          if (d.status === 'rest') return (
            <div key={i} style={{ background: '#F4EFE3', borderRadius: 16, padding: '16px 18px', border: '1.5px dashed #D6CFBE', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F4EFE3', border: '1.5px dashed #D6CFBE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Coffee size={16} color="#C5BFB0" strokeWidth={2} />
              </div>
              <div>
                <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#C5BFB0', textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.day}</div>
                <div style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#C5BFB0', marginTop: 2 }}>{d.name}</div>
              </div>
            </div>
          )

          if (d.status === 'done') return (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#4CAF8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={18} color="#fff" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#4CAF8A', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>{d.day} · CONCLUÍDO ✓</div>
                <div style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}>{d.name}</div>
                <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#A39E90', marginTop: 2 }}>{d.goal}</div>
              </div>
            </div>
          )

          if (d.status === 'today') return (
            <div key={i} onClick={() => navigate('/aluno/treinos/exec')} style={{ background: 'linear-gradient(135deg,#1B2A4A,#2D4270)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 6px 20px rgba(27,42,74,.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#E8542A', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>{d.day} · HOJE</div>
                <div style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#FAEEDA' }}>{d.name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>{d.duration}</span>
                  <span style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>{d.exs} exercícios</span>
                </div>
              </div>
            </div>
          )

          return (
            <div key={i} style={{ background: '#F4EFE3', borderRadius: 16, padding: '16px 18px', border: '1.5px solid #E0D9CC', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F4EFE3', border: '1.5px solid #E0D9CC', flexShrink: 0 }} />
              <div>
                <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#C5BFB0', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>{d.day}</div>
                <div style={{ font: `700 15px "Libre Franklin",sans-serif`, color: '#C5BFB0' }}>{d.name}</div>
                <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#C5BFB0', marginTop: 2 }}>{d.duration}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
