import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getInitials, avatarPalette } from '../../data/mock'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../store/settings'

const FN_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

const FF = '"Libre Franklin",sans-serif'

// ── Types ───────────────────────────────────────────────────
type Status = 'pago' | 'a-vencer' | 'atrasado'
type Tab    = 'all' | Status

interface Charge {
  id:        number
  studentId: number
  name:      string
  plan:      string
  phone:     string | null
  value:     number
  method:    string
  due:       string
  status:    Status
  paidOn:    string | null
}

interface Student {
  id:   number
  name: string
  plan: string
}

interface PlanRequest {
  id:            number
  studentName:   string
  currentPlan:   string
  requestedPlan: string
  type:          'mudanca' | 'renovacao'
  requestedAt:   string
}


// ── Constants ───────────────────────────────────────────────
const STATUS_MAP: Record<Status, { color: string; bg: string }> = {
  pago:      { color: '#1B7a4a', bg: '#e7f3ea' },
  'a-vencer':{ color: '#b06a12', bg: '#f7ecd9' },
  atrasado:  { color: '#c4421e', bg: '#fbe6e1' },
}

const PLANS: Record<string, number> = { Mensal: 399, Trimestral: 247 }

function brl(n: number) {
  return 'R$ ' + Number(n).toLocaleString('pt-BR')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function mapStatus(dbStatus: string, dueDate: string): Status {
  if (dbStatus === 'active') return 'pago'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(dueDate + 'T00:00:00')
  return due > today ? 'a-vencer' : 'atrasado'
}

// ── Receipt ──────────────────────────────────────────────────
function openRecibo(charge: Charge) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo — ${charge.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:48px;color:#1B2A4A;max-width:560px;margin:auto}
h1{font-size:22px;font-weight:800;margin-bottom:4px}
.sub{font-size:13px;color:#7c7869;margin-bottom:32px}
.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f0ece0;font-size:14px}
.lbl{color:#7c7869}
.val{font-weight:700}
.total{font-size:22px;color:#1B7a4a}
.badge{display:inline-block;background:#e7f3ea;color:#1B7a4a;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700}
.btn{margin-top:32px;text-align:right}
button{background:#1B2A4A;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
@media print{button{display:none}}
</style>
</head>
<body>
<h1>Recibo de Pagamento</h1>
<p class="sub">Kinea — Personal Training</p>
<div class="row"><span class="lbl">Aluno</span><span class="val">${charge.name}</span></div>
<div class="row"><span class="lbl">Plano</span><span class="val">${charge.plan}</span></div>
<div class="row"><span class="lbl">Forma de pagamento</span><span class="val">${charge.method}</span></div>
<div class="row"><span class="lbl">Data de pagamento</span><span class="val">${charge.paidOn ?? '—'}</span></div>
<div class="row"><span class="lbl">Status</span><span class="val"><span class="badge">Pago ✓</span></span></div>
<div class="row" style="border-bottom:none;margin-top:8px"><span class="lbl">Valor total</span><span class="val total">R$ ${Number(charge.value).toLocaleString('pt-BR')}</span></div>
<div class="btn"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
</body>
</html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ── Toast ───────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Charge detail drawer ─────────────────────────────────────
function ChargeDrawer({ charge, onClose, onMarkPaid, onRemind }: {
  charge:     Charge
  onClose:    () => void
  onMarkPaid: (id: number) => void
  onRemind:   (id: number) => void
}) {
  const { t } = useTranslation()
  const STATUS_LABELS: Record<Status, string> = {
    pago:       t('coach_payments.status_pago'),
    'a-vencer': t('coach_payments.status_a_vencer'),
    atrasado:   t('coach_payments.status_atrasado'),
  }
  const sm  = STATUS_MAP[charge.status]
  const pal = avatarPalette(charge.id)

  const history: { label: string; date: string; dot: string }[] = []
  if (charge.status === 'pago') {
    history.push({ label: t('coach_payments.history_paid'),     date: charge.paidOn ?? '—', dot: '#1B7a4a' })
  } else if (charge.status === 'a-vencer') {
    history.push({ label: t('coach_payments.history_upcoming'), date: charge.due,            dot: '#b06a12' })
  } else {
    history.push({ label: t('coach_payments.history_overdue'),  date: charge.due,            dot: '#c4421e' })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 410, maxWidth: '92vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '24px 22px', position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 16px ${FF}`, flexShrink: 0 }}>
              {getInitials(charge.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `800 17px ${FF}`, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{charge.name}</div>
              <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc', marginTop: 2 }}>{charge.plan} · {brl(charge.value)}</div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '15px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: `500 11px ${FF}`, color: '#aeb9cc', marginBottom: 3 }}>{t('coach_payments.charge_value')}</div>
              <div style={{ font: `800 24px ${FF}`, color: '#fff', letterSpacing: '-.5px' }}>{brl(charge.value)}</div>
            </div>
            <span style={{ font: `700 11px ${FF}`, color: sm.color, background: sm.bg, borderRadius: 20, padding: '5px 12px' }}>{STATUS_LABELS[charge.status]}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>{t('coach_payments.due_date')}</div>
              <div style={{ font: `700 13.5px ${FF}`, color: charge.status === 'atrasado' ? '#c4421e' : '#1B2A4A' }}>{charge.due}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>{t('coach_payments.method')}</div>
              <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{charge.method}</div>
            </div>
          </div>

          {/* History */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 16 }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>{t('coach_payments.history')}</div>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0', borderTop: i > 0 ? '1px solid #f4efe3' : 'none' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: h.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, font: `600 12.5px ${FF}`, color: '#1B2A4A' }}>{h.label}</div>
                <div style={{ font: `500 11.5px ${FF}`, color: '#b0a99c' }}>{h.date}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {charge.status !== 'pago' ? (
            <>
              <button
                type="button"
                onClick={() => onMarkPaid(charge.id)}
                style={{ width: '100%', height: 48, border: 'none', background: '#1B7a4a', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #14633c', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                {t('coach_payments.mark_paid')}
              </button>
              <button
                type="button"
                onClick={() => onRemind(charge.id)}
                style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z"/></svg>
                {t('coach_payments.remind_whatsapp')}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e7f3ea', borderRadius: 12, padding: '15px 16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
                <span style={{ font: `700 13.5px ${FF}`, color: '#1B7a4a' }}>{t('coach_payments.payment_confirmed')}</span>
              </div>
              <button
                type="button" onClick={() => openRecibo(charge)}
                style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                {t('coach_payments.download_receipt')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── New charge modal ─────────────────────────────────────────
function NewChargeModal({ students, onClose, onAdd }: {
  students: Student[]
  onClose:  () => void
  onAdd:    (studentId: number, dueDate: string) => void
}) {
  const { t } = useTranslation()
  const [studentId, setStudentId] = useState<number | ''>(students[0]?.id ?? '')
  const [dueDate,   setDueDate]   = useState(new Date().toISOString().split('T')[0])

  const selected = students.find(s => s.id === studentId)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>{t('coach_payments.modal_title')}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_payments.student_label')}</label>
        <select
          value={studentId}
          onChange={e => setStudentId(Number(e.target.value))}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 14, cursor: 'pointer' }}
        >
          <option value="">{t('coach_payments.select_student')}</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {selected && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, background: '#faf7ee', border: '1px solid #ece7d9', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ font: `600 10px ${FF}`, color: '#9a948a', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('coach_payments.plan_label')}</div>
              <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{selected.plan}</div>
            </div>
            <div style={{ flex: 1, background: '#faf7ee', border: '1px solid #ece7d9', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ font: `600 10px ${FF}`, color: '#9a948a', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('coach_payments.value_label')}</div>
              <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{brl(PLANS[selected.plan] ?? 247)}{t('coach_payments.per_month')}</div>
            </div>
          </div>
        )}

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{t('coach_payments.due_date')}</label>
        <input
          type="date" value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 18 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
        />

        <button
          type="button"
          onClick={() => { if (studentId !== '') onAdd(studentId as number, dueDate) }}
          disabled={!studentId}
          style={{ width: '100%', height: 48, border: 'none', background: studentId ? '#E8542A' : '#d9d3c4', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: studentId ? 'pointer' : 'not-allowed', boxShadow: studentId ? '0 2px 0 #c4421e' : 'none' }}
        >
          {t('coach_payments.generate_charge')}
        </button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function Pagamentos() {
  const { t } = useTranslation()
  const locale = useSettingsStore(s => s.language)
  const { user }   = useAuthStore()
  const [searchParams] = useSearchParams()
  const [charges,   setCharges]   = useState<Charge[]>([])
  const [students,  setStudents]  = useState<Student[]>([])
  const [requests,  setRequests]  = useState<PlanRequest[]>([])
  const [tab,       setTab]       = useState<Tab>(() => {
    const tabParam = searchParams.get('tab')
    return (tabParam === 'atrasado' || tabParam === 'a-vencer' || tabParam === 'pago') ? tabParam : 'all'
  })
  const [query,     setQuery]     = useState('')
  const [sortDate,  setSortDate]  = useState<'asc' | 'desc'>('desc')
  const [openId,    setOpenId]    = useState<number | null>(null)
  const [newOpen,   setNewOpen]   = useState(false)
  const [toast,     setToast]     = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(toastRef.current), [])

  // Load students (for new-charge modal selector)
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('students')
      .select('id, name, plan')
      .eq('coach_id', user.id)
      .order('name')
      .then(({ data }) => { if (data) setStudents(data as Student[]) })
  }, [user?.id])

  // Load payments from DB
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('payments')
      .select('id, amount, status, due_date, paid_at, students!inner(id, name, plan, phone, coach_id)')
      .eq('students.coach_id', user.id)
      .order('due_date', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        setCharges(data.map((p: any) => ({
          id:        p.id,
          studentId: p.students.id,
          name:      p.students.name,
          plan:      p.students.plan,
          phone:     p.students.phone ?? null,
          value:     p.amount,
          method:    'Pix',
          due:       formatDate(p.due_date),
          status:    mapStatus(p.status, p.due_date),
          paidOn:    p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : null,
        })))
      })
  }, [user?.id])

  // Load plan change requests
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('plan_requests')
      .select('id, current_plan, requested_plan, type, created_at, students!inner(name, coach_id)')
      .eq('students.coach_id', user.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        setRequests(data.map((r: any) => ({
          id:            r.id,
          studentName:   r.students.name,
          currentPlan:   r.current_plan,
          requestedPlan: r.requested_plan,
          type:          r.type,
          requestedAt:   new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        })))
      })
  }, [user?.id])

  function showToast(msg: string) {
    setToast(msg); clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1900)
  }

  async function handleMarkPaid(id: number) {
    const c = charges.find(x => x.id === id)
    const paidAt = new Date().toISOString()
    await supabase.from('payments').update({ status: 'active', paid_at: paidAt }).eq('id', id)
    const paidOn = new Date().toLocaleDateString('pt-BR')
    setCharges(prev => prev.map(x => x.id === id ? { ...x, status: 'pago', paidOn } : x))
    setOpenId(null)
    if (c) showToast(t('coach_payments.payment_confirmed_toast', { name: c.name.split(' ')[0] }))
  }

  function handleRemind(id: number) {
    const c = charges.find(x => x.id === id)
    if (!c) return
    const digits = c.phone?.replace(/\D/g, '')
    if (digits) {
      const msg = encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Passando para lembrar que sua mensalidade vence em ${c.due}. 😊`)
      window.open(`https://wa.me/55${digits}?text=${msg}`, '_blank')
    } else {
      showToast(t('coach_payments.no_phone_toast', { name: c.name.split(' ')[0] }))
    }
  }

  async function handleRequest(id: number, action: 'aprovar' | 'recusar') {
    const req = requests.find(r => r.id === id)
    setRequests(prev => prev.filter(r => r.id !== id))
    try {
      await fetch(`${FN_URL}/approve-plan-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action }),
      })
    } catch { /* falha silenciosa — UI já atualizou */ }
    if (req) showToast(action === 'aprovar'
      ? t('coach_payments.plan_approved_toast', { plan: req.requestedPlan, name: req.studentName.split(' ')[0] })
      : t('coach_payments.plan_rejected_toast', { name: req.studentName.split(' ')[0] }))
  }

  async function handleAddCharge(studentId: number, dueDate: string) {
    const st = students.find(s => s.id === studentId)
    if (!st) return
    const amount = PLANS[st.plan] ?? 247
    const { data, error } = await supabase
      .from('payments')
      .insert({ student_id: studentId, amount, status: 'overdue', due_date: dueDate, description: `${st.plan} – cobrança manual` })
      .select('id')
      .single()
    if (error || !data) { showToast(t('coach_payments.err_create_charge')); return }
    setCharges(prev => [{
      id:        data.id,
      studentId,
      name:      st.name,
      plan:      st.plan,
      phone:     null,
      value:     amount,
      method:    'Pix',
      due:       formatDate(dueDate),
      status:    mapStatus('overdue', dueDate),
      paidOn:    null,
    }, ...prev])
    setNewOpen(false)
    showToast(t('coach_payments.charge_created_toast', { name: st.name.split(' ')[0] }))
  }

  // Stats
  const sum   = (s: Status) => charges.filter(c => c.status === s).reduce((a, c) => a + c.value, 0)
  const cnt   = (s: Status) => charges.filter(c => c.status === s).length
  const total = charges.length
  const paid  = cnt('pago')
  const payRate = total ? Math.round((paid / total) * 100) + '%' : '—'

  // Filtered rows
  function parseDue(s: string) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }

  const q = query.trim().toLowerCase()
  const visible = charges
    .filter(c => {
      const okTab = tab === 'all' || c.status === tab
      const okQ   = !q || c.name.toLowerCase().includes(q)
      return okTab && okQ
    })
    .sort((a, b) => {
      const da = parseDue(a.due), db = parseDue(b.due)
      return sortDate === 'asc' ? da.localeCompare(db) : db.localeCompare(da)
    })

  const openCharge = openId !== null ? charges.find(c => c.id === openId) ?? null : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',       label: t('coach_payments.tab_all') },
    { key: 'pago',      label: t('coach_payments.tab_pago') },
    { key: 'a-vencer',  label: t('coach_payments.tab_a_vencer') },
    { key: 'atrasado',  label: t('coach_payments.tab_atrasado') },
  ]

  const STATUS_LABELS: Record<Status, string> = {
    pago:       t('coach_payments.status_pago'),
    'a-vencer': t('coach_payments.status_a_vencer'),
    atrasado:   t('coach_payments.status_atrasado'),
  }

  const colLabel: React.CSSProperties = { font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a' }

  return (
    <div style={{ padding: '30px 34px 40px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>{t('coach_payments.title')}</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>{new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' })} · {t('coach_payments.header_desc')}</p>
        </div>
        <button
          type="button" onClick={() => setNewOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          {t('coach_payments.new_charge')}
        </button>
      </div>

      {/* Solicitações de mudança de plano */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8542A' }} />
            <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{t('coach_payments.plan_requests_title')}</span>
            <span style={{ font: `600 11px ${FF}`, color: '#fff', background: '#E8542A', borderRadius: 20, padding: '2px 8px' }}>{requests.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map(req => (
              <div key={req.id} style={{ background: '#fff', border: '1.5px solid #f0e8d8', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{req.studentName}</span>
                    <span style={{ font: `600 10px ${FF}`, color: req.type === 'mudanca' ? '#b06a12' : '#1B7a4a', background: req.type === 'mudanca' ? '#f7ecd9' : '#e7f3ea', borderRadius: 20, padding: '2px 8px' }}>
                      {req.type === 'mudanca' ? t('coach_payments.req_change') : t('coach_payments.req_renewal')}
                    </span>
                  </div>
                  <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>
                    <span style={{ color: '#6b6657', fontWeight: 600 }}>{req.currentPlan}</span>
                    <span style={{ margin: '0 6px' }}>→</span>
                    <span style={{ color: '#1B2A4A', fontWeight: 700 }}>{req.requestedPlan}</span>
                    <span style={{ marginLeft: 10 }}>· {req.requestedAt}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button" onClick={() => handleRequest(req.id, 'recusar')}
                    style={{ height: 36, padding: '0 16px', border: '1.5px solid #e0d9c8', background: '#fff', borderRadius: 8, font: `600 12.5px ${FF}`, color: '#7c7869', cursor: 'pointer' }}
                  >
                    {t('coach_payments.reject')}
                  </button>
                  <button
                    type="button" onClick={() => handleRequest(req.id, 'aprovar')}
                    style={{ height: 36, padding: '0 16px', border: 'none', background: '#1B2A4A', borderRadius: 8, font: `700 12.5px ${FF}`, color: '#fff', cursor: 'pointer' }}
                  >
                    {t('coach_payments.approve')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {/* Recebido */}
        <div style={{ background: '#1B2A4A', borderRadius: 16, padding: '18px 19px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(232,84,42,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAB89E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#aeb9cc' }}>{t('coach_payments.card_received')}</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, letterSpacing: '-.5px' }}>{brl(sum('pago'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#8fd6a8', marginTop: 5 }}>{t('coach_payments.confirmed_invoices', { count: cnt('pago') })}</div>
        </div>

        {/* A vencer */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#f7ecd9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>{t('coach_payments.card_upcoming')}</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#1B2A4A', letterSpacing: '-.5px' }}>{brl(sum('a-vencer'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>{t('coach_payments.upcoming_charges', { count: cnt('a-vencer') })}</div>
        </div>

        {/* Em atraso */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fbe6e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>{t('coach_payments.card_overdue')}</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#c4421e', letterSpacing: '-.5px' }}>{brl(sum('atrasado'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>{t('coach_payments.overdue_students', { count: cnt('atrasado') })}</div>
        </div>

        {/* Adimplência */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>{t('coach_payments.card_rate')}</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#1B7a4a', letterSpacing: '-.5px' }}>{payRate}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>{t('coach_payments.card_rate_desc')}</div>
        </div>
      </div>


      {/* Charges table */}
      <div style={{ marginTop: 8, background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid #f1ece0' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4efe3', borderRadius: 10, padding: 4 }}>
            {TABS.map(t => {
              const active = tab === t.key
              const c = t.key === 'all' ? charges.length : cnt(t.key as Status)
              return (
                <button
                  key={t.key} type="button" onClick={() => setTab(t.key)}
                  style={{ border: 'none', background: active ? '#fff' : 'transparent', color: active ? '#1B2A4A' : '#7c7869', font: `700 12.5px ${FF}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(27,42,74,.14)' : 'none', whiteSpace: 'nowrap' }}
                >
                  {t.label} <span style={{ opacity: .6 }}>{c}</span>
                </button>
              )
            })}
          </div>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300, marginLeft: 'auto' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input
              type="text" placeholder={t('coach_payments.search_student')} value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#fff', padding: '0 14px 0 36px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1.1fr 0.7fr', gap: 12, padding: '11px 20px', background: '#faf7ee', borderBottom: '1px solid #f1ece0' }}>
          <div style={colLabel}>{t('coach_payments.col_student')}</div>
          <div style={colLabel}>{t('coach_payments.col_plan')}</div>
          <div style={colLabel}>{t('coach_payments.col_value')}</div>
          <button
            type="button"
            onClick={() => setSortDate(s => s === 'asc' ? 'desc' : 'asc')}
            style={{ ...colLabel, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          >
            {t('coach_payments.col_due')}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .7, transform: sortDate === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div style={{ ...colLabel, textAlign: 'right' }}>{t('coach_payments.col_status')}</div>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div style={{ padding: '46px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e' }}>
            {t('coach_payments.no_charges')}
          </div>
        ) : visible.map((c, i) => {
          const sm  = STATUS_MAP[c.status]
          const pal = avatarPalette(c.id)
          return (
            <div
              key={c.id}
              onClick={() => setOpenId(c.id)}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1.1fr 0.7fr', gap: 12, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid #f4efe6', alignItems: 'center', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fbf8f1' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                  {getInitials(c.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ font: `500 11px ${FF}`, color: '#b0a99c' }}>{c.method}</div>
                </div>
              </div>
              <div style={{ font: `600 12.5px ${FF}`, color: '#6b6657' }}>{c.plan}</div>
              <div style={{ font: `800 14px ${FF}`, color: '#1B2A4A' }}>{brl(c.value)}</div>
              <div style={{ font: `600 12.5px ${FF}`, color: c.status === 'atrasado' ? '#c4421e' : '#6b6657' }}>{c.due}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ font: `700 11px ${FF}`, color: sm.color, background: sm.bg, borderRadius: 20, padding: '5px 11px', whiteSpace: 'nowrap' }}>{STATUS_LABELS[c.status]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Drawer */}
      {openCharge && (
        <ChargeDrawer
          charge={openCharge}
          onClose={() => setOpenId(null)}
          onMarkPaid={handleMarkPaid}
          onRemind={handleRemind}
        />
      )}

      {/* New charge modal */}
      {newOpen && <NewChargeModal students={students} onClose={() => setNewOpen(false)} onAdd={handleAddCharge} />}

      <Toast msg={toast} />
    </div>
  )
}
