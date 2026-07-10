import { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { useLeadsStore } from '../../store/leads'
import { NewStudentModal } from '../../components/coach/NewStudentModal'
import { supabase } from '../../lib/supabase'

// ── Types & data ───────────────────────────────────────────
const FF = '"Libre Franklin",sans-serif'

type SemColor  = 'green' | 'yellow' | 'red'
type PayStatus = 'active' | 'pending' | 'overdue'

const AVATAR_PALETTE: [string, string][] = [
  ['#eef1f6','#1B2A4A'], ['#fbe6e1','#c4421e'], ['#e7f3ea','#1B7a4a'],
  ['#f7ecd9','#b06a12'], ['#ece9f6','#5a4ea0'],
]

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function payInfo(p: PayStatus) {
  if (p === 'active')  return { label: 'Em dia',   color: '#1B7a4a', bg: '#e7f3ea' }
  if (p === 'pending') return { label: 'Pendente', color: '#b06a12', bg: '#f7ecd9' }
  return                      { label: 'Vencido',  color: '#D2402A', bg: '#fbe6e1' }
}

function semInfo(s: SemColor) {
  if (s === 'green')  return { color: '#2b9d5f', label: 'Engajado'  }
  if (s === 'yellow') return { color: '#E0A93B', label: 'Em alerta' }
  return                     { color: '#E0533B', label: 'Inativo'   }
}

function formatDate() {
  const d = new Date()
  const days   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
}

function fmtShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}


function diffDays(iso: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const other = new Date(iso + 'T00:00:00')
  return Math.round((other.getTime() - today.getTime()) / 86_400_000)
}

type RecentAssessment  = { id: number; assessed_at: string; weight_kg: number | null; students: { name: string } | null }
type StudentAssessment = { id: number; name: string; next_assessment: string }
type CheckInFeed       = { id: number; content: string; created_at: string; students: { name: string } | null }

// ── Sub-components ──────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, iconBg, iconColor, icon }: {
  label: string; value: string | number; sub: string; subColor: string
  iconBg: string; iconColor: string; icon: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ font: `600 12px ${FF}`, color: '#7c7869' }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>{icon}</span>
      </div>
      <div style={{ font: `800 30px/1 ${FF}`, color: '#1B2A4A', letterSpacing: '-1px' }}>{value}</div>
      <div style={{ font: `500 12px ${FF}`, color: subColor, marginTop: 7 }}>{sub}</div>
    </div>
  )
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 20, padding: '6px 12px', font: `600 12px ${FF}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: '.12s', border: '1.5px solid' }
  return (
    <button type="button" onClick={onClick} style={active
      ? { ...base, background: '#1B2A4A', color: '#fff', borderColor: '#1B2A4A' }
      : { ...base, background: '#fff', color: '#7c7869', borderColor: '#e6e0d0' }
    }>{children}</button>
  )
}

// ── Invite modal ────────────────────────────────────────────
function InviteModal({ coachId, onClose }: { coachId: string; onClose: () => void }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [link,        setLink]        = useState('')
  const [copied,      setCopied]      = useState(false)

  function genLink() {
    const token = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8)
    setLink(window.location.origin + '/register/' + coachId + '/' + token)
    setCopied(false)
  }

  function copyLink() {
    try { navigator.clipboard.writeText(link) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '26px 26px 24px', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Convidar aluno</h2>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>
        <p style={{ font: `400 13.5px/1.5 ${FF}`, color: '#7c7869', margin: '0 0 18px' }}>
          Gere um link de convite. O aluno define a própria senha e o link expira em 7 dias.
        </p>
        <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>
          E-mail do aluno (opcional)
        </label>
        <input
          type="email" placeholder="aluno@email.com" value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
          style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', marginBottom: 14 }}
        />
        {!link
          ? <button type="button" onClick={genLink} style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
              Gerar link de convite
            </button>
          : <div>
              <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Link gerado</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#f7f3ea', display: 'flex', alignItems: 'center', padding: '0 13px', font: `500 12.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link}</div>
                <button type="button" onClick={copyLink} style={{ flexShrink: 0, width: 104, height: 46, border: 'none', borderRadius: 10, background: copied ? '#1B7a4a' : '#1B2A4A', color: '#fff', font: `700 13px ${FF}`, cursor: 'pointer' }}>
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p style={{ font: `400 12px/1.5 ${FF}`, color: '#9a948a', margin: '12px 0 0' }}>
                Compartilhe por WhatsApp ou e-mail. Você verá o aluno aqui assim que ele concluir o cadastro.
              </p>
            </div>
        }
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [filter,    setFilter]    = useState<'all' | SemColor>('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [newOpen,    setNewOpen]    = useState(false)
  const { students, addStudent, fetchStudents } = useStudentsStore()
  const { user } = useAuthStore()
  const { leads } = useLeadsStore()

  const [recentAssessments,   setRecentAssessments]   = useState<RecentAssessment[]>([])
  const [upcomingAssessments, setUpcomingAssessments] = useState<StudentAssessment[]>([])
  const [pendingAssessments,  setPendingAssessments]  = useState<StudentAssessment[]>([])
  const [checkIns,            setCheckIns]            = useState<CheckInFeed[]>([])
  const [upcomingPayments,    setUpcomingPayments]    = useState<{ studentId: number; name: string; iso: string }[]>([])

  useEffect(() => { if (user?.id) fetchStudents(user.id) }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const _d = new Date()
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

    supabase
      .from('assessments')
      .select('id, assessed_at, weight_kg, students(name)')
      .order('assessed_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentAssessments((data as RecentAssessment[] | null) ?? []))

    supabase
      .from('students')
      .select('id, name, next_assessment')
      .eq('coach_id', user.id)
      .gte('next_assessment', today)
      .order('next_assessment', { ascending: true })
      .limit(5)
      .then(({ data }) => setUpcomingAssessments((data as StudentAssessment[] | null) ?? []))

    supabase
      .from('students')
      .select('id, name, next_assessment')
      .eq('coach_id', user.id)
      .lt('next_assessment', today)
      .not('next_assessment', 'is', null)
      .order('next_assessment', { ascending: true })
      .then(({ data }) => setPendingAssessments((data as StudentAssessment[] | null) ?? []))

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
    supabase
      .from('check_ins')
      .select('id, content, created_at, students!inner(name, coach_id)')
      .eq('students.coach_id', user.id)
      .gte('created_at', `${yesterday}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setCheckIns((data as CheckInFeed[] | null) ?? []))

    // Próximos vencimentos reais da tabela payments (um por aluno, mais próximo)
    supabase
      .from('payments')
      .select('student_id, due_date, students!inner(name, coach_id)')
      .eq('students.coach_id', user.id)
      .eq('status', 'pending')
      .gte('due_date', today)
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<number>()
        const result: { studentId: number; name: string; iso: string }[] = []
        for (const p of data as any[]) {
          if (!seen.has(p.student_id)) {
            seen.add(p.student_id)
            result.push({ studentId: p.student_id, name: p.students.name, iso: p.due_date })
          }
        }
        setUpcomingPayments(result.slice(0, 5))
      })
  }, [user?.id])

  const shown = filter === 'all' ? students : students.filter(s => s.sem === filter)
  const count = (c: SemColor) => students.filter(s => s.sem === c).length

  return (
    <div className="k-pagepad" style={{ padding: '30px 34px 64px', maxWidth: 1180 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <div>
          <div style={{ font: `600 12px ${FF}`, color: '#a39e90', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 5 }}>{formatDate()}</div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Olá, {user?.name?.split(' ')[0] ?? 'Coach'} 👋</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
            {count('red') > 0
              ? <><strong style={{ color: '#1B2A4A' }}>{count('red')} aluno{count('red') > 1 ? 's' : ''}</strong> {count('red') > 1 ? 'precisando' : 'precisando'} de atenção.</>
              : 'Tudo em ordem por hoje.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setInviteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></svg>
            Convidar
          </button>
          <button type="button" onClick={() => setNewOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Novo aluno
          </button>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="k-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Alunos ativos" value={students.filter(s => s.pay === 'active').length} sub={students.length > 0 ? `${students.length} no total` : 'Nenhum aluno ainda'} subColor="#2b9d5f" iconBg="#eef1f6" iconColor="#1B2A4A"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
        />
        <KpiCard label="Pagam. vencidos" value={students.filter(s => s.pay === 'overdue').length} sub={students.filter(s => s.pay === 'overdue').length > 0 ? 'Ver pagamentos' : 'Sem atrasos'} subColor={students.filter(s => s.pay === 'overdue').length > 0 ? '#D2402A' : '#2b9d5f'} iconBg="#fbe6e1" iconColor="#D2402A"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>}
        />
        <KpiCard label="Leads novos" value={0} sub="no funil esta semana" subColor="#7c7869" iconBg="#f7ecd9" iconColor="#b06a12"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>}
        />
        <KpiCard
          label="Aval. pendentes"
          value={pendingAssessments.length}
          sub={pendingAssessments.length > 0 ? 'em atraso' : 'Sem atrasos'}
          subColor={pendingAssessments.length > 0 ? '#D2402A' : '#2b9d5f'}
          iconBg="#eef1f6" iconColor="#1B2A4A"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>}
        />
      </div>

      {/* ── Engagement semaphore ────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Semáforo de engajamento</h2>
            <p style={{ font: `400 12.5px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>Baseado nos check-ins semanais dos alunos</p>
          </div>
          <span className="k-hidesm" style={{ font: `600 12px ${FF}`, color: '#a39e90' }}>{students.length} alunos</span>
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 7, overflow: 'hidden', marginBottom: 16 }}>
          {students.length === 0
            ? <div style={{ width: '100%', background: '#f1ece0' }} />
            : <>
                <div style={{ width: `${(count('green') / students.length * 100).toFixed(1)}%`, background: '#2b9d5f' }} />
                <div style={{ width: `${(count('yellow') / students.length * 100).toFixed(1)}%`, background: '#E0A93B' }} />
                <div style={{ width: `${(count('red') / students.length * 100).toFixed(1)}%`, background: '#E0533B' }} />
              </>
          }
        </div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {[{ color: '#2b9d5f', n: count('green'), label: 'engajados' }, { color: '#E0A93B', n: count('yellow'), label: 'em alerta' }, { color: '#E0533B', n: count('red'), label: 'inativos' }].map(({ color, n, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: color }} />
              <span style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>{n}</span>
              <span style={{ font: `400 13px ${FF}`, color: '#7c7869' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column grid ─────────────────────────────────── */}
      <div className="k-cgrid" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Students list */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Seus alunos</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={filter === 'all'}    onClick={() => setFilter('all')}>Todos · {students.length}</Chip>
              <Chip active={filter === 'green'}  onClick={() => setFilter('green')}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2b9d5f', display: 'inline-block', marginRight: 5 }} />{count('green')}
              </Chip>
              <Chip active={filter === 'yellow'} onClick={() => setFilter('yellow')}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E0A93B', display: 'inline-block', marginRight: 5 }} />{count('yellow')}
              </Chip>
              <Chip active={filter === 'red'}    onClick={() => setFilter('red')}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E0533B', display: 'inline-block', marginRight: 5 }} />{count('red')}
              </Chip>
            </div>
          </div>

          {shown.length === 0
            ? <div style={{ padding: '34px 20px', textAlign: 'center', font: `400 13px ${FF}`, color: '#9a948a', borderTop: '1px solid #f1ece0' }}>Nenhum aluno neste filtro.</div>
            : shown.map((s, i) => {
                const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                const pay = payInfo(s.pay)
                const sem = semInfo(s.sem)
                return (
                  <div key={s.id} onClick={() => navigate(`/coach/alunos/${s.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 20px', borderTop: '1px solid #f1ece0', cursor: 'pointer' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 13px ${FF}`, flexShrink: 0 }}>
                      {getInitials(s.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{s.goal}</div>
                    </div>
                    <span className="k-hidesm" style={{ font: `600 11px ${FF}`, color: '#1B2A4A', background: '#f1ece0', borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap' }}>{s.plan}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap' }}>{pay.label}</span>
                    <span className="k-hidesm" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 96 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: sem.color, flexShrink: 0 }} />
                      <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{sem.label}</span>
                    </span>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5bfb0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                )
              })
          }
        </div>

        {/* Aside */}
        <div className="k-aside" style={{ width: 336, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Check-ins hoje / ontem */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0]
            const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
            const todayItems = checkIns.filter(c => c.created_at.startsWith(todayStr))
            const yesterdayItems = checkIns.filter(c => c.created_at.startsWith(yesterdayStr))

            function fmtTime(iso: string) {
              return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }

            function CheckInItem({ c, i }: { c: CheckInFeed; i: number }) {
              const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
              const name = c.students?.name ?? '—'
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid #f1ece0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 11px ${FF}`, flexShrink: 0 }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                      <span style={{ font: `500 11px ${FF}`, color: '#b0a99c', flexShrink: 0 }}>{fmtTime(c.created_at)}</span>
                    </div>
                    {c.content && (
                      <div style={{ font: `400 12px ${FF}`, color: '#7c7869', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.content}
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Check-ins</h2>
                  {checkIns.length > 0 && (
                    <span style={{ font: `600 11px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '3px 9px' }}>{checkIns.length} hoje e ontem</span>
                  )}
                </div>

                {checkIns.length === 0 ? (
                  <div style={{ padding: '18px 0', borderTop: '1px solid #f1ece0', font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center' }}>Nenhum check-in recente</div>
                ) : (
                  <>
                    {todayItems.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ font: `700 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 2 }}>Hoje</div>
                        {todayItems.map((c, i) => <CheckInItem key={c.id} c={c} i={i} />)}
                      </div>
                    )}
                    {yesterdayItems.length > 0 && (
                      <div style={{ marginTop: todayItems.length > 0 ? 12 : 10 }}>
                        <div style={{ font: `700 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 2 }}>Ontem</div>
                        {yesterdayItems.map((c, i) => <CheckInItem key={c.id} c={c} i={i} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* Payments card — overdue + upcoming */}
          {(() => {
            const overdue = students.filter(s => s.pay === 'overdue')
            const upcoming = upcomingPayments

            return (
              <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 18px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Pagamentos</h2>
                  {overdue.length > 0 && (
                    <span style={{ font: `600 11px ${FF}`, color: '#D2402A', background: '#fbe6e1', borderRadius: 20, padding: '3px 9px' }}>{overdue.length} vencido{overdue.length > 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Overdue */}
                {overdue.length === 0
                  ? <div style={{ padding: '14px 0', borderTop: '1px solid #f1ece0', font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center' }}>Sem pagamentos vencidos</div>
                  : overdue.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid #f1ece0' }}>
                      <div>
                        <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{s.name}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: '#D2402A' }}>pagamento vencido</div>
                      </div>
                      <span style={{ font: `600 11px ${FF}`, color: '#D2402A', background: '#fbe6e1', borderRadius: 20, padding: '3px 9px' }}>Vencido</span>
                    </div>
                  ))
                }

                {/* Upcoming */}
                {upcoming.length > 0 && (
                  <>
                    <div style={{ font: `700 10px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', padding: '12px 0 2px', borderTop: overdue.length > 0 ? '1px solid #f1ece0' : 'none', marginTop: overdue.length > 0 ? 4 : 0 }}>
                      Próximos vencimentos
                    </div>
                    {upcoming.map(({ studentId, name, iso }) => {
                      const diff = diffDays(iso)
                      const label = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : `em ${diff} dias`
                      return (
                        <div key={studentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1ece0' }}>
                          <div>
                            <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{name}</div>
                            <div style={{ font: `400 11.5px ${FF}`, color: diff <= 5 ? '#b06a12' : '#9a948a' }}>{label}</div>
                          </div>
                          <span style={{ font: `600 12px ${FF}`, color: '#7c7869' }}>{fmtShort(iso)}</span>
                        </div>
                      )
                    })}
                  </>
                )}

                <button type="button" onClick={() => navigate('/coach/pagamentos')} style={{ width: '100%', border: 'none', background: 'none', color: '#E8542A', font: `600 13px ${FF}`, padding: '12px 0', cursor: 'pointer', borderTop: '1px solid #f1ece0', marginTop: 4 }}>
                  Ver todos os pagamentos →
                </button>
              </div>
            )
          })()}

          {/* Leads pipeline */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Funil de leads</h2>
              <button type="button" onClick={() => navigate('/coach/leads')} style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer', padding: 0 }}>Abrir CRM</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { n: leads.filter(l => l.stage === 'novo').length,        label: 'Novo',        accent: false },
                { n: leads.filter(l => l.stage === 'contactado').length,  label: 'Contactado',  accent: false },
                { n: leads.filter(l => l.stage === 'interessado').length, label: 'Interessado', accent: true  },
              ].map(({ n, label, accent }) => (
                <div key={label} style={{ flex: 1, background: '#f7f3ea', borderRadius: 10, padding: '11px 10px', textAlign: 'center' }}>
                  <div style={{ font: `800 19px/1 ${FF}`, color: accent ? '#E8542A' : '#1B2A4A' }}>{n}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#7c7869', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Assessments panel ───────────────────────────────── */}
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1ece0' }}>
          <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Avaliações</h2>
        </div>

        <div className="k-aval-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>

          {/* ─ Últimas 5 ─ */}
          <div style={{ borderRight: '1px solid #f1ece0' }}>
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: `600 12px ${FF}`, color: '#7c7869', textTransform: 'uppercase', letterSpacing: '.4px' }}>Últimas realizadas</span>
              <span style={{ font: `600 11px ${FF}`, color: '#a39e90', background: '#f7f3ea', borderRadius: 20, padding: '2px 9px' }}>5</span>
            </div>
            {recentAssessments.length === 0
              ? <div style={{ padding: '20px 18px', font: `400 13px ${FF}`, color: '#b0a898', textAlign: 'center' }}>Nenhuma avaliação ainda</div>
              : recentAssessments.map((a, i) => {
                  const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                  const name = a.students?.name ?? '—'
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', borderTop: '1px solid #f7f3ea' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                        {getInitials(name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {a.weight_kg != null && (
                          <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{a.weight_kg} kg</div>
                        )}
                      </div>
                      <span style={{ font: `600 12px ${FF}`, color: '#7c7869', flexShrink: 0 }}>{fmtShort(a.assessed_at)}</span>
                    </div>
                  )
                })
            }
          </div>

          {/* ─ Próximas 5 ─ */}
          <div style={{ borderRight: '1px solid #f1ece0' }}>
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: `600 12px ${FF}`, color: '#7c7869', textTransform: 'uppercase', letterSpacing: '.4px' }}>Próximas agendadas</span>
              <span style={{ font: `600 11px ${FF}`, color: '#a39e90', background: '#f7f3ea', borderRadius: 20, padding: '2px 9px' }}>5</span>
            </div>
            {upcomingAssessments.length === 0
              ? <div style={{ padding: '20px 18px', font: `400 13px ${FF}`, color: '#b0a898', textAlign: 'center' }}>Nenhuma agendada</div>
              : upcomingAssessments.map((s, i) => {
                  const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                  const diff = diffDays(s.next_assessment)
                  const label = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : `em ${diff} dias`
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', borderTop: '1px solid #f7f3ea' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                        {getInitials(s.name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: diff <= 3 ? '#b06a12' : '#9a948a' }}>{label}</div>
                      </div>
                      <span style={{ font: `600 12px ${FF}`, color: '#7c7869', flexShrink: 0 }}>{fmtShort(s.next_assessment)}</span>
                    </div>
                  )
                })
            }
          </div>

          {/* ─ Pendentes ─ */}
          <div>
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: `600 12px ${FF}`, color: '#7c7869', textTransform: 'uppercase', letterSpacing: '.4px' }}>Pendentes / em atraso</span>
              {pendingAssessments.length > 0 && (
                <span style={{ font: `600 11px ${FF}`, color: '#D2402A', background: '#fbe6e1', borderRadius: 20, padding: '2px 9px' }}>{pendingAssessments.length}</span>
              )}
            </div>
            {pendingAssessments.length === 0
              ? <div style={{ padding: '20px 18px', font: `400 13px ${FF}`, color: '#b0a898', textAlign: 'center' }}>Nenhum aluno em atraso</div>
              : pendingAssessments.map((s, i) => {
                  const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
                  const overdue = Math.abs(diffDays(s.next_assessment))
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', borderTop: '1px solid #f7f3ea' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
                        {getInitials(s.name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: '#D2402A' }}>{overdue} dia{overdue !== 1 ? 's' : ''} em atraso</div>
                      </div>
                      <span style={{ font: `600 12px ${FF}`, color: '#D2402A', flexShrink: 0 }}>{fmtShort(s.next_assessment)}</span>
                    </div>
                  )
                })
            }
          </div>

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {inviteOpen && <InviteModal coachId={user?.id ?? ''} onClose={() => setInviteOpen(false)} />}

      {newOpen && (
        <NewStudentModal
          onClose={() => setNewOpen(false)}
          onAdd={data => { if (user?.id) addStudent(data, user.id) }}
        />
      )}

    </div>
  )
}
