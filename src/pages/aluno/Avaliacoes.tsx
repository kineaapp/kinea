import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

export default function Avaliacoes() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [nextAssessment, setNextAssessment] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('students')
      .select('next_assessment')
      .eq('student_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNextAssessment(data?.next_assessment ?? null)
        setDataLoaded(true)
      })
  }, [user?.id])

  const daysPastDue = (dataLoaded && nextAssessment)
    ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(nextAssessment + 'T00:00:00').getTime()) / 86_400_000)
    : null

  const isAssessmentDue = daysPastDue !== null && daysPastDue >= 0
  const daysUntil = daysPastDue !== null ? -daysPastDue : null

  const metrics = [
    { label: 'Peso',       value: '78.4', unit: 'kg', delta: '▼ −1.2 kg', deltaColor: '#4CAF8A', dark: true },
    { label: '% Gordura',  value: '16.2', unit: '%',  delta: '▼ −0.8%',   deltaColor: '#4CAF8A', dark: false },
    { label: 'Massa Magra',value: '65.7', unit: 'kg', delta: '→ +0.3 kg', deltaColor: '#F0B429', dark: false },
    { label: 'IMC',        value: '24.1', unit: '',   delta: 'Normal',    deltaColor: '#F0B429', dark: false },
  ]

  const circs = [
    { label: 'Cintura',   value: '78 cm',  fill: '#E8542A', pct: 0.62 },
    { label: 'Quadril',   value: '96 cm',  fill: '#1B2A4A', pct: 0.78 },
    { label: 'Tórax',     value: '100 cm', fill: '#1B2A4A', pct: 0.84 },
    { label: 'Braço (D)', value: '34 cm',  fill: '#4CAF8A', pct: 0.42 },
  ]

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 16px' }}>
        <h1 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Avaliações</h1>
        <p style={{ font: `400 13px ${FF}`, color: '#7C7869', margin: 0 }}>Última avaliação: 15/06/2025</p>
      </div>

      {/* Assessment status card */}
      {dataLoaded && nextAssessment && (
        <div style={{ padding: '0 18px', marginBottom: 16 }}>
          {isAssessmentDue ? (
            <button
              type="button"
              onClick={() => navigate('/aluno/nova-avaliacao')}
              style={{
                width: '100%', padding: '16px 18px',
                background: '#E8542A', border: 'none', borderRadius: 16,
                boxShadow: '0 4px 0 #C4421E',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: `700 15px ${FF}`, color: '#fff' }}>
                  {daysPastDue === 0 ? 'Sua avaliação é hoje!' : `Avaliação há ${daysPastDue} dia${daysPastDue! > 1 ? 's' : ''}`}
                </div>
                <div style={{ font: `400 12px ${FF}`, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
                  Toque para registrar agora
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ) : (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(27,42,74,.07)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: '#f0f8ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>
                  Próxima avaliação em {daysUntil} dia{daysUntil !== 1 ? 's' : ''}
                </div>
                <div style={{ font: `400 11px ${FF}`, color: '#A39E90', marginTop: 2 }}>
                  {new Date(nextAssessment + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics 2x2 */}
      <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {metrics.map(m => (
          <div key={m.label} style={{
            background: m.dark ? '#1B2A4A' : '#fff',
            borderRadius: 16, padding: 16,
            boxShadow: m.dark ? 'none' : '0 2px 8px rgba(27,42,74,.07)',
          }}>
            <div style={{ font: `500 11px ${FF}`, color: m.dark ? '#8B97AD' : '#A39E90', marginBottom: 8 }}>{m.label}</div>
            <div style={{ font: `900 26px ${FF}`, color: m.dark ? '#FAEEDA' : '#1B2A4A' }}>
              {m.value}
              <span style={{ font: `500 14px ${FF}`, color: m.dark ? '#8B97AD' : '#A39E90' }}>{m.unit}</span>
            </div>
            <div style={{ font: `600 11px ${FF}`, color: m.deltaColor, marginTop: 4 }}>{m.delta}</div>
          </div>
        ))}
      </div>

      {/* Weight chart */}
      <div style={{ padding: '0 18px', marginBottom: 10 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
          <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 14 }}>Evolução do Peso</div>
          <svg width="100%" height={100} viewBox="0 0 300 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8542A" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#E8542A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points="0,72 50,68 100,74 150,62 200,57 250,54 300,50 300,100 0,100" fill="url(#wgrad)" />
            <polyline points="0,72 50,68 100,74 150,62 200,57 250,54 300,50" fill="none" stroke="#E8542A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={300} cy={50} r={5} fill="#E8542A" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {months.map(m => (
              <span key={m} style={{ font: `400 10px ${FF}`, color: '#C5BFB0' }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Circumferences */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
          <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 14 }}>Circunferências</div>
          {circs.map(({ label, value, fill, pct }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ font: `500 13px ${FF}`, color: '#7C7869', width: 80, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 6, background: '#F4EFE3', borderRadius: 4 }}>
                <div style={{ width: `${pct * 100}%`, height: '100%', background: fill, borderRadius: 4 }} />
              </div>
              <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A', minWidth: 52, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
