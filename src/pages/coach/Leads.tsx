import { useState, useRef, useEffect, type DragEvent } from 'react'
import { getInitials } from '../../data/mock'
import { useLeadsStore, type Lead, type LeadStage as Stage } from '../../store/leads'
import { useAuthStore } from '../../store/auth'

const FF = '"Libre Franklin",sans-serif'

// ── Constants ───────────────────────────────────────────────
const STAGES: { key: Stage; title: string; color: string }[] = [
  { key: 'novo',        title: 'Novo',        color: '#5a8fd6' },
  { key: 'contactado',  title: 'Contactado',  color: '#E0A93B' },
  { key: 'interessado', title: 'Interessado', color: '#E8542A' },
  { key: 'fechado',     title: 'Fechado',     color: '#2b9d5f' },
  { key: 'perdido',     title: 'Perdido',     color: '#9a948a' },
]

const SOURCE_STYLE: Record<string, { color: string; bg: string }> = {
  Instagram: { color: '#b8338a', bg: '#fbe6f3' },
  Indicação: { color: '#1B7a4a', bg: '#e7f3ea' },
  WhatsApp:  { color: '#1a7d4f', bg: '#e3f3ea' },
  Site:      { color: '#1B2A4A', bg: '#eef1f6' },
  Tráfego:   { color: '#b06a12', bg: '#f7ecd9' },
}

const AV_PALETTE: [string, string][] = [
  ['#eef1f6', '#1B2A4A'], ['#fbe6e1', '#c4421e'], ['#e7f3ea', '#1B7a4a'],
  ['#f7ecd9', '#b06a12'], ['#ece9f6', '#5a4ea0'], ['#fbe6f3', '#b8338a'],
]

function avPalette(id: number): [string, string] {
  return AV_PALETTE[id % AV_PALETTE.length]
}

function parseValue(v: string) {
  return parseInt(v.replace(/\D/g, ''), 10) || 0
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

// ── Lead card ───────────────────────────────────────────────
function LeadCard({ lead, onDragStart, onDragEnd, onClick }: {
  lead: Lead
  onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void
  onDragEnd:   (e: DragEvent<HTMLDivElement>) => void
  onClick:     (id: number) => void
}) {
  const [bg, color] = avPalette(lead.id)
  const src = SOURCE_STYLE[lead.source] ?? { color: '#1B2A4A', bg: '#eef1f6' }
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead.id)}
      style={{ background: '#fff', border: '1px solid #e9e2d2', borderRadius: 12, padding: '13px 14px', cursor: 'grab', transition: 'box-shadow .15s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 18px rgba(27,42,74,.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${FF}`, flexShrink: 0 }}>
          {getInitials(lead.name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
          <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{lead.goal}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
        <span style={{ font: `600 10.5px ${FF}`, color: src.color, background: src.bg, borderRadius: 20, padding: '3px 9px' }}>{lead.source}</span>
        <span style={{ font: `500 10.5px ${FF}`, color: '#7c7869', background: '#f4efe3', borderRadius: 20, padding: '3px 9px' }}>{lead.plan}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f4efe3', paddingTop: 9 }}>
        <span style={{ font: `400 11px ${FF}`, color: '#b0a99c' }}>{lead.when}</span>
        <span style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>{lead.value}</span>
      </div>
    </div>
  )
}

// ── Kanban column ───────────────────────────────────────────
function KanbanColumn({ stage, leads, dragOver, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onCardClick, onQuickAdd }: {
  stage:       { key: Stage; title: string; color: string }
  leads:       Lead[]
  dragOver:    boolean
  onDragOver:  (e: DragEvent<HTMLDivElement>, col: Stage) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDrop:      (e: DragEvent<HTMLDivElement>, col: Stage) => void
  onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void
  onDragEnd:   (e: DragEvent<HTMLDivElement>) => void
  onCardClick: (id: number) => void
  onQuickAdd:  (col: Stage) => void
}) {
  const total = leads.reduce((a, l) => a + parseValue(l.value), 0)
  const totalLabel = total ? 'R$ ' + total.toLocaleString('pt-BR') : '—'

  return (
    <div
      onDragOver={e => onDragOver(e, stage.key)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, stage.key)}
      style={{
        width: 282, flexShrink: 0, background: dragOver ? '#fdf3ee' : '#efe9da',
        outline: dragOver ? '2px dashed #E8542A' : 'none',
        outlineOffset: -2, borderRadius: 14, display: 'flex', flexDirection: 'column',
        transition: 'background .1s',
      }}
    >
      {/* Column header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2dac8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
          <span style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{stage.title}</span>
          <span style={{ font: `600 11px ${FF}`, color: '#7c7869', background: '#fff', borderRadius: 20, padding: '2px 9px' }}>{leads.length}</span>
        </div>
        <span style={{ font: `600 11.5px ${FF}`, color: '#9a948a' }}>{totalLabel}</span>
      </div>

      {/* Cards */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
        {leads.map(l => (
          <LeadCard key={l.id} lead={l} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onCardClick} />
        ))}
        {leads.length === 0 && (
          <div style={{ padding: '18px 10px', textAlign: 'center', font: `400 12px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d8d1c0', borderRadius: 10 }}>
            Arraste leads para cá
          </div>
        )}
        <button
          type="button"
          onClick={() => onQuickAdd(stage.key)}
          style={{ border: 'none', background: 'none', color: '#9a948a', font: `600 12.5px ${FF}`, cursor: 'pointer', padding: 8, textAlign: 'left', borderRadius: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e7e0ce'; e.currentTarget.style.color = '#1B2A4A' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9a948a' }}
        >
          + Adicionar lead
        </button>
      </div>
    </div>
  )
}

// ── Lead detail drawer ──────────────────────────────────────
function LeadDrawer({ lead, onClose, onMoveStage, onConvert, onWarn }: {
  lead:        Lead
  onClose:     () => void
  onMoveStage: (id: number, stage: Stage) => void
  onConvert:   (id: number) => void
  onWarn:      (msg: string) => void
}) {
  const [bg, color] = avPalette(lead.id)
  const src = SOURCE_STYLE[lead.source] ?? { color: '#1B2A4A', bg: '#eef1f6' }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '24px 22px', position: 'relative' }}>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 19px ${FF}`, flexShrink: 0 }}>
              {getInitials(lead.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `800 19px ${FF}`, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
              <div style={{ font: `500 12.5px ${FF}`, color: '#aeb9cc', marginTop: 3 }}>{lead.goal}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stage selector */}
          <div>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 8 }}>Etapa do funil</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map(s => {
                const active = lead.stage === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onMoveStage(lead.id, s.key)}
                    style={{ border: `1.5px solid ${active ? s.color : '#e0d9c8'}`, background: active ? s.color : '#fff', color: active ? '#fff' : '#7c7869', font: `600 11.5px ${FF}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer' }}
                  >
                    {s.title}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Origem</div>
              <span style={{ display: 'inline-block', font: `700 12px ${FF}`, color: src.color, background: src.bg, borderRadius: 20, padding: '3px 10px' }}>{lead.source}</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Plano de interesse</div>
              <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{lead.plan}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Valor estimado</div>
              <div style={{ font: `800 16px ${FF}`, color: '#1B2A4A' }}>{lead.value}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 14 }}>
              <div style={{ font: `600 11px ${FF}`, color: '#9a948a', marginBottom: 6 }}>Contato</div>
              <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>{lead.contact || '—'}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 8 }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', padding: '8px 8px 4px' }}>Próximas ações</div>
            {[
              {
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z"/></svg>,
                label: 'Enviar WhatsApp', color: '#1B2A4A', hoverBg: '#fbf8f1',
                action: () => { const d = lead.contact.replace(/\D/g, ''); d ? window.open(`https://wa.me/55${d}`, '_blank') : onWarn('Informe um telefone de contato para este lead.') },
              },
              {
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
                label: 'Ligar', color: '#1B2A4A', hoverBg: '#fbf8f1',
                action: () => { const d = lead.contact.replace(/\D/g, ''); d ? window.open(`tel:+55${d}`) : onWarn('Informe um telefone de contato para este lead.') },
              },
              {
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>,
                label: 'Converter em aluno', color: '#1B7a4a', hoverBg: '#eef7f0', action: () => onConvert(lead.id),
              },
            ].map(({ icon, label, color, hoverBg, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', border: 'none', background: 'none', padding: '9px 8px', borderRadius: 8, cursor: 'pointer', font: `600 13.5px ${FF}`, color, textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Constants for the modal ─────────────────────────────────
const SOURCES = Object.keys(SOURCE_STYLE)
const PLANS   = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'A definir']
const PLAN_VALUE: Record<string, string> = {
  Mensal: 'R$ 399/mês', Trimestral: 'R$ 247/mês', Semestral: 'R$ 227/mês', Anual: 'R$ 207/mês',
}
const GOALS = ['Emagrecimento', 'Hipertrofia', 'Força', 'Recomposição', 'Condicionamento', 'Mobilidade']

// ── New lead modal ──────────────────────────────────────────
function NewLeadModal({ initialStage, onClose, onAdd }: {
  initialStage: Stage
  onClose: () => void
  onAdd:   (data: Omit<Lead, 'id'>) => void
}) {
  const [name,    setName]    = useState('')
  const [goal,    setGoal]    = useState('')
  const [contact, setContact] = useState('')
  const [source,  setSource]  = useState('Instagram')
  const [plan,    setPlan]    = useState('Mensal')
  const [value,   setValue]   = useState('R$ 390')
  const [stage,   setStage]   = useState<Stage>(initialStage)
  const [err,     setErr]     = useState('')

  function handlePlanChange(p: string) {
    setPlan(p)
    if (PLAN_VALUE[p]) setValue(PLAN_VALUE[p])
  }

  function handleSubmit() {
    if (!name.trim()) { setErr('Informe o nome do lead.'); return }
    onAdd({
      name:    name.trim(),
      goal:    goal || 'A definir',
      contact: contact.trim(),
      source,
      plan,
      value:   value.trim() || '—',
      when:    'agora',
      stage,
    })
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 14px', font: `400 14px ${FF}`,
    color: '#1B2A4A', outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px',
    textTransform: 'uppercase', color: '#6b6657', marginBottom: 7,
  }
  function fo(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#E8542A'
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,84,42,.13)'
  }
  function fb(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#d9d3c4'
    e.currentTarget.style.boxShadow   = 'none'
  }
  function chipBtn(active: boolean, accent = '#E8542A'): React.CSSProperties {
    return {
      border: `1.5px solid ${active ? accent : '#e0d9c8'}`,
      background: active ? accent : '#fff',
      color: active ? '#fff' : '#7c7869',
      font: `600 11.5px ${FF}`, borderRadius: 20,
      padding: '6px 12px', cursor: 'pointer',
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, padding: '26px 26px 22px', boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Novo lead</h2>
            <p style={{ font: `400 12.5px ${FF}`, color: '#9a948a', margin: '4px 0 0' }}>Preencha os dados e adicione ao funil</p>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Nome */}
        <label style={lbl}>Nome *</label>
        <input
          autoFocus type="text" value={name} placeholder="Nome completo do lead"
          onChange={e => { setName(e.target.value); setErr('') }}
          onFocus={fo} onBlur={fb}
          style={{ ...inp, borderColor: err ? '#c4421e' : '#d9d3c4', marginBottom: err ? 6 : 14 }}
        />
        {err && <div style={{ font: `500 12px ${FF}`, color: '#c4421e', marginBottom: 12 }}>{err}</div>}

        {/* Objetivo + Contato */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={lbl}>Objetivo</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {GOALS.map(g => (
                <button key={g} type="button" onClick={() => setGoal(g)} style={{ ...chipBtn(goal === g), fontSize: 11, padding: '5px 10px', marginBottom: 5 }}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Contato</label>
            <input
              type="text" value={contact} placeholder="Telefone, e-mail ou @"
              onChange={e => setContact(e.target.value)}
              onFocus={fo} onBlur={fb}
              style={{ ...inp, height: 42 }}
            />
          </div>
        </div>

        {/* Origem */}
        <label style={{ ...lbl, marginBottom: 8 }}>Origem</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {SOURCES.map(s => {
            const ss = SOURCE_STYLE[s]
            const active = source === s
            return (
              <button
                key={s} type="button" onClick={() => setSource(s)}
                style={{
                  border: `1.5px solid ${active ? ss.color : '#e0d9c8'}`,
                  background: active ? ss.bg : '#fff',
                  color: active ? ss.color : '#7c7869',
                  font: `700 11.5px ${FF}`, borderRadius: 20,
                  padding: '6px 14px', cursor: 'pointer',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>

        {/* Plano + Valor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 18 }}>
          <div>
            <label style={{ ...lbl, marginBottom: 8 }}>Plano de interesse</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLANS.map(p => (
                <button key={p} type="button" onClick={() => handlePlanChange(p)} style={chipBtn(plan === p)}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={lbl}>Valor estimado</label>
            <input
              type="text" value={value} placeholder="R$ 390"
              onChange={e => setValue(e.target.value)}
              onFocus={fo} onBlur={fb}
              style={{ ...inp, font: `700 15px ${FF}`, textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Etapa do funil */}
        <label style={{ ...lbl, marginBottom: 8 }}>Etapa do funil</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
          {STAGES.map(s => {
            const active = stage === s.key
            return (
              <button
                key={s.key} type="button" onClick={() => setStage(s.key)}
                style={{
                  border: `1.5px solid ${active ? s.color : '#e0d9c8'}`,
                  background: active ? s.color : '#fff',
                  color: active ? '#fff' : '#7c7869',
                  font: `600 12px ${FF}`, borderRadius: 20,
                  padding: '7px 14px', cursor: 'pointer',
                }}
              >
                {s.title}
              </button>
            )
          })}
        </div>

        <button
          type="button" onClick={handleSubmit}
          style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
        >
          Adicionar ao funil
        </button>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function Leads() {
  const { leads, fetchLeads, addLead, updateStage } = useLeadsStore()
  const { user } = useAuthStore()
  const [openId,      setOpenId]      = useState<number | null>(null)
  const [newOpen,     setNewOpen]     = useState(false)
  const [newStage,    setNewStage]    = useState<Stage>('novo')
  const [dragOverCol, setDragOverCol] = useState<Stage | null>(null)
  const [toast,       setToast]       = useState('')
  const dragIdRef = useRef<number | null>(null)
  const toastRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(toastRef.current), [])

  useEffect(() => { if (user?.id) fetchLeads(user.id) }, [user?.id])

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1800)
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: number) {
    dragIdRef.current = id
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)) } catch {}
    e.currentTarget.style.opacity = '0.5'
  }

  function handleDragEnd(e: DragEvent<HTMLDivElement>) {
    e.currentTarget.style.opacity = '1'
    dragIdRef.current = null
    setDragOverCol(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, col: Stage) {
    e.preventDefault()
    try { e.dataTransfer.dropEffect = 'move' } catch {}
    if (dragOverCol !== col) setDragOverCol(col)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCol(null)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, col: Stage) {
    e.preventDefault()
    setDragOverCol(null)
    let id = dragIdRef.current
    try { if (!id) id = parseInt(e.dataTransfer.getData('text/plain'), 10) } catch {}
    if (!id) return
    updateStage(id, col)
  }

  function handleMoveStage(id: number, stage: Stage) {
    updateStage(id, stage)
  }

  function handleConvert(id: number) {
    const lead = leads.find(l => l.id === id)
    if (!lead) return
    updateStage(id, 'fechado')
    setOpenId(null)
    showToast(lead.name.split(' ')[0] + ' convertido em aluno!')
  }

  async function handleAddLead(data: Omit<Lead, 'id'>) {
    if (!user?.id) return
    const { when: _w, ...rest } = data
    await addLead(rest, user.id)
    setNewOpen(false)
    showToast('Lead adicionado ao funil.')
  }

  function handleQuickAdd(col: Stage) {
    setNewStage(col)
    setNewOpen(true)
  }

  const active = leads.filter(l => l.stage !== 'fechado' && l.stage !== 'perdido').length
  const won    = leads.filter(l => l.stage === 'fechado').length
  const lost   = leads.filter(l => l.stage === 'perdido').length
  const closed = won + lost
  const conv   = closed ? Math.round((won / closed) * 100) + '%' : '—'
  const openLead = openId !== null ? leads.find(l => l.id === openId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '30px 34px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Leads</h1>
            <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
              <strong style={{ color: '#1B2A4A' }}>{active}</strong> no funil ·{' '}
              <strong style={{ color: '#1B7a4a' }}>{won}</strong> fechados este mês · taxa de conversão{' '}
              <strong style={{ color: '#1B2A4A' }}>{conv}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setNewStage('novo'); setNewOpen(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Novo lead
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '0 34px 30px' }}>
        <div style={{ display: 'flex', gap: 14, minWidth: 'max-content', minHeight: 520 }}>
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              leads={leads.filter(l => l.stage === stage.key)}
              dragOver={dragOverCol === stage.key}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCardClick={setOpenId}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenId(null)}
          onMoveStage={handleMoveStage}
          onConvert={handleConvert}
          onWarn={showToast}
        />
      )}

      {newOpen && <NewLeadModal initialStage={newStage} onClose={() => setNewOpen(false)} onAdd={handleAddLead} />}
      <Toast msg={toast} />
    </div>
  )
}
