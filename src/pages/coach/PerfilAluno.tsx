import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ROSTER, getInitials, payInfo, semInfo, avatarPalette } from '../../data/mock'

const FF = '"Libre Franklin",sans-serif'

type Tab = 'overview' | 'treino' | 'avaliacoes' | 'pagamentos' | 'anexos' | 'historico'

// ── Static mock data (June's profile) ──────────────────────
const WORKOUTS = [
  { letter: 'A', title: 'Peito & Tríceps', count: 6, items: [
    { name: 'Supino reto',      sets: '4×8'  },
    { name: 'Supino inclinado', sets: '3×10' },
    { name: 'Crucifixo',       sets: '3×12' },
    { name: 'Tríceps testa',   sets: '4×10' },
  ]},
  { letter: 'B', title: 'Costas & Bíceps', count: 6, items: [
    { name: 'Puxada frente',  sets: '4×10' },
    { name: 'Remada curvada', sets: '4×8'  },
    { name: 'Rosca direta',   sets: '3×12' },
    { name: 'Rosca martelo',  sets: '3×12' },
  ]},
  { letter: 'C', title: 'Pernas & Ombro', count: 7, items: [
    { name: 'Agachamento',        sets: '4×8'  },
    { name: 'Leg press',          sets: '4×12' },
    { name: 'Cadeira extensora',  sets: '3×15' },
    { name: 'Desenvolvimento',    sets: '4×10' },
  ]},
]

const INVOICES = [
  { month: 'Junho 2025', date: 'venc. 05/jun', amount: 'R$ 390', label: 'Pago', color: '#1B7a4a', bg: '#e7f3ea' },
  { month: 'Maio 2025',  date: 'venc. 05/mai', amount: 'R$ 390', label: 'Pago', color: '#1B7a4a', bg: '#e7f3ea' },
  { month: 'Abril 2025', date: 'venc. 05/abr', amount: 'R$ 390', label: 'Pago', color: '#1B7a4a', bg: '#e7f3ea' },
  { month: 'Março 2025', date: 'venc. 05/mar', amount: 'R$ 390', label: 'Pago', color: '#1B7a4a', bg: '#e7f3ea' },
]

const ATTACHMENTS = [
  { name: 'Hemograma completo.pdf', ext: 'PDF', meta: '1,2 MB · 12 jun', bg: '#fbe6e1', color: '#c4421e', tag: 'Exame',     tagColor: '#5a4ea0', tagBg: '#eceaf6' },
  { name: 'Progresso frente.jpg',   ext: 'JPG', meta: '2,8 MB · 10 jun', bg: '#e7f3ea', color: '#1B7a4a', tag: 'Foto',      tagColor: '#1B7a4a', tagBg: '#e7f3ea' },
  { name: 'Progresso costas.jpg',   ext: 'JPG', meta: '2,6 MB · 10 jun', bg: '#e7f3ea', color: '#1B7a4a', tag: 'Foto',      tagColor: '#1B7a4a', tagBg: '#e7f3ea' },
  { name: 'Laudo ortopédico.pdf',   ext: 'PDF', meta: '640 KB · 02 jun', bg: '#fbe6e1', color: '#c4421e', tag: 'Laudo',     tagColor: '#b06a12', tagBg: '#f7ecd9' },
  { name: 'Atestado médico.pdf',    ext: 'PDF', meta: '320 KB · 28 mai', bg: '#fbe6e1', color: '#c4421e', tag: 'Documento', tagColor: '#1B2A4A', tagBg: '#eef1f6' },
  { name: 'Bioimpedância mai.pdf',  ext: 'PDF', meta: '880 KB · 03 mai', bg: '#fbe6e1', color: '#c4421e', tag: 'Exame',     tagColor: '#5a4ea0', tagBg: '#eceaf6' },
]

const TIMELINE = [
  { dot: '#E8542A', title: 'Check-in registrado',   desc: 'Treino C concluído · carga aumentada no agachamento', date: 'Hoje, 07:42' },
  { dot: '#1B2A4A', title: 'Novo anexo enviado',     desc: 'Hemograma completo.pdf adicionado pela aluna',        date: '12 jun, 18:10' },
  { dot: '#1B2A4A', title: 'Avaliação física',       desc: 'Peso 64,8 kg · 22,4% de gordura',                    date: '01 jun, 09:00' },
  { dot: '#1B7a4a', title: 'Pagamento confirmado',   desc: 'Fatura de junho · R$ 390',                            date: '05 jun, 11:23' },
  { dot: '#1B2A4A', title: 'Treino atualizado',      desc: 'Programa ABC ajustado para semana 8',                 date: '30 abr, 15:30' },
  { dot: '#9a948a', title: 'Início do acompanhamento',desc: 'Aluna ingressou no plano Mensal',                   date: '10 mar, 10:00' },
]

const CHECKIN_BARS = [
  { day: 'Seg', h: 64, active: true  },
  { day: 'Ter', h: 80, active: true  },
  { day: 'Qua', h: 24, active: false },
  { day: 'Qui', h: 72, active: true  },
  { day: 'Sex', h: 58, active: true  },
  { day: 'Sáb', h: 14, active: false },
  { day: 'Dom', h: 14, active: false },
]

const WEIGHT_BARS = [
  { label: '69,0', mon: 'Mar', h: 108, active: false },
  { label: '67,3', mon: 'Abr', h: 96,  active: false },
  { label: '66,1', mon: 'Mai', h: 88,  active: false },
  { label: '64,8', mon: 'Jun', h: 78,  active: true  },
]

// ── Toast ───────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)' }}>
      {msg}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────
export default function PerfilAluno() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [tab, setTab]   = useState<Tab>('overview')
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const studentId = parseInt(id ?? '0', 10)
  const student   = ROSTER[studentId] ?? ROSTER[0]
  const pal       = avatarPalette(studentId)
  const pay       = payInfo(student.pay)
  const sem       = semInfo(student.sem)

  function showToast(msg: string) {
    setToast(msg); clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1800)
  }
  useEffect(() => () => clearTimeout(toastRef.current), [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: 'Visão geral'  },
    { key: 'treino',      label: 'Treino'        },
    { key: 'avaliacoes',  label: 'Avaliações'    },
    { key: 'pagamentos',  label: 'Pagamentos'    },
    { key: 'anexos',      label: 'Anexos'        },
    { key: 'historico',   label: 'Histórico'     },
  ]

  return (
    <div>
      {/* ── Outer pad ──────────────────────────────────────── */}
      <div className="k-pagepad" style={{ padding: '30px 34px 64px', maxWidth: 1180 }}>

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/coach/alunos')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 13px ${FF}`, color: '#7c7869', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: '0 4px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Voltar para Alunos
        </button>

        {/* ── Hero ───────────────────────────────────────── */}
        <div className="k-hero" style={{ background: '#1B2A4A', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
          <div className="k-heropad" style={{ padding: '26px 28px', display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 27px ${FF}`, flexShrink: 0 }}>
              {getInitials(student.name)}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ font: `800 25px ${FF}`, color: '#fff', margin: 0, letterSpacing: '-.5px' }}>{student.name}</h1>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px ${FF}`, color: sem.label === 'Engajado' ? '#bfe6cd' : sem.label === 'Em alerta' ? '#f5dcae' : '#f5c8c0', background: sem.label === 'Engajado' ? 'rgba(43,157,95,.22)' : sem.label === 'Em alerta' ? 'rgba(224,169,59,.22)' : 'rgba(224,83,59,.22)', borderRadius: 20, padding: '4px 11px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: sem.color }} />{sem.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>🎯 {student.goal}</span>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>📋 Plano {student.plan}</span>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>📅 Aluno(a) desde {student.since}</span>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>✉️ {student.email}</span>
              </div>
            </div>
            <div className="k-herostats" style={{ display: 'flex', gap: 10 }}>
              {[
                { val: '12', unit: '', sub: 'semanas' },
                { val: '-4,2', unit: 'kg', sub: 'desde início' },
                { val: '92', unit: '%', sub: 'adesão', highlight: true },
              ].map(({ val, unit, sub, highlight }) => (
                <div key={sub} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '13px 16px', textAlign: 'center', minWidth: 78 }}>
                  <div style={{ font: `800 22px/1 ${FF}`, color: highlight ? '#3ddc84' : '#fff' }}>
                    {val}<span style={{ fontSize: 13 }}>{unit}</span>
                  </div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#8b97ad', marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="k-tabscroll" style={{ display: 'flex', gap: 2, padding: '0 28px', background: 'rgba(255,255,255,.04)', overflowX: 'auto' }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  border: 'none', background: 'none',
                  color: tab === key ? '#fff' : '#aeb9cc',
                  font: `600 13.5px ${FF}`,
                  padding: '14px 14px', cursor: 'pointer',
                  borderBottom: `2.5px solid ${tab === key ? '#E8542A' : 'transparent'}`,
                  whiteSpace: 'nowrap',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* ── Tab body ──────────────────────────────────── */}
        <div className="k-bodypad">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="k-twocol" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Treino atual */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Treino atual</h2>
                    <span style={{ font: `600 11px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '4px 11px' }}>Ativo</span>
                  </div>
                  <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A' }}>Programa ABC · Hipertrofia</div>
                  <div style={{ font: `400 13px ${FF}`, color: '#7c7869', marginTop: 3 }}>5 treinos/semana · semana 8 de 12</div>
                  <div style={{ height: 8, background: '#f1ece0', borderRadius: 5, overflow: 'hidden', marginTop: 14 }}>
                    <div style={{ width: '67%', height: '100%', background: '#E8542A', borderRadius: 5 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
                    <span style={{ font: `500 11.5px ${FF}`, color: '#9a948a' }}>67% do ciclo</span>
                    <span style={{ font: `500 11.5px ${FF}`, color: '#9a948a' }}>faltam 4 semanas</span>
                  </div>
                </div>
                {/* Check-ins */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                  <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: '0 0 14px' }}>Check-ins recentes</h2>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', height: 90 }}>
                    {CHECKIN_BARS.map(({ day, h, active }) => (
                      <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: '100%', background: active ? '#E8542A' : '#f1ece0', borderRadius: 5, height: h }} />
                        <span style={{ font: `500 10px ${FF}`, color: '#9a948a' }}>{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="k-aside" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Ações rápidas */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Ações rápidas</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['⚡ Editar treino', '📅 Agendar avaliação', '📎 Enviar anexo', '💬 Enviar mensagem'].map(label => (
                      <button key={label} type="button" onClick={() => showToast('Em breve!')} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', border: '1.5px solid #ece7d9', background: '#fff', padding: '11px 13px', borderRadius: 10, cursor: 'pointer', font: `600 13.5px ${FF}`, color: '#1B2A4A', textAlign: 'left' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Resumo */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Resumo</h2>
                  {[
                    { label: 'Próxima avaliação', val: student.next, valColor: '#1B2A4A' },
                    { label: 'Pagamento',          val: pay.label,   valColor: pay.color  },
                    { label: 'Última mensagem',    val: 'há 2 dias', valColor: '#1B2A4A' },
                    { label: 'Adesão ao treino',   val: '92%',       valColor: '#1B2A4A' },
                  ].map(({ label, val, valColor }, i, arr) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1ece0' : 'none' }}>
                      <span style={{ font: `400 13px ${FF}`, color: '#7c7869' }}>{label}</span>
                      <span style={{ font: `600 13px ${FF}`, color: valColor }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TREINO */}
          {tab === 'treino' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Programa ABC · Hipertrofia</h2>
                  <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>Atribuído em 30/abr · 5 dias/semana</p>
                </div>
                <button type="button" onClick={() => showToast('Em breve!')} style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                  Abrir no builder →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                {WORKOUTS.map(w => (
                  <div key={w.letter} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#1B2A4A', color: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 14px ${FF}` }}>{w.letter}</div>
                      <div>
                        <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{w.title}</div>
                        <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{w.count} exercícios</div>
                      </div>
                    </div>
                    {w.items.map(ex => (
                      <div key={ex.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f4efe3' }}>
                        <span style={{ font: `500 12.5px ${FF}`, color: '#4a4742' }}>{ex.name}</span>
                        <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{ex.sets}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AVALIAÇÕES */}
          {tab === 'avaliacoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Evolução física</h2>
                <button type="button" onClick={() => showToast('Em breve!')} style={{ height: 42, padding: '0 18px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>+ Nova avaliação</button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Peso atual',   val: '64,8 kg', delta: '▼ 4,2 kg', up: true  },
                  { label: '% Gordura',    val: '22,4%',   delta: '▼ 3,1 pts', up: true  },
                  { label: 'Massa magra',  val: '50,3 kg', delta: '▲ 1,4 kg', up: false },
                ].map(({ label, val, delta, up }) => (
                  <div key={label} style={{ flex: 1, minWidth: 130, background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 16 }}>
                    <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{label}</div>
                    <div style={{ font: `800 24px ${FF}`, color: '#1B2A4A', marginTop: 4 }}>{val}</div>
                    <div style={{ font: `600 12px ${FF}`, color: up ? '#1B7a4a' : '#b06a12', marginTop: 2 }}>{delta}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                <h3 style={{ font: `700 14px ${FF}`, color: '#1B2A4A', margin: '0 0 16px' }}>Peso ao longo do tempo</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 140 }}>
                  {WEIGHT_BARS.map(({ label, mon, h, active }) => (
                    <div key={mon} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: `${active ? '800' : '700'} 12px ${FF}`, color: active ? '#E8542A' : '#7c7869' }}>{label}</span>
                      <div style={{ width: '60%', background: active ? '#E8542A' : '#cdd6e4', borderRadius: '5px 5px 0 0', height: h }} />
                      <span style={{ font: `${active ? '600' : '500'} 10px ${FF}`, color: active ? '#1B2A4A' : '#9a948a' }}>{mon}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PAGAMENTOS */}
          {tab === 'pagamentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150, background: '#1B2A4A', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc' }}>Plano atual</div>
                  <div style={{ font: `800 19px ${FF}`, color: '#fff', marginTop: 5 }}>Mensal · R$ 390</div>
                  <div style={{ font: `400 12px ${FF}`, color: '#8b97ad', marginTop: 3 }}>renova dia 05</div>
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Status</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', font: `700 14px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '4px 12px', marginTop: 7 }}>{pay.label}</div>
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Total pago</div>
                  <div style={{ font: `800 19px ${FF}`, color: '#1B2A4A', marginTop: 5 }}>R$ 1.560</div>
                  <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>4 faturas</div>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9' }}>
                  <span style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>Faturas</span>
                  <button type="button" onClick={() => showToast('Em breve!')} style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer' }}>Registrar pagamento</button>
                </div>
                {INVOICES.map((iv, i) => (
                  <div key={iv.month} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0' }}>
                    <div>
                      <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>{iv.month}</div>
                      <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{iv.date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{iv.amount}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', font: `600 11px ${FF}`, color: iv.color, background: iv.bg, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{iv.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANEXOS */}
          {tab === 'anexos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Anexos</h2>
                  <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>Exames, fotos de progresso, laudos e documentos</p>
                </div>
                <button type="button" onClick={() => showToast('Em breve!')} style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>+ Adicionar anexo</button>
              </div>
              {/* Dropzone */}
              <button type="button" onClick={() => showToast('Em breve!')} style={{ width: '100%', border: '2px dashed #d2ccbb', background: '#fbf8f1', borderRadius: 14, padding: 26, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                <span style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>Arraste arquivos ou clique para enviar</span>
                <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>PDF, JPG ou PNG até 10 MB</span>
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
                {ATTACHMENTS.map(a => (
                  <div key={a.name} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 11px ${FF}`, color: a.color }}>{a.ext}</div>
                      <button type="button" onClick={() => showToast('Em breve!')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c5bfb0', padding: 2 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
                      </button>
                    </div>
                    <div>
                      <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>{a.meta}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f4efe3', paddingTop: 10 }}>
                      <span style={{ font: `600 10.5px ${FF}`, color: a.tagColor, background: a.tagBg, borderRadius: 20, padding: '3px 9px' }}>{a.tag}</span>
                      <button type="button" onClick={() => showToast('Em breve!')} style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer', padding: 0 }}>Baixar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTÓRICO */}
          {tab === 'historico' && (
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '22px 24px' }}>
              <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: '0 0 18px', letterSpacing: '-.3px' }}>Linha do tempo</h2>
              {TIMELINE.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.dot, marginTop: 4, flexShrink: 0 }} />
                    {i < TIMELINE.length - 1 && <div style={{ width: 2, flex: 1, background: '#eee5d2' }} />}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{t.title}</div>
                    <div style={{ font: `400 12.5px ${FF}`, color: '#7c7869', marginTop: 2 }}>{t.desc}</div>
                    <div style={{ font: `500 11px ${FF}`, color: '#b0a99c', marginTop: 4 }}>{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <Toast msg={toast} />
    </div>
  )
}
