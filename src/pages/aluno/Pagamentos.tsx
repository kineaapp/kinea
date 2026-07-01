import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, CreditCard } from 'lucide-react'

const FEATURES = ['Treinos personalizados', 'Avaliação mensal', 'Suporte via chat', 'Acesso ao app']

const HISTORY = [
  { date: '01/06/2025', desc: 'Plano Mensal', value: 'R$ 350,00', status: 'Pago' },
  { date: '01/05/2025', desc: 'Plano Mensal', value: 'R$ 350,00', status: 'Pago' },
  { date: '01/04/2025', desc: 'Plano Mensal', value: 'R$ 350,00', status: 'Pago' },
  { date: '01/03/2025', desc: 'Plano Mensal', value: 'R$ 350,00', status: 'Pago' },
]

export default function Pagamentos() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>
      {/* Back bar */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: '#EDE8DC', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2} />
        </button>
        <h1 style={{ font: `800 20px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Pagamentos</h1>
      </div>

      {/* Plan card */}
      <div style={{ margin: '0 18px 16px', background: 'linear-gradient(135deg,#1B2A4A,#2D4270)', borderRadius: 20, padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(232,84,42,.15)', top: -40, right: -30, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', background: 'rgba(232,84,42,.10)', bottom: -20, right: 60, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>Plano Atual</div>
          <div style={{ font: `900 26px "Libre Franklin",sans-serif`, color: '#FAEEDA', letterSpacing: '-.5px', marginBottom: 4 }}>Mensal</div>
          <div style={{ font: `400 13px "Libre Franklin",sans-serif`, color: '#8B97AD', marginBottom: 16 }}>R$ 350,00/mês · Renova em 01/07/2025</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={14} color="#4CAF8A" strokeWidth={2.5} />
                <span style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#FAEEDA' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div style={{ margin: '0 18px 16px', background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CreditCard size={18} color="#1B2A4A" strokeWidth={2} />
        </div>
        <span style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', flex: 1 }}>•••• •••• •••• 4231</span>
        <button style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#E8542A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Trocar</button>
      </div>

      {/* History */}
      <div style={{ margin: '0 18px' }}>
        <div style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Histórico</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
          {HISTORY.map((h, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: i < HISTORY.length - 1 ? '1px solid #F5F0E8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 2 }}>{h.desc}</div>
                <div style={{ font: `400 11px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{h.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: `700 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 2 }}>{h.value}</div>
                <div style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#4CAF8A' }}>{h.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
