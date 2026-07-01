import { useState, useRef, useEffect } from 'react'
import { getInitials, avatarPalette } from '../../data/mock'

const FF = '"Libre Franklin",sans-serif'

// ── Types ───────────────────────────────────────────────────
type Status = 'pago' | 'pendente' | 'atrasado'
type Tab    = 'all' | Status

interface Charge {
  id:     number
  name:   string
  plan:   string
  value:  number
  method: string
  due:    string
  status: Status
  paidOn: string | null
}

// ── Constants ───────────────────────────────────────────────
const STATUS_MAP: Record<Status, { label: string; color: string; bg: string }> = {
  pago:     { label: 'Pago',       color: '#1B7a4a', bg: '#e7f3ea' },
  pendente: { label: 'Pendente',   color: '#b06a12', bg: '#f7ecd9' },
  atrasado: { label: 'Em atraso',  color: '#c4421e', bg: '#fbe6e1' },
}

const PLANS: Record<string, number> = { Mensal: 390, Trimestral: 1050, Semestral: 1890 }

const MONTH_DATA = [
  { month: 'Jan', value: 14200 },
  { month: 'Fev', value: 15600 },
  { month: 'Mar', value: 16100 },
  { month: 'Abr', value: 17400 },
  { month: 'Mai', value: 18200 },
  { month: 'Jun', value: 19500 },
]

const SEED: Charge[] = [
  { id:1,  name:'Tatiane Ribeiro',  plan:'Mensal',     value:390,  method:'Pix',               due:'05 jun', status:'pago',     paidOn:'04 jun' },
  { id:2,  name:'Rafael Antunes',   plan:'Trimestral', value:1050, method:'Cartão de crédito', due:'08 jun', status:'pago',     paidOn:'08 jun' },
  { id:3,  name:'Beatriz Camargo',  plan:'Mensal',     value:390,  method:'Pix',               due:'10 jun', status:'pago',     paidOn:'09 jun' },
  { id:4,  name:'Larissa Fonseca',  plan:'Semestral',  value:1890, method:'Cartão de crédito', due:'12 jun', status:'pago',     paidOn:'11 jun' },
  { id:5,  name:'Eduardo Nunes',    plan:'Mensal',     value:390,  method:'Boleto',            due:'28 jun', status:'pendente', paidOn:null },
  { id:6,  name:'Marcelo Vieira',   plan:'Trimestral', value:1050, method:'Boleto',            due:'30 jun', status:'pendente', paidOn:null },
  { id:7,  name:'Priscila Matos',   plan:'Mensal',     value:390,  method:'Pix',               due:'02 jul', status:'pendente', paidOn:null },
  { id:8,  name:'Henrique Alves',   plan:'Mensal',     value:390,  method:'Boleto',            due:'15 jun', status:'atrasado', paidOn:null },
  { id:9,  name:'Carolina Dias',    plan:'Semestral',  value:1890, method:'Cartão de crédito', due:'18 jun', status:'atrasado', paidOn:null },
  { id:10, name:'Gabriel Souza',    plan:'Mensal',     value:390,  method:'Pix',               due:'06 jun', status:'pago',     paidOn:'06 jun' },
  { id:11, name:'Juliana Reis',     plan:'Trimestral', value:1050, method:'Pix',               due:'07 jun', status:'pago',     paidOn:'07 jun' },
  { id:12, name:'Fábio Cardoso',    plan:'Mensal',     value:390,  method:'Boleto',            due:'14 jun', status:'pago',     paidOn:'13 jun' },
]

function brl(n: number) {
  return 'R$ ' + Number(n).toLocaleString('pt-BR')
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

// ── Revenue bar chart ────────────────────────────────────────
function RevenueChart() {
  const max = Math.max(...MONTH_DATA.map(m => m.value))
  const total = MONTH_DATA.reduce((a, m) => a + m.value, 0)
  return (
    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '20px 22px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>Receita dos últimos 6 meses</div>
        <div style={{ font: `700 14px ${FF}`, color: '#1B7a4a' }}>{brl(total)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 140 }}>
        {MONTH_DATA.map((m, i) => {
          const last = i === MONTH_DATA.length - 1
          const hPct = Math.round((m.value / max) * 100)
          return (
            <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ font: `700 11px ${FF}`, color: '#6b6657' }}>
                {brl(Math.round(m.value / 1000))}k
              </div>
              <div style={{ width: '100%', maxWidth: 46, height: `${hPct}%`, background: last ? '#E8542A' : '#d8d1c0', borderRadius: '7px 7px 3px 3px', transition: 'height .4s cubic-bezier(.2,.7,.3,1)' }} />
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a' }}>{m.month}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Charge detail drawer ─────────────────────────────────────
function ChargeDrawer({ charge, onClose, onMarkPaid, onRemind, onStub }: {
  charge:     Charge
  onClose:    () => void
  onMarkPaid: (id: number) => void
  onRemind:   (id: number) => void
  onStub:     () => void
}) {
  const sm  = STATUS_MAP[charge.status]
  const pal = avatarPalette(charge.id)

  const history: { label: string; date: string; dot: string }[] = [
    { label: 'Cobrança gerada', date: '01 jun', dot: '#1B2A4A' },
  ]
  if (charge.status === 'pago') {
    history.push({ label: 'Lembrete enviado',      date: '03 jun',           dot: '#b06a12' })
    history.push({ label: 'Pagamento confirmado',  date: charge.paidOn ?? '—', dot: '#1B7a4a' })
  } else if (charge.status === 'atrasado') {
    history.push({ label: 'Vencimento',            date: charge.due,         dot: '#b06a12' })
    history.push({ label: 'Cobrança em atraso',    date: 'hoje',             dot: '#c4421e' })
  } else {
    history.push({ label: 'Aguardando vencimento', date: charge.due,         dot: '#b06a12' })
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
              <div style={{ font: `500 11px ${FF}`, color: '#aeb9cc', marginBottom: 3 }}>Valor da cobrança</div>
              <div style={{ font: `800 24px ${FF}`, color: '#fff', letterSpacing: '-.5px' }}>{brl(charge.value)}</div>
            </div>
            <span style={{ font: `700 11px ${FF}`, color: sm.color, background: sm.bg, borderRadius: 20, padding: '5px 12px' }}>{sm.label}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Vencimento</div>
              <div style={{ font: `700 13.5px ${FF}`, color: charge.status === 'atrasado' ? '#c4421e' : '#1B2A4A' }}>{charge.due}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Método</div>
              <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{charge.method}</div>
            </div>
          </div>

          {/* History */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 16 }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Histórico</div>
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
                Marcar como pago
              </button>
              <button
                type="button"
                onClick={() => onRemind(charge.id)}
                style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z"/></svg>
                Enviar lembrete no WhatsApp
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e7f3ea', borderRadius: 12, padding: '15px 16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
                <span style={{ font: `700 13.5px ${FF}`, color: '#1B7a4a' }}>Pagamento confirmado</span>
              </div>
              <button
                type="button" onClick={onStub}
                style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4efe3' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                Baixar recibo
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── New charge modal ─────────────────────────────────────────
function NewChargeModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd:   (name: string, plan: string) => void
}) {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('Mensal')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Nova cobrança</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Aluno</label>
        <input
          type="text" placeholder="Nome do aluno" value={name}
          onChange={e => setName(e.target.value)}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 14 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.13)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
        />

        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>Plano</label>
        <div style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
          {Object.entries(PLANS).map(([label, price]) => {
            const active = plan === label
            return (
              <button
                key={label} type="button" onClick={() => setPlan(label)}
                style={{ flex: 1, border: `1.5px solid ${active ? '#E8542A' : '#e0d9c8'}`, background: active ? '#fdf3ee' : '#fff', color: active ? '#c4421e' : '#7c7869', font: `600 12px ${FF}`, borderRadius: 10, padding: '11px 6px', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontWeight: 700 }}>{label}</div>
                <div style={{ font: `600 11px ${FF}`, opacity: .75, marginTop: 2 }}>{brl(price)}</div>
              </button>
            )
          })}
        </div>

        <button
          type="button" onClick={() => onAdd(name, plan)}
          style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          Gerar cobrança
        </button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function Pagamentos() {
  const [charges,   setCharges]   = useState<Charge[]>(() => SEED.map(c => ({ ...c })))
  const [tab,       setTab]       = useState<Tab>('all')
  const [query,     setQuery]     = useState('')
  const [openId,    setOpenId]    = useState<number | null>(null)
  const [newOpen,   setNewOpen]   = useState(false)
  const [toast,     setToast]     = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout>>()
  const nextId   = useRef(SEED.length + 1)

  useEffect(() => () => clearTimeout(toastRef.current), [])

  function showToast(msg: string) {
    setToast(msg); clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1900)
  }

  function handleMarkPaid(id: number) {
    const c = charges.find(x => x.id === id)
    setCharges(prev => prev.map(x => x.id === id ? { ...x, status: 'pago', paidOn: 'hoje' } : x))
    setOpenId(null)
    if (c) showToast(c.name.split(' ')[0] + ' — pagamento confirmado ✓')
  }

  function handleRemind(id: number) {
    const c = charges.find(x => x.id === id)
    if (c) showToast('Lembrete enviado para ' + c.name.split(' ')[0] + '.')
  }

  function handleAddCharge(name: string, plan: string) {
    if (!name.trim()) { showToast('Informe o nome do aluno.'); return }
    const id = nextId.current++
    setCharges(prev => [{ id, name: name.trim(), plan, value: PLANS[plan] ?? 390, method: 'Pix', due: 'venc. 30d', status: 'pendente', paidOn: null }, ...prev])
    setNewOpen(false)
    showToast('Cobrança gerada para ' + name.trim().split(' ')[0] + '.')
  }

  // Stats
  const sum   = (s: Status) => charges.filter(c => c.status === s).reduce((a, c) => a + c.value, 0)
  const cnt   = (s: Status) => charges.filter(c => c.status === s).length
  const total = charges.length
  const paid  = cnt('pago')
  const payRate = total ? Math.round((paid / total) * 100) + '%' : '—'

  // Filtered rows
  const q = query.trim().toLowerCase()
  const visible = charges.filter(c => {
    const okTab = tab === 'all' || c.status === tab
    const okQ   = !q || c.name.toLowerCase().includes(q)
    return okTab && okQ
  })

  const openCharge = openId !== null ? charges.find(c => c.id === openId) ?? null : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: 'Todos' },
    { key: 'pago',     label: 'Pagos' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'atrasado', label: 'Em atraso' },
  ]

  const colLabel: React.CSSProperties = { font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a' }

  return (
    <div style={{ padding: '30px 34px 40px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Pagamentos</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>Junho de 2026 · visão geral do financeiro</p>
        </div>
        <button
          type="button" onClick={() => setNewOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Nova cobrança
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {/* Recebido */}
        <div style={{ background: '#1B2A4A', borderRadius: 16, padding: '18px 19px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(232,84,42,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAB89E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#aeb9cc' }}>Recebido no mês</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, letterSpacing: '-.5px' }}>{brl(sum('pago'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#8fd6a8', marginTop: 5 }}>▲ 7% vs. maio</div>
        </div>

        {/* A receber */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#f7ecd9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>A receber</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#1B2A4A', letterSpacing: '-.5px' }}>{brl(sum('pendente'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>{cnt('pendente')} cobranças em aberto</div>
        </div>

        {/* Em atraso */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fbe6e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>Em atraso</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#c4421e', letterSpacing: '-.5px' }}>{brl(sum('atrasado'))}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>{cnt('atrasado')} alunos inadimplentes</div>
        </div>

        {/* Adimplência */}
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>Adimplência</span>
          </div>
          <div style={{ font: `800 26px ${FF}`, color: '#1B7a4a', letterSpacing: '-.5px' }}>{payRate}</div>
          <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a', marginTop: 5 }}>dos alunos em dia</div>
        </div>
      </div>

      {/* Revenue chart */}
      <RevenueChart />

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
              type="text" placeholder="Buscar aluno…" value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#fff', padding: '0 14px 0 36px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1.1fr 0.7fr', gap: 12, padding: '11px 20px', background: '#faf7ee', borderBottom: '1px solid #f1ece0' }}>
          <div style={colLabel}>Aluno</div>
          <div style={colLabel}>Plano</div>
          <div style={colLabel}>Valor</div>
          <div style={colLabel}>Vencimento</div>
          <div style={{ ...colLabel, textAlign: 'right' }}>Status</div>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div style={{ padding: '46px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e' }}>
            Nenhuma cobrança neste filtro.
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
                <span style={{ font: `700 11px ${FF}`, color: sm.color, background: sm.bg, borderRadius: 20, padding: '5px 11px', whiteSpace: 'nowrap' }}>{sm.label}</span>
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
          onStub={() => showToast('Em breve.')}
        />
      )}

      {/* New charge modal */}
      {newOpen && <NewChargeModal onClose={() => setNewOpen(false)} onAdd={handleAddCharge} />}

      <Toast msg={toast} />
    </div>
  )
}
