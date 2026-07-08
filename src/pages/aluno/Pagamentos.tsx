import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, CreditCard } from 'lucide-react'

const FEATURES = ['Treinos personalizados', 'Avaliação mensal', 'Suporte via chat', 'Acesso ao app']

const HISTORY = [
  { date: '01/06/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/05/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/04/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/03/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
]

const PLANS = [
  { id: 'mensal',    label: 'Mensal',    price: 'R$ 399,00',  period: '/mês', sub: 'Cobrado mensalmente',                    renew: 'Renova em 01/07/2025' },
  { id: 'trimestral',label: 'Trimestral',price: 'R$ 741,00',  period: '',     sub: 'Em até 3x · R$ 247,00/mês',             renew: 'Renova em 01/10/2025' },
  { id: 'semestral', label: 'Semestral', price: 'R$ 1.362,00',period: '',     sub: 'Em até 6x · R$ 227,00/mês',             renew: 'Renova em 01/01/2026' },
  { id: 'anual',     label: 'Anual',     price: 'R$ 2.484,00',period: '',     sub: 'Em até 12x · R$ 207,00/mês',            renew: 'Renova em 01/07/2026', badge: 'ECONOMIZE 48%' },
]

export default function Pagamentos() {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState('mensal')
  const [confirming, setConfirming] = useState(false)

  const activePlan = PLANS.find(p => p.id === selectedPlan)!

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
          <div style={{ font: `400 13px "Libre Franklin",sans-serif`, color: '#8B97AD', marginBottom: 16 }}>R$ 399,00/mês · Renova em 01/07/2025</div>
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

      {/* Plan selector */}
      <div style={{ margin: '0 18px 16px' }}>
        <div style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Trocar Plano</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLANS.map(plan => {
            const active = selectedPlan === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlan(plan.id); setConfirming(false) }}
                style={{
                  background: active ? '#fff' : '#EDE8DC',
                  border: active ? '2px solid #1B2A4A' : '2px solid transparent',
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  boxShadow: active ? '0 2px 8px rgba(27,42,74,.10)' : 'none',
                  transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: active ? '6px solid #1B2A4A' : '2px solid #A39E90',
                  flexShrink: 0, transition: 'all .15s',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}>{plan.label}</span>
                    {plan.badge && (
                      <span style={{ font: `700 9px "Libre Franklin",sans-serif`, color: '#fff', background: '#E8542A', borderRadius: 6, padding: '2px 6px', letterSpacing: '.3px' }}>{plan.badge}</span>
                    )}
                  </div>
                  <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{plan.sub}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ font: `800 16px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}>{plan.price}</span>
                  <span style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{plan.period}</span>
                </div>
              </button>
            )
          })}
        </div>
        {selectedPlan !== 'mensal' && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            style={{ width: '100%', marginTop: 12, background: '#1B2A4A', border: 'none', borderRadius: 14, padding: '14px 0', font: `700 14px "Libre Franklin",sans-serif`, color: '#FAEEDA', cursor: 'pointer', letterSpacing: '-.2px' }}
          >
            Mudar para {activePlan.label}
          </button>
        )}
        {confirming && (
          <div style={{ marginTop: 12, background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 4 }}>Confirmar mudança para o Plano {activePlan.label}?</div>
            <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#A39E90', marginBottom: 14 }}>{activePlan.sub} · {activePlan.renew}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: '#F4EFE3', border: 'none', borderRadius: 10, padding: '11px 0', font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: '#E8542A', border: 'none', borderRadius: 10, padding: '11px 0', font: `700 13px "Libre Franklin",sans-serif`, color: '#fff', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        )}
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
