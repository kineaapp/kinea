import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

const FF  = '"Libre Franklin",sans-serif'
const FNS = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

interface PaymentRow {
  id:                 number
  amount:             number
  status:             string
  description:        string | null
  due_date:           string
  paid_at:            string | null
  checkout_url:       string | null
  order_nsu:          string | null
  ip_capture_method:  string | null
  ip_receipt_url:     string | null
}

type Mode = 'loading' | 'plan-select' | 'pending' | 'active' | 'verifying' | 'timeout'

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function Pagamentos() {
  const { user }                   = useAuthStore()
  const { t }                      = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const PLANS = [
    {
      code:    'quarterly',
      label:   t('payments.plan_quarterly_label'),
      amount:  247,
      sub:     t('payments.plan_quarterly_sub'),
      badge:   t('payments.plan_quarterly_badge'),
      saving:  t('payments.plan_quarterly_saving'),
    },
    {
      code:    'monthly',
      label:   t('payments.plan_monthly_label'),
      amount:  399,
      sub:     t('payments.plan_monthly_sub'),
      badge:   null,
      saving:  null,
    },
  ]

  const [mode,           setMode]           = useState<Mode>('loading')
  const [activePayment,  setActivePayment]  = useState<PaymentRow | null>(null)
  const [pendingPayment, setPendingPayment] = useState<PaymentRow | null>(null)
  const [selectedPlan,   setSelectedPlan]   = useState('quarterly')
  const [creating,       setCreating]       = useState(false)
  const [error,          setError]          = useState('')

  const pollRef      = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const pollCountRef = useRef(0)

  useEffect(() => {
    if (user?.id) void loadPayments()
    return () => clearInterval(pollRef.current)
  }, [user?.id])

  // Handle return from InfinitePay
  useEffect(() => {
    if (mode === 'loading') return
    const orderNsu = searchParams.get('order_nsu')
    if (orderNsu) {
      setSearchParams({}, { replace: true })
      startPolling(orderNsu)
    }
  }, [mode])

  async function loadPayments() {
    if (!user?.id) return
    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user.id).maybeSingle()
    if (!studentRow) { setMode('plan-select'); return }

    const { data } = await supabase
      .from('payments')
      .select('id,amount,status,description,due_date,paid_at,checkout_url,order_nsu,ip_capture_method,ip_receipt_url')
      .eq('student_id', studentRow.id)
      .order('due_date', { ascending: false })
      .limit(20)

    const rows = (data ?? []) as PaymentRow[]
    const active  = rows.find(p => p.status === 'active')
    const pending = rows.find(p => p.status === 'pending' && p.checkout_url)

    if (active)       { setActivePayment(active);   setMode('active')  }
    else if (pending) { setPendingPayment(pending); setMode('pending') }
    else              { setMode('plan-select') }
  }

  function startPolling(orderNsu: string) {
    setMode('verifying')
    pollCountRef.current = 0
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      pollCountRef.current++
      if (pollCountRef.current > 20) {
        clearInterval(pollRef.current)
        setMode('timeout')
        return
      }
      const { data } = await supabase
        .from('payments')
        .select('id,amount,status,description,due_date,paid_at,checkout_url,order_nsu,ip_capture_method,ip_receipt_url')
        .eq('order_nsu', orderNsu)
        .maybeSingle()
      if (data?.status === 'active') {
        clearInterval(pollRef.current)
        setActivePayment(data as PaymentRow)
        setMode('active')
      }
    }, 3000)
  }

  async function handleCheckout() {
    if (!user?.id || creating) return
    setCreating(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const plan        = PLANS.find(p => p.code === selectedPlan)!
      const ptLabel     = plan.code === 'quarterly' ? 'Trimestral' : 'Mensal'
      const redirectUrl = window.location.origin + '/aluno/pagamentos'
      const res  = await fetch(`${FNS}/create-payment-link`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body:    JSON.stringify({
          amount:      plan.amount,
          description: `Mensalidade Kinea — Plano ${ptLabel}`,
          redirectUrl,
        }),
      })
      const json = await res.json() as { checkoutUrl?: string; error?: string }
      if (!res.ok || !json.checkoutUrl) throw new Error(json.error ?? 'Erro ao criar link')
      window.location.href = json.checkoutUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar. Tente novamente.')
      setCreating(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ font: `400 14px ${FF}`, color: '#A39E90' }}>{t('common.loading')}</span>
      </div>
    )
  }

  // ── Verifying ─────────────────────────────────────────────
  if (mode === 'verifying') {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ width: 48, height: 48, border: '3.5px solid #ece7d9', borderTopColor: '#E8542A', borderRadius: '50%', animation: 'kspin .8s linear infinite' }} />
        <div style={{ font: `700 16px ${FF}`, color: '#1B2A4A' }}>{t('payments.verifying')}</div>
        <div style={{ font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center' }}>
          {t('payments.verifying_desc')}
        </div>
        <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Timeout ───────────────────────────────────────────────
  if (mode === 'timeout') {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f7ecd9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/></svg>
        </div>
        <div style={{ font: `700 16px ${FF}`, color: '#1B2A4A', textAlign: 'center' }}>{t('payments.timeout_title')}</div>
        <div style={{ font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          {t('payments.timeout_desc')}
        </div>
        <button onClick={() => void loadPayments()}
          style={{ marginTop: 8, height: 44, padding: '0 24px', border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 12, font: `700 14px ${FF}`, cursor: 'pointer' }}>
          {t('payments.check_again')}
        </button>
      </div>
    )
  }

  // ── Active ────────────────────────────────────────────────
  if (mode === 'active' && activePayment) {
    const method = activePayment.ip_capture_method
    const methodLabel = method === 'pix' ? 'Pix' : method === 'credit_card' ? t('payments.method_credit_card') : null
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>
        <div style={{ padding: '18px 18px 0' }}>
          <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>{t('payments.title')}</h1>
        </div>

        <div style={{ margin: '16px 18px', background: 'linear-gradient(135deg,#1B7a4a,#1a5c39)', borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.08)', top: -30, right: -20 }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <span style={{ font: `700 12px ${FF}`, color: 'rgba(255,255,255,.8)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{t('payments.confirmed_badge')}</span>
            </div>
            <div style={{ font: `800 26px ${FF}`, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
              {fmtMoney(activePayment.amount)}<span style={{ font: `400 14px ${FF}`, opacity: .7 }}>{t('payments.per_month')}</span>
            </div>
            <div style={{ font: `400 12px ${FF}`, color: 'rgba(255,255,255,.65)' }}>
              {activePayment.description ?? 'Mensalidade Kinea'}
              {activePayment.paid_at && ` · ${t('payments.paid_on', { date: fmtDate(activePayment.paid_at) })}`}
              {methodLabel && ` · ${methodLabel}`}
            </div>
          </div>
        </div>

        {activePayment.ip_receipt_url && (
          <div style={{ margin: '0 18px' }}>
            <a href={activePayment.ip_receipt_url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, border: '1.5px solid #d9d3c4', background: '#fff', borderRadius: 12, font: `600 13.5px ${FF}`, color: '#1B2A4A', textDecoration: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              {t('payments.receipt')}
            </a>
          </div>
        )}
      </div>
    )
  }

  // ── Pending ───────────────────────────────────────────────
  if (mode === 'pending' && pendingPayment) {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>
        <div style={{ padding: '18px 18px 0' }}>
          <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>{t('payments.title')}</h1>
        </div>

        <div style={{ margin: '16px 18px', background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 8px rgba(27,42,74,.07)', border: '1px solid #ece7d9' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px ${FF}`, color: '#b06a12', background: '#f7ecd9', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#b06a12' }} />
            {t('payments.waiting_badge')}
          </div>
          <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>
            {pendingPayment.description ?? 'Mensalidade Kinea'}
          </div>
          <div style={{ font: `800 22px ${FF}`, color: '#E8542A', marginBottom: 16 }}>
            {fmtMoney(pendingPayment.amount)}<span style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>{t('payments.per_month')}</span>
          </div>
          <a href={pendingPayment.checkout_url!} target="_self"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 50, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 14, font: `700 15px ${FF}`, textDecoration: 'none', boxShadow: '0 3px 0 #c4421e', cursor: 'pointer' }}>
            {t('payments.pay_now')}
          </a>
        </div>

        <div style={{ margin: '0 18px', font: `400 12px ${FF}`, color: '#9a948a', textAlign: 'center', lineHeight: 1.6 }}>
          {t('payments.checkout_desc')}
        </div>
      </div>
    )
  }

  // ── Plan select ───────────────────────────────────────────
  const plan = PLANS.find(p => p.code === selectedPlan)!

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 180 }}>
      <div style={{ padding: '18px 18px 0' }}>
        <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.4px' }}>{t('payments.subscribe_title')}</h1>
        <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: 0 }}>{t('payments.choose_plan')}</p>
      </div>

      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLANS.map(p => {
          const active = selectedPlan === p.code
          return (
            <button key={p.code} type="button" onClick={() => setSelectedPlan(p.code)}
              style={{ width: '100%', textAlign: 'left', border: `2px solid ${active ? '#E8542A' : '#ece7d9'}`, background: active ? '#fff8f6' : '#fff', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: active ? '0 2px 12px rgba(232,84,42,.13)' : 'none', transition: 'all .14s' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: active ? '6px solid #E8542A' : '2px solid #C5BFB0', flexShrink: 0, transition: 'all .14s' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ font: `700 15px ${FF}`, color: '#1B2A4A' }}>{p.label}</span>
                  {p.badge && (
                    <span style={{ font: `700 10px ${FF}`, color: '#E8542A', background: '#fdeee9', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>{p.badge}</span>
                  )}
                </div>
                <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{p.sub}</div>
                {p.saving && <div style={{ font: `600 11.5px ${FF}`, color: '#1B7a4a', marginTop: 4 }}>{p.saving}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ font: `800 20px ${FF}`, color: '#1B2A4A' }}>{fmtMoney(p.amount)}</span>
                <div style={{ font: `400 10.5px ${FF}`, color: '#9a948a' }}>{t('payments.per_month')}</div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ margin: '0 18px 12px', background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 12, padding: '12px 16px', font: `500 13px ${FF}`, color: '#c4421e' }}>
          {error}
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, padding: '12px 18px 16px', background: '#F4EFE3', borderTop: '1px solid #EDE8DC' }}>
        <button type="button" onClick={() => void handleCheckout()} disabled={creating}
          style={{ width: '100%', padding: '15px 0', background: creating ? '#c4421e' : '#E8542A', border: 'none', borderRadius: 14, boxShadow: creating ? 'none' : '0 4px 0 #C4421E', font: `700 16px ${FF}`, color: '#fff', cursor: creating ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {creating
            ? <><span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />{t('payments.please_wait')}</>
            : t('payments.subscribe_plan_btn', { label: plan.label, amount: fmtMoney(plan.amount) })
          }
        </button>
        <div style={{ textAlign: 'center', font: `400 11px ${FF}`, color: '#b0a99c', marginTop: 8 }}>
          {t('payments.checkout_desc')}
        </div>
      </div>
      <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
