import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, CreditCard, Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

const FF = '"Libre Franklin",sans-serif'
const FN_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

const FEATURES = ['Treinos personalizados', 'Avaliação mensal', 'Suporte via chat', 'Acesso ao app']

const HISTORY = [
  { date: '01/06/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/05/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/04/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
  { date: '01/03/2025', desc: 'Plano Mensal', value: 'R$ 399,00', status: 'Pago' },
]

const PLANS = [
  { id: 'mensal',     label: 'Mensal',     price: 'R$ 399,00', period: '/mês', sub: 'Renovação mensal automática',                renew: '' },
  { id: 'trimestral', label: 'Trimestral', price: 'R$ 247,00', period: '/mês', sub: 'Renovação mensal · compromisso trimestral',  renew: '' },
  { id: 'semestral',  label: 'Semestral',  price: 'R$ 227,00', period: '/mês', sub: 'Renovação mensal · compromisso semestral',   renew: '', badge: 'ECONOMIZE 43%' },
  { id: 'anual',      label: 'Anual',      price: 'R$ 207,00', period: '/mês', sub: 'Renovação mensal · compromisso anual',       renew: '', badge: 'ECONOMIZE 48%' },
]

function daysUntil(unixTs: number): number {
  return Math.ceil((unixTs * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(unixTs: number): string {
  return new Date(unixTs * 1000).toLocaleDateString('pt-BR')
}

export default function Pagamentos() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()

  const [studentId,    setStudentId]    = useState<number | null>(null)
  const [currentPlanId,setCurrentPlanId]= useState('mensal')
  const [periodEnd,    setPeriodEnd]    = useState<number | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selectedPlan, setSelectedPlan] = useState('mensal')
  const [step,         setStep]         = useState<'idle' | 'confirming' | 'done' | 'error'>('idle')
  const [submitting,   setSubmitting]   = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('students')
      .select('id, plan, stripe_current_period_end')
      .eq('student_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const planId = data.plan ?? 'mensal'
          setStudentId(data.id)
          setCurrentPlanId(planId)
          setSelectedPlan(planId)
          if (data.stripe_current_period_end) setPeriodEnd(data.stripe_current_period_end)
        }
        setLoading(false)
      })
  }, [user?.id])

  const days        = periodEnd ? daysUntil(periodEnd) : null
  const renewalDate = periodEnd ? formatDate(periodEnd) : null
  const nearRenewal = days !== null && days <= 7
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0]
  const selectedPlanObj = PLANS.find(p => p.id === selectedPlan)!
  const changed     = selectedPlan !== currentPlanId

  async function handleConfirm() {
    if (!studentId || !changed) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      if (nearRenewal) {
        // Troca direta — sem aprovação do coach
        const res = await fetch(`${FN_URL}/update-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, requestedPlan: selectedPlan }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
      } else {
        // Solicita aprovação do coach
        const res = await fetch(`${FN_URL}/request-plan-change`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, requestedPlan: selectedPlan, type: 'mudanca' }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
      }
      setStep('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao processar solicitação.')
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ font: `400 14px ${FF}`, color: '#A39E90' }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>

      {/* Back bar */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: '#EDE8DC', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2} />
        </button>
        <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Pagamentos</h1>
      </div>

      {/* Banner pré-renovação */}
      {nearRenewal && step !== 'done' && (
        <div style={{ margin: '0 18px 16px', background: 'linear-gradient(135deg,#E8542A,#c4421e)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Bell size={18} color="#fff" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ font: `700 13px ${FF}`, color: '#fff', marginBottom: 2 }}>Próxima cobrança em {days} dias</div>
            <div style={{ font: `400 12px ${FF}`, color: 'rgba(255,255,255,.85)' }}>
              Sua assinatura renova em {renewalDate}. Aproveite para mudar de plano se quiser.
            </div>
          </div>
        </div>
      )}

      {/* Plano atual */}
      <div style={{ margin: '0 18px 16px', background: 'linear-gradient(135deg,#1B2A4A,#2D4270)', borderRadius: 20, padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(232,84,42,.15)', top: -40, right: -30, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', background: 'rgba(232,84,42,.10)', bottom: -20, right: 60, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>Plano Atual</div>
          <div style={{ font: `900 26px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px', marginBottom: 4 }}>{currentPlan.label}</div>
          <div style={{ font: `400 13px ${FF}`, color: '#8B97AD', marginBottom: 16 }}>
            {currentPlan.price}{currentPlan.period}
            {renewalDate ? ` · Próxima cobrança em ${renewalDate}` : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={14} color="#4CAF8A" strokeWidth={2.5} />
                <span style={{ font: `500 12px ${FF}`, color: '#FAEEDA' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seletor de planos */}
      {step !== 'done' && (
        <div style={{ margin: '0 18px 16px' }}>
          <div style={{ font: `600 11px ${FF}`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            {nearRenewal ? 'Trocar plano na próxima renovação' : 'Solicitar mudança de plano'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLANS.map(plan => {
              const active = selectedPlan === plan.id
              return (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlan(plan.id); setStep('idle'); setErrorMsg('') }}
                  style={{
                    background: active ? '#fff' : '#EDE8DC',
                    border: active ? '2px solid #1B2A4A' : '2px solid transparent',
                    borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    boxShadow: active ? '0 2px 8px rgba(27,42,74,.10)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: active ? '6px solid #1B2A4A' : '2px solid #A39E90', flexShrink: 0, transition: 'all .15s' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{plan.label}</span>
                      {plan.badge && <span style={{ font: `700 9px ${FF}`, color: '#fff', background: '#E8542A', borderRadius: 6, padding: '2px 6px', letterSpacing: '.3px' }}>{plan.badge}</span>}
                    </div>
                    <div style={{ font: `400 12px ${FF}`, color: '#A39E90' }}>{plan.sub}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ font: `800 16px ${FF}`, color: '#1B2A4A' }}>{plan.price}</span>
                    <span style={{ font: `400 12px ${FF}`, color: '#A39E90' }}>{plan.period}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Botão de ação */}
          {changed && step === 'idle' && (
            <button
              onClick={() => setStep('confirming')}
              style={{ width: '100%', marginTop: 12, background: '#1B2A4A', border: 'none', borderRadius: 14, padding: '14px 0', font: `700 14px ${FF}`, color: '#FAEEDA', cursor: 'pointer', letterSpacing: '-.2px' }}
            >
              {nearRenewal ? `Trocar para Plano ${selectedPlanObj.label} na renovação` : `Solicitar mudança para ${selectedPlanObj.label}`}
            </button>
          )}

          {/* Confirmação */}
          {changed && step === 'confirming' && (
            <div style={{ marginTop: 12, background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
              <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>
                {nearRenewal
                  ? `Trocar para Plano ${selectedPlanObj.label} a partir de ${renewalDate}?`
                  : `Solicitar mudança para Plano ${selectedPlanObj.label}?`}
              </div>
              <div style={{ font: `400 12px ${FF}`, color: '#A39E90', marginBottom: 14 }}>
                {nearRenewal
                  ? `${selectedPlanObj.price}/mês a partir da próxima cobrança.`
                  : 'Seu coach receberá um aviso e precisará confirmar a mudança.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('idle')} disabled={submitting} style={{ flex: 1, background: '#F4EFE3', border: 'none', borderRadius: 10, padding: '11px 0', font: `600 13px ${FF}`, color: '#1B2A4A', cursor: 'pointer', opacity: submitting ? .5 : 1 }}>Cancelar</button>
                <button onClick={handleConfirm} disabled={submitting} style={{ flex: 1, background: '#E8542A', border: 'none', borderRadius: 10, padding: '11px 0', font: `700 13px ${FF}`, color: '#fff', cursor: 'pointer', opacity: submitting ? .7 : 1 }}>
                  {submitting ? 'Aguarde...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Erro */}
          {step === 'error' && (
            <div style={{ marginTop: 12, background: '#fbe6e1', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ font: `600 13px ${FF}`, color: '#c4421e' }}>{errorMsg || 'Erro ao processar. Tente novamente.'}</div>
            </div>
          )}
        </div>
      )}

      {/* Feedback pós-ação */}
      {step === 'done' && (
        <div style={{ margin: '0 18px 16px', background: '#fff', borderRadius: 14, padding: '22px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Check size={24} color="#1B7a4a" strokeWidth={2.5} />
          </div>
          {nearRenewal ? (
            <>
              <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>Troca agendada!</div>
              <div style={{ font: `400 13px ${FF}`, color: '#A39E90' }}>
                Você passará para o Plano <strong style={{ color: '#1B2A4A' }}>{selectedPlanObj.label}</strong> a partir de {renewalDate}.
              </div>
            </>
          ) : (
            <>
              <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>Solicitação enviada!</div>
              <div style={{ font: `400 13px ${FF}`, color: '#A39E90' }}>
                Seu coach foi notificado e confirmará a mudança para o Plano <strong style={{ color: '#1B2A4A' }}>{selectedPlanObj.label}</strong>.
              </div>
            </>
          )}
        </div>
      )}

      {/* Forma de pagamento */}
      <div style={{ margin: '0 18px 16px', background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CreditCard size={18} color="#1B2A4A" strokeWidth={2} />
        </div>
        <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A', flex: 1 }}>•••• •••• •••• 4231</span>
        <button style={{ font: `600 12px ${FF}`, color: '#E8542A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Trocar</button>
      </div>

      {/* Histórico */}
      <div style={{ margin: '0 18px' }}>
        <div style={{ font: `600 11px ${FF}`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Histórico</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
          {HISTORY.map((h, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: i < HISTORY.length - 1 ? '1px solid #F5F0E8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{h.desc}</div>
                <div style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>{h.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{h.value}</div>
                <div style={{ font: `600 11px ${FF}`, color: '#4CAF8A' }}>{h.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
