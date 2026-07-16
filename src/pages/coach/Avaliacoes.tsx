import { useState, useRef, useEffect } from 'react'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

const AVATAR_PALETTE: [string, string][] = [
  ['#eef1f6', '#1B2A4A'],
  ['#fbe6e1', '#c4421e'],
  ['#e7f3ea', '#1B7a4a'],
  ['#f7ecd9', '#b06a12'],
  ['#ece9f6', '#5a4ea0'],
  ['#fbe6f3', '#b8338a'],
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  'em-dia':   { label: 'Em dia',   color: '#1B7a4a', bg: '#e7f3ea' },
  'pendente': { label: 'Reavaliar', color: '#b06a12', bg: '#f7ecd9' },
}

interface Assessment {
  date: string
  weight: number
  bf: number
  m: Record<string, number>
  photos: { frente: string | null; costas: string | null; ladoE: string | null; ladoD: string | null }
}

interface Student {
  id: number
  name: string
  goal: string
  loss: boolean
  days: number
  status: 'em-dia' | 'pendente'
  hist: Assessment[]
}

function getInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

function signed(diff: number, unit: string, lossGood: boolean): { txt: string; color: string } {
  const v = Math.round(diff * 10) / 10
  if (v === 0) return { txt: '—', color: '#9a948a' }
  const arrow = v < 0 ? '▼' : '▲'
  const abs = Math.abs(v).toString().replace('.', ',')
  const good = lossGood ? v < 0 : v > 0
  return { txt: `${arrow} ${abs}${unit}`, color: good ? '#1B7a4a' : '#c4421e' }
}

function kgStr(n: number) {
  return String(n).replace('.', ',') + ' kg'
}

// ── Pollock 7-skinfold ─────────────────────────────────────────────────────────
function pollockBF(sum: number, age: number, sex: 'M' | 'F'): number {
  const d = sex === 'M'
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age
  return Math.max(0, (4.95 / d - 4.5) * 100)
}

type SFKey = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7'

const SKINFOLDS: { key: SFKey; label: string }[] = [
  { key: 'd1', label: 'Peito' },
  { key: 'd2', label: 'Axilar médio' },
  { key: 'd3', label: 'Tríceps' },
  { key: 'd4', label: 'Subescapular' },
  { key: 'd5', label: 'Abdômen' },
  { key: 'd6', label: 'Supra-ilíaca' },
  { key: 'd7', label: 'Coxa' },
]

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Photo download helpers ─────────────────────────────────────────────────────
async function downloadPhoto(url: string, filename: string) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = blob.type.split('/')[1]?.replace('jpeg','jpg') ?? 'jpg'
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${filename}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  } catch {
    window.open(url, '_blank')
  }
}

async function downloadAllPhotos(slots: { label: string; url: string | null }[], studentName: string) {
  for (const { label, url } of slots) {
    if (!url) continue
    await downloadPhoto(url, `${studentName.replace(/\s+/g,'-')}_${label}`)
    await new Promise(r => setTimeout(r, 300))
  }
}

// ── Student Drawer ─────────────────────────────────────────────────────────────
function StudentDrawer({ student, onClose, onRemind, onRegister }: {
  student: Student
  onClose: () => void
  onRemind: (id: number) => void
  onRegister: (id: number) => void
}) {
  const pal = AVATAR_PALETTE[student.id % AVATAR_PALETTE.length]
  const hist = student.hist
  const last = hist[hist.length - 1]
  const prev = hist.length > 1 ? hist[hist.length - 2] : null
  const wd = prev ? signed(last.weight - prev.weight, ' kg', student.loss) : { txt: '1ª avaliação', color: '#9a948a' }

  const ws = hist.slice(-5)
  const mx = Math.max(...ws.map(h => h.weight))
  const mn = Math.min(...ws.map(h => h.weight))
  const span = (mx - mn) || 1
  const weightSeries = ws.map((h, i) => ({
    kg: String(h.weight).replace('.', ','),
    date: h.date,
    pct: 30 + Math.round((h.weight - mn) / span * 70),
    fill: i === ws.length - 1 ? '#E8542A' : '#cdd5e0',
  }))

  const measures = Object.keys(last.m).filter(k => last.m[k] > 0).map(k => {
    const dd = prev ? signed(last.m[k] - (prev.m[k] ?? 0), ' cm', student.loss) : { txt: '—', color: '#9a948a' }
    return { label: k, value: `${last.m[k]} cm`, delta: dd.txt, deltaColor: dd.color }
  })

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 55 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '94vw', background: '#F4EFE3', zIndex: 56, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ background: '#1B2A4A', padding: '22px 22px 20px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 16px ${FF}`, flexShrink: 0 }}>
              {getInitials(student.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `800 18px ${FF}`, color: '#fff', letterSpacing: '-.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</div>
              <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc', marginTop: 2 }}>{student.goal} · avaliado em {last.date}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Weight evolution */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ font: `700 12.5px ${FF}`, color: '#1B2A4A' }}>Evolução do peso</div>
              <div style={{ font: `700 12.5px ${FF}`, color: wd.color }}>{wd.txt}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 96 }}>
              {weightSeries.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ font: `700 10px ${FF}`, color: '#6b6657' }}>{w.kg}</div>
                  <div style={{ width: '100%', maxWidth: 34, height: `${w.pct}%`, background: w.fill, borderRadius: '6px 6px 2px 2px' }} />
                  <div style={{ font: `600 9.5px ${FF}`, color: '#b0a99c' }}>{w.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Measurements */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 13 }}>
              Medidas <span style={{ color: '#c9c1b0', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(vs. avaliação anterior)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {measures.map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf7ee', borderRadius: 10, padding: '11px 13px' }}>
                  <div>
                    <div style={{ font: `600 11px ${FF}`, color: '#7c7869' }}>{m.label}</div>
                    <div style={{ font: `800 15px ${FF}`, color: '#1B2A4A', marginTop: 2 }}>{m.value}</div>
                  </div>
                  <span style={{ font: `700 11.5px ${FF}`, color: m.deltaColor }}>{m.delta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>Fotos corporais</div>
              {[last.photos?.frente, last.photos?.costas, last.photos?.ladoE, last.photos?.ladoD].some(Boolean) && (
                <button
                  onClick={() => downloadAllPhotos([
                    { label: 'Frente', url: last.photos?.frente ?? null },
                    { label: 'Costas', url: last.photos?.costas ?? null },
                    { label: 'LadoE',  url: last.photos?.ladoE  ?? null },
                    { label: 'LadoD',  url: last.photos?.ladoD  ?? null },
                  ], student.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 8, padding: '5px 10px', font: `600 11px ${FF}`, cursor: 'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Baixar todas
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 9 }}>
              {([
                { label: 'Frente', url: last.photos?.frente ?? null },
                { label: 'Costas', url: last.photos?.costas ?? null },
                { label: 'Lado E', url: last.photos?.ladoE  ?? null },
                { label: 'Lado D', url: last.photos?.ladoD  ?? null },
              ] as { label: string; url: string | null }[]).map(({ label, url }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {url ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <img src={url} alt={label} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 9, border: '1px solid #e0d9c8', display: 'block' }} />
                      <button
                        onClick={() => downloadPhoto(url, `${student.name.replace(/\s+/g,'-')}_${label}`)}
                        title={`Baixar ${label}`}
                        style={{ position: 'absolute', bottom: 5, right: 5, width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(27,42,74,.72)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 9, border: '1px solid #e0d9c8', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'repeating-linear-gradient(45deg,#e7e0ce 0,#e7e0ce 9px,#ede7d7 9px,#ede7d7 18px)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b6ae9c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                  <span style={{ font: `600 10px ${FF}`, color: '#9a948a' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '15px 22px', background: '#fff', borderTop: '1px solid #ece7d9', display: 'flex', gap: 10 }}>
          <button onClick={() => onRemind(student.id)} style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5z" /></svg>
            Solicitar fotos
          </button>
          <button onClick={() => onRegister(student.id)} style={{ flex: 1.4, height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Registrar avaliação
          </button>
        </div>
      </div>
    </>
  )
}

// ── Student picker (searchable) ────────────────────────────────────────────────
function StudentPicker({ roster, value, onChange, error }: {
  roster:   { id: number; name: string }[]
  value:    string
  onChange: (name: string) => void
  error:    boolean
}) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const filtered = roster.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        style={{
          width: '100%', height: 44, border: `1.5px solid ${error ? '#c4421e' : open ? '#E8542A' : '#d9d3c4'}`,
          boxShadow: open ? '0 0 0 3px rgba(232,84,42,.13)' : 'none',
          borderRadius: 10, background: '#fff', padding: '0 12px',
          font: `400 14px ${FF}`, color: value ? '#1B2A4A' : '#aaa',
          outline: 'none', boxSizing: 'border-box' as const, textAlign: 'left' as const,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{value || 'Selecionar aluno…'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, boxShadow: '0 12px 32px rgba(27,42,74,.16)', zIndex: 20, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0ebe0' }}>
            <input
              autoFocus
              type="text"
              placeholder="Buscar aluno…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', height: 36, border: '1.5px solid #d9d3c4', borderRadius: 8, padding: '0 10px', font: `400 13px ${FF}`, outline: 'none', boxSizing: 'border-box' as const, color: '#1B2A4A' }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: 14, font: `400 13px ${FF}`, color: '#9a948a', textAlign: 'center' }}>Nenhum aluno encontrado.</div>
              : filtered.map(s => {
                  const active = value === s.name
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { onChange(s.name); setOpen(false) }}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: active ? '#f4f6fa' : 'none', color: active ? '#1B2A4A' : '#4a4437', font: `${active ? 700 : 500} 13.5px ${FF}`, cursor: 'pointer', textAlign: 'left' as const }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#fbf8f1' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}
                    >
                      {s.name}
                    </button>
                  )
                })
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Age helper ─────────────────────────────────────────────────────────────────
function calcAgeFromISO(iso: string): number {
  const birth = new Date(iso)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ── New Assessment Modal ───────────────────────────────────────────────────────
function NewAssessmentModal({ roster, initial, onClose, onSave }: {
  roster:  { id: number; name: string; uuid: string }[]
  initial: string
  onClose: () => void
  onSave:  (name: string, weight: string, bf: number) => void
}) {
  const [name,       setName]       = useState(initial)
  const [weight,     setWeight]     = useState('')
  const [sex,        setSex]        = useState<'M' | 'F'>('F')
  const [age,        setAge]        = useState('')
  const [ageFromDb,  setAgeFromDb]  = useState(false)

  useEffect(() => {
    const entry = roster.find(s => s.name === name)
    if (!entry?.uuid) { setAgeFromDb(false); return }
    supabase
      .from('anamneses')
      .select('data_nasc')
      .eq('student_id', entry.uuid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.data_nasc) {
          const a = calcAgeFromISO(data.data_nasc)
          if (a > 0) { setAge(String(a)); setAgeFromDb(true) }
        } else {
          setAgeFromDb(false)
        }
      })
  }, [name])
  const [dobras, setDobras] = useState<Record<SFKey, string>>({
    d1: '', d2: '', d3: '', d4: '', d5: '', d6: '', d7: '',
  })
  const [err, setErr] = useState('')

  const ageN     = parseInt(age) || 0
  const weightN  = parseFloat(weight.replace(',', '.')) || 0
  const vals     = SKINFOLDS.map(s => parseFloat(dobras[s.key].replace(',', '.')) || 0)
  const allFilled = SKINFOLDS.every(s => dobras[s.key].trim() !== '')
  const sum7     = vals.reduce((a, v) => a + v, 0)
  const bfCalc   = allFilled && ageN > 0 ? pollockBF(sum7, ageN, sex) : null
  const massaGorda = bfCalc !== null && weightN ? (bfCalc / 100) * weightN : null
  const massaMagra = massaGorda !== null && weightN ? weightN - massaGorda : null

  function fmt1(n: number) { return n.toFixed(1).replace('.', ',') }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 12px', font: `400 14px ${FF}`, color: '#1B2A4A',
    outline: 'none', boxSizing: 'border-box',
  }
  function focusOn(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#E8542A'
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,84,42,.13)'
  }
  function focusOff(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#d9d3c4'
    e.currentTarget.style.boxShadow   = 'none'
  }

  function handleSave() {
    if (!name.trim())   { setErr('Informe o aluno.'); return }
    if (!weight.trim()) { setErr('Informe o peso.'); return }
    onSave(name, weight, bfCalc !== null ? Math.round(bfCalc * 10) / 10 : 0)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 26px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Nova avaliação</h2>
              <p style={{ font: `400 12.5px ${FF}`, color: '#9a948a', margin: '3px 0 0' }}>Peso obrigatório · 7 dobras Pollock opcionais</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─ Dados básicos ─ */}
          <div>
            <div style={{ font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Dados básicos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Aluno</label>
                <StudentPicker roster={roster} value={name} onChange={v => { setName(v); setErr('') }} error={!!err && !name} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Peso (kg)</label>
                  <input type="text" value={weight} placeholder="Ex: 78,4" onChange={e => { setWeight(e.target.value); setErr('') }} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657' }}>Idade</label>
                    {ageFromDb && <span style={{ font: `500 10px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '2px 8px' }}>da anamnese</span>}
                  </div>
                  <input type="text" value={age} placeholder="25" onChange={e => { setAge(e.target.value); setAgeFromDb(false); setErr('') }} style={{ ...inputBase, textAlign: 'center', borderColor: ageFromDb ? '#8ecfad' : '#d9d3c4', background: ageFromDb ? '#f4fbf7' : '#fff' }} onFocus={focusOn} onBlur={focusOff} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>Sexo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['F', 'M'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setSex(s)}
                      style={{ flex: 1, height: 40, border: `1.5px solid ${sex === s ? '#E8542A' : '#e0d9c8'}`, background: sex === s ? '#fdf3ee' : '#fff', color: sex === s ? '#E8542A' : '#7c7869', font: `700 13px ${FF}`, borderRadius: 9, cursor: 'pointer' }}
                    >
                      {s === 'F' ? 'Feminino' : 'Masculino'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─ 7 Dobras ─ */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a' }}>7 Dobras cutâneas (mm) <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— opcional</span></div>
              {allFilled && <span style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>Σ = {fmt1(sum7)} mm</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SKINFOLDS.map((sf, i) => (
                <div key={sf.key} style={i === 6 ? { gridColumn: '1 / -1', maxWidth: 'calc(50% - 5px)' } : {}}>
                  <label style={{ display: 'block', font: `600 10.5px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{sf.label}</label>
                  <input
                    type="text"
                    value={dobras[sf.key]}
                    placeholder="0,0"
                    onChange={e => { setDobras(prev => ({ ...prev, [sf.key]: e.target.value })); setErr('') }}
                    style={{ ...inputBase, height: 42, textAlign: 'center', font: `700 15px ${FF}` }}
                    onFocus={focusOn} onBlur={focusOff}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ─ Resultado calculado ─ */}
          {bfCalc !== null ? (
            <div style={{ background: '#faf7ee', border: '1px solid #e0d9c8', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ font: `600 10.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Resultado calculado</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'center' }}>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#E8542A', letterSpacing: '-.5px' }}>{fmt1(bfCalc)}%</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>% Gordura</div>
                </div>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#c4421e', letterSpacing: '-.5px' }}>{massaGorda !== null ? fmt1(massaGorda) + ' kg' : '—'}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>Massa gorda</div>
                </div>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#1B7a4a', letterSpacing: '-.5px' }}>{massaMagra !== null ? fmt1(massaMagra) + ' kg' : '—'}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>Massa magra</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#faf7ee', border: '1px dashed #d8d1c0', borderRadius: 11, padding: '11px 14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="16.5" r=".8" fill="#b06a12"/>
              </svg>
              <span style={{ font: `500 12px ${FF}`, color: '#7c7869' }}>Preencha as 7 dobras e a idade para calcular o % de gordura (opcional).</span>
            </div>
          )}

          {err && <div style={{ font: `600 12.5px ${FF}`, color: '#c4421e' }}>{err}</div>}

          <button type="button" onClick={handleSave}
            style={{ width: '100%', height: 48, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
          >
            Salvar avaliação
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
type Tab = 'all' | 'em-dia' | 'pendente'

export default function Avaliacoes() {
  const { user } = useAuthStore()
  const { students: roster, fetchStudents } = useStudentsStore()
  useEffect(() => { if (user?.id) fetchStudents(user.id) }, [user?.id])

  useEffect(() => {
    if (!user?.id || roster.length === 0 || assessLoadedRef.current) return
    assessLoadedRef.current = true
    const rosterIds = roster.map(r => r.id)
    supabase
      .from('assessments')
      .select('student_id,assessed_at,weight_kg,body_fat_pct,chest_cm,waist_cm,hip_cm,arm_cm,thigh_cm,photo_frente_url,photo_costas_url,photo_lado_esq_url,photo_lado_dir_url')
      .in('student_id', rosterIds)
      .order('assessed_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Avaliacoes]', error.message)
          setLoadError(error.message)
          return
        }
        if (!data || data.length === 0) return
        const grouped: Record<number, typeof data> = {}
        data.forEach(a => {
          if (!grouped[a.student_id]) grouped[a.student_id] = []
          grouped[a.student_id].push(a)
        })
        const built: Student[] = roster
          .filter(r => (grouped[r.id]?.length ?? 0) > 0)
          .map(r => {
            const asses = grouped[r.id]
            const hist: Assessment[] = asses.map(a => {
              const d = new Date(a.assessed_at)
              const label = `${d.getDate().toString().padStart(2,'0')}/${d.toLocaleString('pt-BR',{month:'short'})}`
              return {
                date: label,
                weight: a.weight_kg ?? 0,
                bf: a.body_fat_pct ?? 0,
                m: { Peito: a.chest_cm ?? 0, Cintura: a.waist_cm ?? 0, Quadril: a.hip_cm ?? 0, 'Braço': a.arm_cm ?? 0, Coxa: a.thigh_cm ?? 0 },
                photos: { frente: a.photo_frente_url ?? null, costas: a.photo_costas_url ?? null, ladoE: a.photo_lado_esq_url ?? null, ladoD: a.photo_lado_dir_url ?? null },
              }
            })
            const lastA = asses[asses.length - 1]
            const daysSince = (Date.now() - new Date(lastA.assessed_at).getTime()) / 86400000
            const isLoss = r.goal.toLowerCase().includes('emagreciment') || r.goal.toLowerCase().includes('perda') || r.goal.toLowerCase().includes('gordura')
            return {
              id: r.id,
              name: r.name,
              goal: r.goal,
              loss: isLoss,
              days: Math.floor(daysSince),
              status: (daysSince > 30 ? 'pendente' : 'em-dia') as 'em-dia' | 'pendente',
              hist,
            }
          })
        setStudents(built)
      })
  }, [user?.id, roster.length])

  const [students, setStudents] = useState<Student[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nextId, setNextId] = useState(1)
  const [tab, setTab] = useState<Tab>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newInitial, setNewInitial] = useState('')
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const assessLoadedRef = useRef(false)

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1900)
  }

  const enriched = students.map(s => {
    const pal = AVATAR_PALETTE[s.id % AVATAR_PALETTE.length]
    const last = s.hist[s.hist.length - 1]
    const prev = s.hist.length > 1 ? s.hist[s.hist.length - 2] : null
    const wd  = prev ? signed(last.weight - prev.weight, ' kg', s.loss) : { txt: '1ª avaliação', color: '#9a948a' }
    const bfd = prev ? signed(last.bf - prev.bf, '%', s.loss) : { txt: '—', color: '#9a948a' }
    const sm  = STATUS_MAP[s.status]
    return {
      ...s,
      initials: getInitials(s.name),
      avBg: pal[0], avColor: pal[1],
      weightStr: kgStr(last.weight),
      bfStr: String(last.bf).replace('.', ',') + '%',
      weightDelta: wd.txt, deltaColor: wd.color,
      bfDelta: bfd.txt, bfDeltaColor: bfd.color,
      lastDate: last.date,
      statusLabel: sm.label, statusColor: sm.color, statusBg: sm.bg,
    }
  })

  const visible = tab === 'all' ? enriched : enriched.filter(s => s.status === tab)

  const monthCount   = students.reduce((a, s) => a + s.hist.filter(h => /jun|hoje/.test(h.date)).length, 0)
  const pendingCount = students.filter(s => s.status === 'pendente').length

  let totDelta = 0, n = 0
  students.forEach(s => {
    if (s.hist.length > 1) { totDelta += s.hist[s.hist.length - 1].weight - s.hist[0].weight; n++ }
  })
  const avg = n ? Math.round(totDelta / n * 10) / 10 : 0
  const collectiveDelta = (avg < 0 ? '▼ ' : '▲ ') + Math.abs(avg).toString().replace('.', ',') + ' kg'
  const collectiveColor = avg <= 0 ? '#1B7a4a' : '#c4421e'

  const openStudent = students.find(s => s.id === openId) ?? null

  function handleRemind(id: number) {
    const s = students.find(x => x.id === id)
    if (s) showToast(`Solicitação de fotos enviada a ${s.name.split(' ')[0]}.`)
  }

  function handleRegisterFor(id: number) {
    const s = students.find(x => x.id === id)
    setOpenId(null)
    setNewInitial(s ? s.name : '')
    setNewOpen(true)
  }

  async function handleSave(nameRaw: string, weightStr: string, bf: number) {
    const name = nameRaw.trim()
    if (!name) { showToast('Informe o aluno.'); return }
    const w = parseFloat(weightStr.replace(',', '.'))
    if (!w) { showToast('Informe o peso.'); return }

    const rosterStudent = roster.find(s => s.name.toLowerCase() === name.toLowerCase())
    const emptyPhotos = { frente: null, costas: null, ladoE: null, ladoD: null }

    const idx = students.findIndex(s => s.name.toLowerCase() === name.toLowerCase())
    if (idx >= 0) {
      const s = students[idx]
      const entry: Assessment = { date: 'hoje', weight: w, bf, m: { ...s.hist[s.hist.length - 1].m }, photos: emptyPhotos }
      const updated = [...students]
      updated[idx] = { ...s, status: 'em-dia', days: 0, hist: [...s.hist, entry] }
      setStudents(updated)
    } else {
      const newS: Student = {
        id: rosterStudent?.id ?? nextId, name, goal: rosterStudent?.goal ?? 'A definir', loss: true, days: 0, status: 'em-dia',
        hist: [{ date: 'hoje', weight: w, bf, m: { Peito: 0, Cintura: 0, Quadril: 0, 'Braço': 0, Coxa: 0 }, photos: emptyPhotos }],
      }
      setStudents([newS, ...students])
      if (!rosterStudent) setNextId(x => x + 1)
    }
    setNewOpen(false)
    showToast(`Avaliação registrada para ${name.split(' ')[0]}.`)

    if (rosterStudent) {
      await supabase.from('assessments').insert({
        student_id:  rosterStudent.id,
        assessed_at: new Date().toISOString().split('T')[0],
        weight_kg:   w,
        body_fat_pct: bf > 0 ? bf : null,
      })
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'em-dia', label: 'Em dia' },
    { key: 'pendente', label: 'Pendentes' },
  ]

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ padding: '30px 34px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Avaliações físicas</h1>
            <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>Acompanhe peso, medidas e evolução corporal dos alunos</p>
          </div>
          <button
            onClick={() => { setNewInitial(''); setNewOpen(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Nova avaliação
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 6 }}>
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              </div>
              <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>Avaliações no mês</span>
            </div>
            <div style={{ font: `800 26px ${FF}`, color: '#1B2A4A', letterSpacing: '-.5px' }}>{monthCount}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#f7ecd9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 1.5" /></svg>
              </div>
              <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>Reavaliações pendentes</span>
            </div>
            <div style={{ font: `800 26px ${FF}`, color: '#b06a12', letterSpacing: '-.5px' }}>{pendingCount}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '18px 19px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>
              </div>
              <span style={{ font: `600 11.5px ${FF}`, color: '#7c7869' }}>Resultado coletivo</span>
            </div>
            <div style={{ font: `800 26px ${FF}`, color: collectiveColor, letterSpacing: '-.5px' }}>{collectiveDelta}</div>
          </div>
        </div>
      </div>

      {/* ── Filter + Grid ── */}
      <div style={{ padding: '10px 34px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e0d9c8', borderRadius: 10, padding: 4 }}>
            {TABS.map(t => {
              const active = tab === t.key
              const count = t.key === 'all' ? enriched.length : enriched.filter(s => s.status === t.key).length
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{ border: 'none', background: active ? '#1B2A4A' : 'transparent', color: active ? '#fff' : '#7c7869', font: `700 12.5px ${FF}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
                >
                  {t.label} <span style={{ opacity: .55 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16 }}>
          {visible.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '50px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d8d1c0', borderRadius: 14 }}>
              Nenhuma avaliação registrada ainda.
            </div>
          )}
          {visible.map(s => (
            <div
              key={s.id}
              onClick={() => setOpenId(s.id)}
              style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'box-shadow .15s,transform .15s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 8px 22px rgba(27,42,74,.13)'; el.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'none'; el.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: s.avBg, color: s.avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 15px ${FF}`, flexShrink: 0 }}>
                  {s.initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: `800 15.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ font: `500 11.5px ${FF}`, color: '#9a948a' }}>{s.goal}</div>
                </div>
                <span style={{ font: `700 10.5px ${FF}`, color: s.statusColor, background: s.statusBg, borderRadius: 20, padding: '5px 10px', whiteSpace: 'nowrap' }}>{s.statusLabel}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, background: '#faf7ee', borderRadius: 11, padding: '11px 12px' }}>
                  <div style={{ font: `600 10px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 4 }}>Peso atual</div>
                  <div style={{ font: `800 17px ${FF}`, color: '#1B2A4A' }}>{s.weightStr}</div>
                  <div style={{ font: `700 11px ${FF}`, color: s.deltaColor, marginTop: 1 }}>{s.weightDelta}</div>
                </div>
                <div style={{ flex: 1, background: '#faf7ee', borderRadius: 11, padding: '11px 12px' }}>
                  <div style={{ font: `600 10px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 4 }}>% Gordura</div>
                  <div style={{ font: `800 17px ${FF}`, color: '#1B2A4A' }}>{s.bfStr}</div>
                  <div style={{ font: `700 11px ${FF}`, color: s.bfDeltaColor, marginTop: 1 }}>{s.bfDelta}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f4efe3', marginTop: 14, paddingTop: 12 }}>
                <span style={{ font: `500 11.5px ${FF}`, color: '#b0a99c' }}>Última: {s.lastDate}</span>
                <span style={{ font: `700 12px ${FF}`, color: '#E8542A', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Ver evolução
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </span>
              </div>
            </div>
          ))}

          {loadError && (
            <div style={{ gridColumn: '1/-1', background: '#fbe6e1', border: '1px solid #f4c4b8', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ font: `700 13px ${FF}`, color: '#c4421e', marginBottom: 4 }}>Erro ao carregar avaliações</div>
              <div style={{ font: `400 12px ${FF}`, color: '#7c3a2a', fontFamily: 'monospace', wordBreak: 'break-all' }}>{loadError}</div>
              <div style={{ font: `400 12px ${FF}`, color: '#7c3a2a', marginTop: 6 }}>Verifique se a migração <strong>024_assessments_photo_columns.sql</strong> foi aplicada no banco.</div>
            </div>
          )}

          {!loadError && visible.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '50px 20px', textAlign: 'center', font: `500 14px ${FF}`, color: '#a89f8e', border: '1.5px dashed #d8d1c0', borderRadius: 14 }}>
              Nenhum aluno neste filtro.
            </div>
          )}
        </div>
      </div>

      {openStudent && (
        <StudentDrawer
          student={openStudent}
          onClose={() => setOpenId(null)}
          onRemind={handleRemind}
          onRegister={handleRegisterFor}
        />
      )}

      {newOpen && (
        <NewAssessmentModal
          roster={roster.map(s => ({ id: s.id, name: s.name, uuid: s.studentUuid }))}
          initial={newInitial}
          onClose={() => setNewOpen(false)}
          onSave={handleSave}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}
