import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInitials, payInfo, semInfo, avatarPalette } from '../../data/mock'
import type { Student, PayStatus, SemColor } from '../../data/mock'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { NewStudentModal } from '../../components/coach/NewStudentModal'

const FF = '"Libre Franklin",sans-serif'

// ── Sort ────────────────────────────────────────────────────
type SortKey = 'name-asc' | 'name-desc' | 'pay' | 'engagement' | 'since-desc' | 'since-asc'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name-asc',   label: 'Nome A → Z' },
  { key: 'name-desc',  label: 'Nome Z → A' },
  { key: 'pay',        label: 'Pagamento: vencidos primeiro' },
  { key: 'engagement', label: 'Engajamento: inativos primeiro' },
  { key: 'since-desc', label: 'Cadastro: mais recentes' },
  { key: 'since-asc',  label: 'Cadastro: mais antigos' },
]

const PAY_ORDER: Record<PayStatus, number> = { overdue: 0, pending: 1, active: 2 }
const SEM_ORDER: Record<SemColor, number>  = { red: 0, yellow: 1, green: 2 }
const MON: Record<string, number> = {
  jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
  jul:7, ago:8, set:9, out:10, nov:11, dez:12,
}
function parseSince(s: string) {
  const [mon, year] = s.split('/')
  return parseInt(year) * 100 + (MON[mon] ?? 0)
}
function sortStudents(list: Student[], key: SortKey) {
  return [...list].sort((a, b) => {
    switch (key) {
      case 'name-asc':   return a.name.localeCompare(b.name, 'pt-BR')
      case 'name-desc':  return b.name.localeCompare(a.name, 'pt-BR')
      case 'pay':        return PAY_ORDER[a.pay] - PAY_ORDER[b.pay]
      case 'engagement': return SEM_ORDER[a.sem] - SEM_ORDER[b.sem]
      case 'since-desc': return parseSince(b.since) - parseSince(a.since)
      case 'since-asc':  return parseSince(a.since) - parseSince(b.since)
    }
  })
}

// ── Shared: invite modal ────────────────────────────────────
function InviteModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [link,  setLink]  = useState('')
  const [copied,setCopied]= useState(false)
  function gen() {
    const t = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8)
    setLink(window.location.origin + '/register/' + (user?.id ?? '') + '/' + t); setCopied(false)
  }
  function copy() {
    try { navigator.clipboard.writeText(link) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '26px 26px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Convidar aluno</h2>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <p style={{ font: `400 13.5px/1.5 ${FF}`, color: '#7c7869', margin: '0 0 18px' }}>Gere um link de convite. O aluno define a própria senha e o link expira em 7 dias.</p>
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>E-mail do aluno (opcional)</label>
        <input type="email" placeholder="aluno@email.com" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 14 }} />
        {!link
          ? <button type="button" onClick={gen} style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>Gerar link de convite</button>
          : <div>
              <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Link gerado</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#f7f3ea', display: 'flex', alignItems: 'center', padding: '0 13px', font: `500 12.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link}</div>
                <button type="button" onClick={copy} style={{ flexShrink: 0, width: 104, height: 46, border: 'none', borderRadius: 10, background: copied ? '#1B7a4a' : '#1B2A4A', color: '#fff', font: `700 13px ${FF}`, cursor: 'pointer' }}>{copied ? 'Copiado!' : 'Copiar'}</button>
              </div>
              <p style={{ font: `400 12px/1.5 ${FF}`, color: '#9a948a', margin: '12px 0 0' }}>Compartilhe por WhatsApp ou e-mail. O aluno aparece aqui assim que concluir o cadastro.</p>
            </div>
        }
      </div>
    </div>
  )
}

// ── Toast ───────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)' }}>
      {msg}
    </div>
  )
}

// ── Quick view drawer ───────────────────────────────────────
function QuickView({ student: s, onClose, onOpenProfile, onStub, onDelete }: {
  student: Student; onClose: () => void; onOpenProfile: (id: number) => void; onStub: () => void; onDelete: () => void
}) {
  const pal  = avatarPalette(s.id)
  const pay  = payInfo(s.pay)
  const sem  = semInfo(s.sem)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div
        className="k-quick"
        onClick={e => e.stopPropagation()}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '88vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
      >
        {/* Navy header */}
        <div style={{ background: '#1B2A4A', padding: '24px 22px 22px', position: 'relative' }}>
          <button type="button" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 21px ${FF}`, flexShrink: 0 }}>
              {getInitials(s.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `800 20px ${FF}`, color: '#fff', letterSpacing: '-.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: sem.color }} />
                <span style={{ font: `500 12.5px ${FF}`, color: '#aeb9cc' }}>{sem.label} · {sem.last}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Objetivo',        value: s.goal },
              { label: 'Plano',           value: s.plan },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
                <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>{label}</div>
                <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{value}</div>
              </div>
            ))}
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Pagamento</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', font: `700 12px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '3px 10px' }}>{pay.label}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Próx. avaliação</div>
              <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{s.next}</div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 8 }}>
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/></svg>, label: 'Montar treino' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3"/><path d="M10 1v3"/></svg>, label: 'Montar dieta' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z"/></svg>, label: 'Enviar mensagem' },
            ].map(({ icon, label }) => (
              <button key={label} type="button" onClick={onStub} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'none', padding: '11px 12px', borderRadius: 9, cursor: 'pointer', font: `600 14px ${FF}`, color: '#1B2A4A', textAlign: 'left' }}>
                {icon}{label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenProfile(s.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 11, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
          >
            Abrir perfil completo →
          </button>

          {!confirmDelete
            ? <button type="button" onClick={() => setConfirmDelete(true)} style={{ width: '100%', border: 'none', background: 'none', color: '#c4421e', font: `600 13px ${FF}`, padding: '10px 0 2px', cursor: 'pointer' }}>
                Excluir aluno
              </button>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 6 }}>
                <span style={{ flex: 1, font: `500 12.5px ${FF}`, color: '#7c7869' }}>Confirmar exclusão?</span>
                <button type="button" onClick={onDelete} style={{ height: 36, padding: '0 14px', border: 'none', background: '#c4421e', color: '#fff', borderRadius: 8, font: `700 12.5px ${FF}`, cursor: 'pointer' }}>Excluir</button>
                <button type="button" onClick={() => setConfirmDelete(false)} style={{ height: 36, padding: '0 14px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}>Cancelar</button>
              </div>
          }
        </div>
      </div>
    </>
  )
}

// ── Sortable column header ──────────────────────────────────
function SortHeader({ label, sortAsc, sortDesc, current, onSort, style, className }: {
  label:    string
  sortAsc:  SortKey
  sortDesc: SortKey
  current:  SortKey
  onSort:   (k: SortKey) => void
  style?:   React.CSSProperties
  className?: string
}) {
  const isActive = current === sortAsc || current === sortDesc
  const isAsc    = current === sortAsc
  const colLabel: React.CSSProperties = {
    font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase',
    color: isActive ? '#1B2A4A' : '#9a948a',
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!isActive || !isAsc) onSort(sortAsc)
        else onSort(sortDesc)
      }}
      style={{
        ...style, ...colLabel,
        display: 'flex', alignItems: 'center', gap: 5,
        border: 'none', background: 'none', cursor: 'pointer', padding: 0,
      }}
    >
      {label}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: isActive ? 1 : .3 }}>
        <svg width="7" height="4" viewBox="0 0 7 4" fill={isActive && isAsc ? '#1B2A4A' : '#9a948a'}><path d="M3.5 0L7 4H0z"/></svg>
        <svg width="7" height="4" viewBox="0 0 7 4" fill={isActive && !isAsc ? '#1B2A4A' : '#9a948a'}><path d="M3.5 4L0 0h7z"/></svg>
      </span>
    </button>
  )
}

// ── Main Alunos page ────────────────────────────────────────
type Filter = 'all' | 'green' | 'yellow' | 'red'

export default function Alunos() {
  const navigate = useNavigate()
  const [filter,      setFilter]      = useState<Filter>('all')
  const [query,       setQuery]       = useState('')
  const [sort,        setSort]        = useState<SortKey>('name-asc')
  const [sortOpen,    setSortOpen]    = useState(false)
  const [quickIdx,    setQuickIdx]    = useState<number | null>(null)
  const [inviteOpen,  setInviteOpen]  = useState(false)
  const [newOpen,     setNewOpen]     = useState(false)
  const [toast,       setToast]       = useState('')
  const { students, addStudent, fetchStudents, deleteStudent } = useStudentsStore()
  const { user } = useAuthStore()

  useEffect(() => { if (user?.id) fetchStudents(user.id) }, [user?.id])
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sortRef  = useRef<HTMLDivElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1800)
  }
  useEffect(() => () => clearTimeout(toastRef.current), [])

  useEffect(() => {
    if (!sortOpen) return
    function handle(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [sortOpen])

  const q = query.trim().toLowerCase()
  const filtered = students.filter(s => {
    const okSem = filter === 'all' || s.sem === filter
    const okQ   = !q || s.name.toLowerCase().includes(q) || s.goal.toLowerCase().includes(q)
    return okSem && okQ
  })
  const shown = sortStudents(filtered, sort)
  const count = (c: Filter) => c === 'all' ? students.length : students.filter(s => s.sem === c).length

  function chipStyle(active: boolean) {
    const base = { display: 'inline-flex' as const, alignItems: 'center' as const, borderRadius: 20, padding: '8px 13px', font: `600 12.5px ${FF}`, cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: '.12s', border: '1.5px solid' as const }
    return active ? { ...base, background: '#1B2A4A', color: '#fff', borderColor: '#1B2A4A' } : { ...base, background: '#fff', color: '#7c7869', borderColor: '#e6e0d0' }
  }

  const colLabel: React.CSSProperties = { font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }

  return (
    <div className="k-pagepad" style={{ padding: '30px 34px 64px', maxWidth: 1240 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Alunos</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
            <strong style={{ color: '#1B2A4A' }}>{students.length}</strong> alunos ·{' '}
            <strong style={{ color: '#1B2A4A' }}>{students.filter(s => s.pay === 'active').length}</strong> ativos ·{' '}
            <strong style={{ color: '#D2402A' }}>{students.filter(s => s.pay === 'overdue').length}</strong> com pagamento vencido
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setInviteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
            Convidar
          </button>
          <button type="button" onClick={() => setNewOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Novo aluno
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="k-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="k-search" style={{ position: 'relative', flex: 1, maxWidth: 340, minWidth: 200 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text" placeholder="Buscar por nome ou objetivo…"
            value={query} onChange={e => setQuery(e.target.value)}
            className="k-input"
            style={{ width: '100%', height: 44, border: '1.5px solid #e1dac9', borderRadius: 11, background: '#fff', padding: '0 14px 0 38px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilter('all')}    style={chipStyle(filter === 'all')}>Todos · {count('all')}</button>
          <button type="button" onClick={() => setFilter('green')}  style={chipStyle(filter === 'green')}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2b9d5f', display: 'inline-block', marginRight: 6 }} />Engajados · {count('green')}
          </button>
          <button type="button" onClick={() => setFilter('yellow')} style={chipStyle(filter === 'yellow')}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E0A93B', display: 'inline-block', marginRight: 6 }} />Alerta · {count('yellow')}
          </button>
          <button type="button" onClick={() => setFilter('red')}    style={chipStyle(filter === 'red')}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E0533B', display: 'inline-block', marginRight: 6 }} />Inativos · {count('red')}
          </button>
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => setSortOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              height: 44, padding: '0 14px',
              border: `1.5px solid ${sortOpen ? '#1B2A4A' : '#e1dac9'}`,
              background: sortOpen ? '#1B2A4A' : '#fff',
              color: sortOpen ? '#fff' : '#1B2A4A',
              borderRadius: 11, font: `600 13px ${FF}`, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M7 12h10"/><path d="M11 18h2"/>
            </svg>
            {SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Ordenar'}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: .7, transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {sortOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#fff', border: '1px solid #ece7d9', borderRadius: 12,
              boxShadow: '0 12px 32px rgba(27,42,74,.16)', zIndex: 50,
              minWidth: 260, overflow: 'hidden',
            }}>
              {SORT_OPTIONS.map(opt => {
                const active = sort === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { setSort(opt.key); setSortOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '11px 16px',
                      border: 'none', background: active ? '#f4f6fa' : 'none',
                      color: active ? '#1B2A4A' : '#4a4437',
                      font: `${active ? 700 : 500} 13px ${FF}`,
                      cursor: 'pointer', textAlign: 'left', gap: 10,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#fbf8f1' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}
                  >
                    {opt.label}
                    {active && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
        {/* Head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 20px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9' }}>
          <SortHeader label="Aluno"       sortAsc="name-asc"   sortDesc="name-desc"  current={sort} onSort={setSort} style={{ flex: 1, minWidth: 120 }} />
          <div className="k-col-plan" style={{ width: 96, ...colLabel }}>Plano</div>
          <SortHeader label="Pagamento"   sortAsc="pay"        sortDesc="pay"        current={sort} onSort={setSort} style={{ width: 104 }} />
          <SortHeader label="Engajamento" sortAsc="engagement" sortDesc="engagement" current={sort} onSort={setSort} style={{ width: 120 }} className="k-col-last" />
          <div className="k-col-next" style={{ width: 96, ...colLabel }}>Avaliação</div>
          <div style={{ width: 20 }} />
        </div>

        {shown.length === 0
          ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', borderTop: '1px solid #f1ece0' }}>
              <div style={{ font: `600 15px ${FF}`, color: '#1B2A4A', marginBottom: 5 }}>Nenhum aluno encontrado</div>
              <div style={{ font: `400 13px ${FF}`, color: '#9a948a', marginBottom: 16 }}>Ajuste a busca ou os filtros.</div>
              <button type="button" onClick={() => { setFilter('all'); setQuery('') }} style={{ height: 40, padding: '0 18px', border: '1.5px solid #d9d3c4', background: 'none', color: '#1B2A4A', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>
          )
          : shown.map((s, i) => {
              const pal = avatarPalette(s.id)
              const pay = payInfo(s.pay)
              const sem = semInfo(s.sem)
              return (
                <div
                  key={s.id}
                  onClick={() => setQuickIdx(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 14px ${FF}`, flexShrink: 0 }}>
                      {getInitials(s.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div className="k-col-goal" style={{ font: `400 12px ${FF}`, color: '#9a948a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.goal}</div>
                    </div>
                  </div>
                  <div className="k-col-plan" style={{ width: 96 }}>
                    <span style={{ font: `600 11px ${FF}`, color: '#1B2A4A', background: '#f1ece0', borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap' }}>{s.plan}</span>
                  </div>
                  <div style={{ width: 104 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', font: `600 11px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap' }}>{pay.label}</span>
                  </div>
                  <div className="k-col-last" style={{ width: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: sem.color, flexShrink: 0 }} />
                    <span style={{ font: `400 12px ${FF}`, color: '#9a948a', whiteSpace: 'nowrap' }}>{sem.last}</span>
                  </div>
                  <div className="k-col-next" style={{ width: 96, font: `500 12.5px ${FF}`, color: '#7c7869' }}>{s.next}</div>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5bfb0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                </div>
              )
            })
        }

        {shown.length > 0 && (
          <div style={{ padding: '13px 20px', borderTop: '1px solid #f1ece0', background: '#fbf8f1', font: `400 12.5px ${FF}`, color: '#9a948a' }}>
            Mostrando {shown.length} de {students.length} alunos
          </div>
        )}
      </div>

      {/* Quick view */}
      {quickIdx !== null && (() => {
        const student = students.find(s => s.id === quickIdx)
        return student ? (
          <QuickView
            student={student}
            onClose={() => setQuickIdx(null)}
            onOpenProfile={(id) => { setQuickIdx(null); navigate(`/coach/alunos/${id}`) }}
            onStub={() => showToast('Em breve — montamos esta tela a seguir.')}
            onDelete={() => { deleteStudent(quickIdx!); setQuickIdx(null); showToast('Aluno excluído.') }}
          />
        ) : null
      })()}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
      {newOpen    && <NewStudentModal onClose={() => setNewOpen(false)} onAdd={data => { if (user?.id) addStudent(data, user.id); setNewOpen(false) }} />}
      <Toast msg={toast} />
    </div>
  )
}
