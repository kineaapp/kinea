import { useState, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentsStore } from '../../store/students'
import { NewStudentModal } from '../../components/coach/NewStudentModal'

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
  if (s === 'green')  return { color: '#2b9d5f', last: 'check-in hoje' }
  if (s === 'yellow') return { color: '#E0A93B', last: 'há 6 dias'      }
  return                     { color: '#E0533B', last: 'há 11 dias'     }
}

function formatDate() {
  const d = new Date()
  const days   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
}

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
function InviteModal({ onClose }: { onClose: () => void }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [link,        setLink]        = useState('')
  const [copied,      setCopied]      = useState(false)

  function genLink() {
    const token = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8)
    setLink('app.kinea.fit/register/' + token)
    setCopied(false)
  }

  function copyLink() {
    try { navigator.clipboard.writeText('https://' + link) } catch {}
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
  const { students, addStudent }   = useStudentsStore()

  const shown = filter === 'all' ? students : students.filter(s => s.sem === filter)
  const count = (c: SemColor) => students.filter(s => s.sem === c).length

  return (
    <div className="k-pagepad" style={{ padding: '30px 34px 64px', maxWidth: 1180 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <div>
          <div style={{ font: `600 12px ${FF}`, color: '#a39e90', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 5 }}>{formatDate()}</div>
          <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Olá, Rafael 👋</h1>
          <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
            Você tem <strong style={{ color: '#1B2A4A' }}>4 pagamentos vencidos</strong> e <strong style={{ color: '#1B2A4A' }}>3 alunos</strong> precisando de atenção.
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
        <KpiCard label="Alunos ativos" value={34} sub="+3 este mês" subColor="#2b9d5f" iconBg="#eef1f6" iconColor="#1B2A4A"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
        />
        <KpiCard label="Pagam. vencidos" value={4} sub="R$ 1.560 em atraso" subColor="#D2402A" iconBg="#fbe6e1" iconColor="#D2402A"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>}
        />
        <KpiCard label="Leads novos" value={6} sub="no funil esta semana" subColor="#7c7869" iconBg="#f7ecd9" iconColor="#b06a12"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>}
        />
        <KpiCard label="Avaliações" value={3} sub="a vencer em 7 dias" subColor="#7c7869" iconBg="#eef1f6" iconColor="#1B2A4A"
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
          <span className="k-hidesm" style={{ font: `600 12px ${FF}`, color: '#a39e90' }}>34 alunos</span>
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 7, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: '64.7%', background: '#2b9d5f' }} />
          <div style={{ width: '26.5%', background: '#E0A93B' }} />
          <div style={{ width: '8.8%',  background: '#E0533B' }} />
        </div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {[{ color: '#2b9d5f', n: 22, label: 'engajados' }, { color: '#E0A93B', n: 9, label: 'em alerta' }, { color: '#E0533B', n: 3, label: 'inativos' }].map(({ color, n, label }) => (
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
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 20px', borderTop: '1px solid #f1ece0', cursor: 'pointer' }}>
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
                      <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{sem.last}</span>
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

          {/* Overdue payments */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 18px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Pagamentos</h2>
              <span style={{ font: `600 11px ${FF}`, color: '#D2402A', background: '#fbe6e1', borderRadius: 20, padding: '3px 9px' }}>4 vencidos</span>
            </div>
            {[
              { name: 'Carlos Henrique', sub: 'venceu há 6 dias', subColor: '#D2402A', val: 'R$ 390' },
              { name: 'Marina Klein',    sub: 'venceu há 3 dias', subColor: '#D2402A', val: 'R$ 390' },
              { name: 'Diego Farias',    sub: 'vence amanhã',     subColor: '#b06a12', val: 'R$ 290' },
            ].map(({ name, sub, subColor, val }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid #f1ece0' }}>
                <div>
                  <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{name}</div>
                  <div style={{ font: `400 11.5px ${FF}`, color: subColor }}>{sub}</div>
                </div>
                <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{val}</span>
              </div>
            ))}
            <button type="button" onClick={() => navigate('/coach/pagamentos')} style={{ width: '100%', border: 'none', background: 'none', color: '#E8542A', font: `600 13px ${FF}`, padding: '12px 0', cursor: 'pointer', borderTop: '1px solid #f1ece0', marginTop: 4 }}>
              Ver todos os pagamentos →
            </button>
          </div>

          {/* Leads pipeline */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Funil de leads</h2>
              <button type="button" onClick={() => navigate('/coach/leads')} style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer', padding: 0 }}>Abrir CRM</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ n: 6, label: 'Novo', accent: false }, { n: 4, label: 'Contactado', accent: false }, { n: 3, label: 'Interessado', accent: true }].map(({ n, label, accent }) => (
                <div key={label} style={{ flex: 1, background: '#f7f3ea', borderRadius: 10, padding: '11px 10px', textAlign: 'center' }}>
                  <div style={{ font: `800 19px/1 ${FF}`, color: accent ? '#E8542A' : '#1B2A4A' }}>{n}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#7c7869', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming assessments */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 18px 8px' }}>
            <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 6px' }}>Próximas avaliações</h2>
            {[
              { day: '27', mon: 'JUN', name: 'June Mazotini',  type: 'Reavaliação mensal'  },
              { day: '29', mon: 'JUN', name: 'Bruno Tavares',  type: 'Primeira avaliação'  },
              { day: '01', mon: 'JUL', name: 'Aline Souza',   type: 'Reavaliação mensal'  },
            ].map(({ day, mon, name, type }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderTop: '1px solid #f1ece0' }}>
                <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ font: `800 16px/1 ${FF}`, color: '#1B2A4A' }}>{day}</div>
                  <div style={{ font: `600 10px ${FF}`, color: '#9a948a' }}>{mon}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{name}</div>
                  <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{type}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {newOpen && (
        <NewStudentModal
          onClose={() => setNewOpen(false)}
          onAdd={data => { addStudent(data); }}
        />
      )}

    </div>
  )
}
