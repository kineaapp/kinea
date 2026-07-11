import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Check, Copy, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

const FF  = '"Libre Franklin",sans-serif'
const FNS = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

// ── Tipos ─────────────────────────────────────────────────────
interface Plan {
  code: string; label: string; value: number
  maxPayments: number | null; paymentMethod: 'CREDIT_CARD' | 'PIX'
  subLabel: string
}

interface SubPayment {
  id: string; cycleNumber: number; value: number
  status: string; paidAt: string | null; dueDate: string | null
  pixQrCode: string | null; pixCopyPaste: string | null
}

interface SubInfo {
  id: string; status: string; planCode: string; planLabel: string
  paymentMethod: string; currentCycle: number; maxCycles: number | null
  nextDueDate: string | null; payments: SubPayment[]
}

interface CustomerData { name: string; email: string; cpfCnpj: string; phone: string }

interface CardData {
  holderName: string; number: string
  expiryMonth: string; expiryYear: string; ccv: string
  postalCode: string; addressNumber: string
}

type Mode         = 'loading' | 'dashboard' | 'checkout'
type CheckoutStep = 'plan' | 'customer' | 'payment' | 'processing' | 'done-card' | 'done-pix'

// ── Constantes ────────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    code: 'monthly_399', label: 'Mensal', value: 399,
    maxPayments: null, paymentMethod: 'CREDIT_CARD',
    subLabel: 'Recorrência mensal automática · cartão',
  },
  {
    code: 'quarterly_card', label: 'Trimestral — Cartão', value: 247,
    maxPayments: 3, paymentMethod: 'CREDIT_CARD',
    subLabel: '3 cobranças mensais no cartão',
  },
  {
    code: 'quarterly_pix', label: 'Trimestral — Pix', value: 247,
    maxPayments: 3, paymentMethod: 'PIX',
    subLabel: '3 cobranças mensais via Pix',
  },
]

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Ativo',    color: '#1B7a4a', bg: '#e7f3ea' },
  pending:  { label: 'Pendente', color: '#b06a12', bg: '#f7ecd9' },
  overdue:  { label: 'Vencido',  color: '#c4421e', bg: '#fbe6e1' },
  canceled: { label: 'Cancelado',color: '#7c7869', bg: '#f4efe3' },
  finished: { label: 'Encerrado',color: '#7c7869', bg: '#f4efe3' },
}

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Pago',     color: '#1B7a4a' },
  pending:   { label: 'Pendente', color: '#b06a12' },
  overdue:   { label: 'Vencido',  color: '#c4421e' },
  refunded:  { label: 'Estornado',color: '#7c7869' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
function fmtCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function fmtPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

// ── Componentes de UI ─────────────────────────────────────────
function Inp({
  label, value, onChange, type = 'text', placeholder = '', mask,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; mask?: (v: string) => string
}) {
  const inp: React.CSSProperties = {
    width: '100%', height: 48, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 13px', font: `400 14px ${FF}`, color: '#1B2A4A',
    outline: 'none', boxSizing: 'border-box',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </label>
      <input
        type={type} style={inp} placeholder={placeholder} value={value}
        onChange={e => onChange(mask ? mask(e.target.value) : e.target.value)}
      />
    </div>
  )
}

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: n <= step ? '#E8542A' : '#ece7d9',
            color: n <= step ? '#fff' : '#9a948a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: `700 12px ${FF}`, flexShrink: 0,
          }}>
            {n < step ? <Check size={14} strokeWidth={2.5} /> : n}
          </div>
          {n < 3 && <div style={{ width: 32, height: 2, background: n < step ? '#E8542A' : '#ece7d9', borderRadius: 1, flexShrink: 0 }} />}
        </div>
      ))}
      <span style={{ font: `500 12px ${FF}`, color: '#9a948a', marginLeft: 4 }}>
        {step === 1 ? 'Plano' : step === 2 ? 'Seus dados' : 'Pagamento'}
      </span>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function Pagamentos() {
  const { user } = useAuthStore()

  const [mode,         setMode]         = useState<Mode>('loading')
  const [step,         setStep]         = useState<CheckoutStep>('plan')
  const [subscription, setSubscription] = useState<SubInfo | null>(null)

  const [selectedPlan, setSelectedPlan]   = useState<string>('monthly_399')
  const [customer,     setCustomer]        = useState<CustomerData>({ name: '', email: '', cpfCnpj: '', phone: '' })
  const [card,         setCard]           = useState<CardData>({
    holderName: '', number: '', expiryMonth: '', expiryYear: '', ccv: '',
    postalCode: '', addressNumber: '',
  })
  const [pixResult,    setPixResult]       = useState<{ qrCode: string | null; copyPaste: string | null; dueDate: string | null } | null>(null)
  const [error,        setError]           = useState('')
  const [copied,       setCopied]          = useState(false)
  const [checking,     setChecking]        = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pollRef        = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => { if (user?.id) void loadInitialData() }, [user?.id])

  // Polling automático quando QR Code está sendo exibido
  useEffect(() => {
    if (step === 'done-pix') {
      pollRef.current = setInterval(() => { void checkPixConfirmed() }, 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [step])

  async function checkPixConfirmed() {
    if (!user?.id) return
    setChecking(true)
    const { data: clientRow } = await supabase.from('clients').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!clientRow) { setChecking(false); return }
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('id, status, current_cycle, max_cycles, next_due_date, plans(code, label, payment_method), subscription_payments(id, cycle_number, value, status, paid_at, due_date, pix_qr_code, pix_copy_paste)')
      .eq('client_id', clientRow.id)
      .not('status', 'in', '("canceled","finished")')
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (!subRow) { setChecking(false); return }
    const plans = subRow.plans as unknown as { code: string; label: string; payment_method: string }
    const rawPayments = (subRow.subscription_payments as Record<string, unknown>[] ?? [])
    const payments: SubPayment[] = rawPayments.map(p => ({
      id: p.id as string, cycleNumber: p.cycle_number as number, value: p.value as number,
      status: p.status as string, paidAt: p.paid_at as string | null, dueDate: p.due_date as string | null,
      pixQrCode: p.pix_qr_code as string | null, pixCopyPaste: p.pix_copy_paste as string | null,
    })).sort((a, b) => a.cycleNumber - b.cycleNumber)
    const confirmed = payments.some(p => p.status === 'confirmed')
    if (confirmed || subRow.status === 'active') {
      clearInterval(pollRef.current)
      setSubscription({ id: subRow.id, status: subRow.status, planCode: plans.code, planLabel: plans.label, paymentMethod: plans.payment_method, currentCycle: subRow.current_cycle, maxCycles: subRow.max_cycles, nextDueDate: subRow.next_due_date, payments })
      setMode('dashboard')
      setStep('plan')
    }
    setChecking(false)
  }

  async function loadInitialData() {
    if (!user?.id) return

    // Pré-carrega dados do perfil para o formulário
    const [{ data: profile }, { data: student }] = await Promise.all([
      supabase.from('profiles').select('name, email, phone').eq('id', user.id).single(),
      supabase.from('students').select('cpf').eq('student_id', user.id).maybeSingle(),
    ])
    setCustomer({
      name:     profile?.name  ?? '',
      email:    profile?.email ?? user.email ?? '',
      cpfCnpj:  student?.cpf   ?? '',
      phone:    profile?.phone  ?? '',
    })

    // Verifica assinatura ativa
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientRow) {
      const { data: subRow } = await supabase
        .from('subscriptions')
        .select(`
          id, status, current_cycle, max_cycles, next_due_date,
          plans(code, label, payment_method),
          subscription_payments(id, cycle_number, value, status, paid_at, due_date, pix_qr_code, pix_copy_paste)
        `)
        .eq('client_id', clientRow.id)
        .not('status', 'in', '("canceled","finished")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (subRow) {
        const plans = subRow.plans as unknown as { code: string; label: string; payment_method: string }
        const rawPayments = (subRow.subscription_payments as Record<string, unknown>[] ?? [])
        const payments: SubPayment[] = rawPayments
          .map(p => ({
            id:          p.id as string,
            cycleNumber: p.cycle_number as number,
            value:       p.value as number,
            status:      p.status as string,
            paidAt:      p.paid_at as string | null,
            dueDate:     p.due_date as string | null,
            pixQrCode:   p.pix_qr_code as string | null,
            pixCopyPaste:p.pix_copy_paste as string | null,
          }))
          .sort((a, b) => a.cycleNumber - b.cycleNumber)
        setSubscription({
          id:            subRow.id,
          status:        subRow.status,
          planCode:      plans.code,
          planLabel:     plans.label,
          paymentMethod: plans.payment_method,
          currentCycle:  subRow.current_cycle,
          maxCycles:     subRow.max_cycles,
          nextDueDate:   subRow.next_due_date,
          payments,
        })
        setMode('dashboard')
        return
      }
    }

    setMode('checkout')
  }

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }

  async function handleCheckout() {
    setError('')
    setStep('processing')
    try {
      const auth = await getAuthHeader()

      // 1. Cria/recupera cliente Asaas
      const custRes = await fetch(`${FNS}/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({
          name:     customer.name.trim(),
          email:    customer.email.trim(),
          cpfCnpj: customer.cpfCnpj.replace(/\D/g, ''),
          phone:    customer.phone.replace(/\D/g, '') || undefined,
        }),
      })
      const custJson = await custRes.json()
      if (custJson.error) throw new Error(custJson.error)

      // 2. Cria assinatura
      const plan = PLANS.find(p => p.code === selectedPlan)!
      const subBody: Record<string, unknown> = { planCode: selectedPlan }

      if (plan.paymentMethod === 'CREDIT_CARD') {
        subBody.creditCard = {
          holderName:  card.holderName.trim(),
          number:      card.number.replace(/\D/g, ''),
          expiryMonth: card.expiryMonth,
          expiryYear:  card.expiryYear,
          ccv:         card.ccv,
        }
        subBody.creditCardHolderInfo = {
          name:          customer.name.trim(),
          email:         customer.email.trim(),
          cpfCnpj:       customer.cpfCnpj.replace(/\D/g, ''),
          postalCode:    card.postalCode.replace(/\D/g, ''),
          addressNumber: card.addressNumber.trim(),
          phone:         customer.phone.replace(/\D/g, '') || undefined,
        }
      }

      const subRes = await fetch(`${FNS}/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(subBody),
      })
      const subJson = await subRes.json()
      if (subJson.error) throw new Error(subJson.error)

      if (plan.paymentMethod === 'PIX') {
        setPixResult({
          qrCode:    subJson.pixQrCode    ?? null,
          copyPaste: subJson.pixCopyPaste ?? null,
          dueDate:   subJson.pixDueDate   ?? null,
        })
        setStep('done-pix')
      } else {
        setStep('done-card')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar. Tente novamente.')
      setStep('payment')
    }
  }

  function copyPix(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const plan = PLANS.find(p => p.code === selectedPlan)!

  // ── Helpers de input ──────────────────────────────────────
  function setC<K extends keyof CustomerData>(k: K, v: CustomerData[K]) {
    setCustomer(prev => ({ ...prev, [k]: v }))
  }
  function setK<K extends keyof CardData>(k: K, v: CardData[K]) {
    setCard(prev => ({ ...prev, [k]: v }))
  }

  // ── Estilo base dos botões de plano ──────────────────────
  function planBtnStyle(active: boolean): React.CSSProperties {
    return {
      width: '100%', textAlign: 'left', border: `2px solid ${active ? '#E8542A' : '#ece7d9'}`,
      background: active ? '#fff8f6' : '#fff', borderRadius: 14, padding: '14px 16px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: active ? '0 2px 10px rgba(232,84,42,.12)' : 'none', transition: 'all .14s',
    }
  }

  // ── Render: loading ───────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ font: `400 14px ${FF}`, color: '#A39E90' }}>Carregando...</span>
      </div>
    )
  }

  // ── Render: dashboard (assinatura ativa) ──────────────────
  if (mode === 'dashboard' && subscription) {
    const st = STATUS_LABEL[subscription.status] ?? STATUS_LABEL.pending
    const pendingPix = subscription.paymentMethod === 'PIX' && subscription.status === 'pending'
    const firstPixPayment = pendingPix
      ? subscription.payments.find(p => p.cycleNumber === 1 && p.pixQrCode)
      : null

    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>
        <div style={{ padding: '16px 18px' }}>
          <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Pagamentos</h1>
        </div>

        {/* Status card */}
        <div style={{ margin: '0 18px 16px', background: 'linear-gradient(135deg,#1B2A4A,#2D4270)', borderRadius: 20, padding: 22, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(232,84,42,.15)', top: -40, right: -30 }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px' }}>Assinatura</span>
              <span style={{ font: `600 11px ${FF}`, color: st.color, background: st.bg, borderRadius: 20, padding: '3px 10px' }}>{st.label}</span>
            </div>
            <div style={{ font: `800 22px ${FF}`, color: '#FAEEDA', letterSpacing: '-.4px', marginBottom: 6 }}>
              {subscription.planLabel}
            </div>
            <div style={{ font: `400 13px ${FF}`, color: '#8B97AD' }}>
              {fmtMoney(PLANS.find(p => p.code === subscription.planCode)?.value ?? 0)}/mês
              {subscription.maxCycles
                ? ` · ciclo ${subscription.currentCycle} de ${subscription.maxCycles}`
                : ` · ciclo ${subscription.currentCycle}`}
            </div>
            {subscription.nextDueDate && subscription.status === 'active' && (
              <div style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginTop: 4 }}>
                Próximo vencimento: {fmtDate(subscription.nextDueDate)}
              </div>
            )}
          </div>
        </div>

        {/* PIX pendente: mostra QR code */}
        {firstPixPayment && (
          <div style={{ margin: '0 18px 16px', background: '#fff', borderRadius: 16, padding: '20px 18px', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>Aguardando pagamento Pix</div>
            <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginBottom: 16 }}>
              Vencimento: {fmtDate(firstPixPayment.dueDate)}
            </div>
            {firstPixPayment.pixQrCode && (
              <img
                src={firstPixPayment.pixQrCode.startsWith('data:') ? firstPixPayment.pixQrCode : `data:image/png;base64,${firstPixPayment.pixQrCode}`}
                alt="QR Code Pix"
                style={{ width: 180, height: 180, display: 'block', margin: '0 auto 16px', borderRadius: 8 }}
              />
            )}
            {firstPixPayment.pixCopyPaste && (
              <button
                onClick={() => copyPix(firstPixPayment.pixCopyPaste!)}
                style={{ width: '100%', height: 44, border: '1.5px solid #ece7d9', background: '#fff', borderRadius: 10, font: `600 13px ${FF}`, color: '#1B2A4A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}
              >
                {copied ? <CheckCheck size={16} color="#1B7a4a" /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar código Pix'}
              </button>
            )}
            <button
              onClick={() => void checkPixConfirmed()}
              disabled={checking}
              style={{ width: '100%', height: 40, border: '1.5px solid #d9d3c4', background: '#f7f3ea', borderRadius: 10, font: `600 13px ${FF}`, color: '#1B2A4A', cursor: checking ? 'default' : 'pointer', opacity: checking ? .7 : 1 }}
            >
              {checking ? 'Verificando...' : 'Verificar pagamento'}
            </button>
          </div>
        )}

        {/* Histórico de pagamentos */}
        {subscription.payments.length > 0 && (
          <div style={{ margin: '0 18px' }}>
            <div style={{ font: `600 11px ${FF}`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
              Histórico
            </div>
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
              {subscription.payments.map((p, i) => {
                const ps = PAY_STATUS[p.status] ?? PAY_STATUS.pending
                return (
                  <div key={p.id} style={{ padding: '14px 18px', borderBottom: i < subscription.payments.length - 1 ? '1px solid #f5f0e8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>
                        Ciclo {p.cycleNumber}
                      </div>
                      <div style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>
                        {p.paidAt ? fmtDate(p.paidAt) : p.dueDate ? `Vence ${fmtDate(p.dueDate)}` : '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{fmtMoney(p.value)}</div>
                      <div style={{ font: `600 11px ${FF}`, color: ps.color }}>{ps.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render: checkout ──────────────────────────────────────

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 40 }}>

      {/* Header */}
      {(step === 'plan' || step === 'customer' || step === 'payment') && (
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {step !== 'plan' && (
            <button
              onClick={() => setStep(step === 'customer' ? 'plan' : 'customer')}
              style={{ width: 36, height: 36, borderRadius: 10, background: '#EDE8DC', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2} />
            </button>
          )}
          <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>
            {step === 'plan' ? 'Escolha seu plano' : step === 'customer' ? 'Seus dados' : 'Pagamento'}
          </h1>
        </div>
      )}

      <div style={{ padding: '0 18px' }}>

        {/* ── Passo 1: Planos ── */}
        {step === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StepBar step={1} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLANS.map(p => {
                const active = selectedPlan === p.code
                return (
                  <button key={p.code} onClick={() => setSelectedPlan(p.code)} style={planBtnStyle(active)}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: active ? '6px solid #E8542A' : '2px solid #A39E90', flexShrink: 0, transition: 'all .14s' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ font: `700 14.5px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{p.label}</div>
                      <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{p.subLabel}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ font: `800 18px ${FF}`, color: '#1B2A4A' }}>
                        {fmtMoney(p.value)}
                      </span>
                      <span style={{ font: `400 11px ${FF}`, color: '#9a948a' }}>/mês</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Aviso clareza trimestral */}
            {plan.maxPayments && (
              <div style={{ background: '#fff3e0', borderRadius: 10, padding: '11px 14px', border: '1px solid #ffe0b2' }}>
                <span style={{ font: `500 12px ${FF}`, color: '#b06a12' }}>
                  No plano trimestral você verá <strong>3 lançamentos separados</strong> no extrato (um por mês), não uma compra única parcelada.
                </span>
              </div>
            )}

            <button
              onClick={() => setStep('customer')}
              style={{ width: '100%', height: 50, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 14, font: `700 15px ${FF}`, cursor: 'pointer', boxShadow: '0 3px 0 #c4421e', letterSpacing: '-.2px' }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* ── Passo 2: Dados do cliente ── */}
        {step === 'customer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StepBar step={2} />

            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
              <Inp label="Nome completo" value={customer.name} onChange={v => setC('name', v)} />
              <Inp label="CPF" value={customer.cpfCnpj} onChange={v => setC('cpfCnpj', fmtCpf(v))} placeholder="000.000.000-00" />
              <Inp label="E-mail" value={customer.email} onChange={v => setC('email', v)} type="email" />
              <Inp label="Telefone / WhatsApp" value={customer.phone} onChange={v => setC('phone', fmtPhone(v))} placeholder="(11) 99999-9999" />
            </div>

            <button
              onClick={() => {
                if (!customer.name.trim() || !customer.email.trim() || !customer.cpfCnpj.trim()) {
                  setError('Preencha nome, e-mail e CPF.')
                  return
                }
                setError('')
                setStep('payment')
              }}
              style={{ width: '100%', height: 50, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 14, font: `700 15px ${FF}`, cursor: 'pointer', boxShadow: '0 3px 0 #c4421e' }}
            >
              Continuar
            </button>
            {error && <div style={{ font: `500 13px ${FF}`, color: '#c4421e', textAlign: 'center' }}>{error}</div>}
          </div>
        )}

        {/* ── Passo 3: Pagamento ── */}
        {step === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StepBar step={3} />

            {/* Resumo do plano escolhido */}
            <div style={{ background: '#1B2A4A', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ font: `700 14px ${FF}`, color: '#FAEEDA' }}>{plan.label}</div>
                <div style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginTop: 3 }}>{plan.subLabel}</div>
              </div>
              <div style={{ font: `800 18px ${FF}`, color: '#FAEEDA' }}>{fmtMoney(plan.value)}<span style={{ font: `400 11px ${FF}` }}>/mês</span></div>
            </div>

            {plan.paymentMethod === 'CREDIT_CARD' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
                <div style={{ font: `700 11px ${FF}`, color: '#E8542A', textTransform: 'uppercase', letterSpacing: '.5px' }}>Dados do cartão</div>
                <Inp label="Número do cartão" value={card.number} onChange={v => setK('number', fmtCard(v))} placeholder="0000 0000 0000 0000" />
                <Inp label="Nome no cartão" value={card.holderName} onChange={v => setK('holderName', v.toUpperCase())} placeholder="COMO IMPRESSO NO CARTÃO" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Inp label="Mês" value={card.expiryMonth} onChange={v => setK('expiryMonth', v.replace(/\D/g, '').slice(0, 2))} placeholder="MM" />
                  <Inp label="Ano" value={card.expiryYear} onChange={v => setK('expiryYear', v.replace(/\D/g, '').slice(0, 4))} placeholder="AAAA" />
                  <Inp label="CVV" value={card.ccv} onChange={v => setK('ccv', v.replace(/\D/g, '').slice(0, 4))} placeholder="000" />
                </div>
                <div style={{ font: `700 11px ${FF}`, color: '#E8542A', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 4 }}>Endereço de cobrança</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <Inp label="CEP" value={card.postalCode} onChange={v => setK('postalCode', v.replace(/\D/g, '').slice(0, 8))} placeholder="00000-000" />
                  <Inp label="Número" value={card.addressNumber} onChange={v => setK('addressNumber', v)} placeholder="123" />
                </div>
              </div>
            )}

            {plan.paymentMethod === 'PIX' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '20px 18px', textAlign: 'center', boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
                <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 8 }}>Pagamento via Pix</div>
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', lineHeight: 1.6 }}>
                  Ao confirmar, geraremos um QR Code Pix para o primeiro mês. Os próximos serão enviados mensalmente.
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#fbe6e1', borderRadius: 12, padding: '12px 16px', font: `500 13px ${FF}`, color: '#c4421e' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              style={{ width: '100%', height: 52, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 14, font: `700 15px ${FF}`, cursor: 'pointer', boxShadow: '0 3px 0 #c4421e', letterSpacing: '-.2px' }}
            >
              {plan.paymentMethod === 'PIX' ? 'Gerar QR Code Pix' : 'Assinar agora'}
            </button>
          </div>
        )}

        {/* ── Processando ── */}
        {step === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 20 }}>
            <div style={{ width: 48, height: 48, border: '3px solid #ece7d9', borderTopColor: '#E8542A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>Processando pagamento…</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Cartão: aguardando confirmação ── */}
        {step === 'done-card' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={32} color="#1B7a4a" strokeWidth={2.5} />
            </div>
            <div style={{ font: `800 20px ${FF}`, color: '#1B2A4A', letterSpacing: '-.4px', textAlign: 'center' }}>Assinatura criada!</div>
            <div style={{ font: `400 14px ${FF}`, color: '#7c7869', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
              O primeiro pagamento será cobrado no cartão hoje. Você receberá confirmação por e-mail assim que processado.
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', width: '100%', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ font: `500 13px ${FF}`, color: '#9a948a' }}>Plano</span>
                <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{plan.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ font: `500 13px ${FF}`, color: '#9a948a' }}>Valor</span>
                <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{fmtMoney(plan.value)}/mês</span>
              </div>
            </div>
            <button
              onClick={() => void loadInitialData()}
              style={{ width: '100%', height: 48, border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 14, font: `700 14px ${FF}`, cursor: 'pointer', marginTop: 4 }}
            >
              Ver minha assinatura
            </button>
          </div>
        )}

        {/* ── Pix: QR Code ── */}
        {step === 'done-pix' && pixResult && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 16 }}>
            <div style={{ font: `800 20px ${FF}`, color: '#1B2A4A', letterSpacing: '-.4px', textAlign: 'center' }}>Pague com Pix</div>
            <div style={{ font: `400 13px ${FF}`, color: '#7c7869', textAlign: 'center', lineHeight: 1.6 }}>
              Escaneie o QR Code ou copie o código abaixo.
              {pixResult.dueDate && <><br />Vencimento: <strong style={{ color: '#1B2A4A' }}>{fmtDate(pixResult.dueDate)}</strong></>}
            </div>

            {pixResult.qrCode ? (
              <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
                <img
                  src={pixResult.qrCode.startsWith('data:') ? pixResult.qrCode : `data:image/png;base64,${pixResult.qrCode}`}
                  alt="QR Code Pix"
                  style={{ width: 200, height: 200, display: 'block', borderRadius: 8 }}
                />
              </div>
            ) : (
              <div style={{ font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center' }}>
                QR Code indisponível. Use o código abaixo.
              </div>
            )}

            {pixResult.copyPaste && (
              <button
                onClick={() => copyPix(pixResult!.copyPaste!)}
                style={{ width: '100%', height: 50, border: '2px solid #1B2A4A', background: '#fff', color: '#1B2A4A', borderRadius: 14, font: `700 14px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                {copied ? <CheckCheck size={18} color="#1B7a4a" /> : <Copy size={18} />}
                {copied ? 'Código copiado!' : 'Copiar código Pix'}
              </button>
            )}

            <div style={{ background: '#fff3e0', borderRadius: 12, padding: '12px 16px', border: '1px solid #ffe0b2', width: '100%' }}>
              <div style={{ font: `500 12px ${FF}`, color: '#b06a12', lineHeight: 1.6 }}>
                Após o pagamento, sua assinatura será ativada automaticamente. Os próximos meses serão cobrados mensalmente.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
