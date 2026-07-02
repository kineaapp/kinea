import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const FF = '"Libre Franklin",sans-serif'

const AVATAR_PALETTE: [string, string][] = [
  ['#eef1f6', '#1B2A4A'],
  ['#fbe6e1', '#c4421e'],
  ['#e7f3ea', '#1B7a4a'],
  ['#f7ecd9', '#b06a12'],
  ['#ece9f6', '#5a4ea0'],
  ['#fbe6f3', '#b8338a'],
]

// ── Types ──────────────────────────────────────────────────────────────────────
type AttachKind = 'image' | 'video' | 'audio' | 'file'

type MsgEntry =
  | { type: 'day';    text: string }
  | { type: 'msg';    from: 'me' | 'them'; text: string; time: string }
  | { type: 'attach'; from: 'me' | 'them'; kind: AttachKind; url: string; name: string; size: string; time: string }

interface Conv {
  id: number
  name: string
  online: boolean
  time: string
  unread: number
  msgs: MsgEntry[]
}

// ── Seed data ──────────────────────────────────────────────────────────────────
const SEED: Conv[] = [
  { id: 1, name: 'Tatiane Ribeiro', online: true, time: '09:42', unread: 2,
    msgs: [
      { type: 'day', text: 'Ontem' },
      { type: 'msg', from: 'them', text: 'Oi Rafa! Terminei o treino A hoje 💪', time: '08:30' },
      { type: 'msg', from: 'them', text: 'Mas senti um desconforto no ombro na última série de supino', time: '08:31' },
      { type: 'msg', from: 'me', text: 'Boa, Tati! Vamos com calma então. Reduz a carga em 10% no supino inclinado e foca na execução.', time: '08:45' },
      { type: 'day', text: 'Hoje' },
      { type: 'msg', from: 'them', text: 'Combinado! E sobre a dieta, posso trocar o arroz por batata doce no almoço?', time: '09:40' },
      { type: 'msg', from: 'them', text: 'Mesma quantidade?', time: '09:42' },
    ] },
  { id: 2, name: 'Rafael Antunes', online: true, time: '08:15', unread: 0,
    msgs: [
      { type: 'day', text: 'Hoje' },
      { type: 'msg', from: 'me', text: 'Bom dia! Subi seu novo treino de costas, dá uma olhada.', time: '07:50' },
      { type: 'msg', from: 'them', text: 'Vi sim, ficou top! Já testo hoje à tarde 🔥', time: '08:15' },
    ] },
  { id: 3, name: 'Beatriz Camargo', online: false, time: 'Ontem', unread: 1,
    msgs: [
      { type: 'day', text: 'Ontem' },
      { type: 'msg', from: 'them', text: 'Professor, não vou conseguir treinar quarta. Consigo repor quinta?', time: '19:20' },
    ] },
  { id: 4, name: 'Eduardo Nunes', online: false, time: 'Ontem', unread: 0,
    msgs: [
      { type: 'day', text: 'Ontem' },
      { type: 'msg', from: 'me', text: 'Eduardo, está na hora da sua reavaliação. Quando consegue passar aqui?', time: '15:10' },
      { type: 'msg', from: 'them', text: 'Pode ser sexta de manhã?', time: '16:02' },
      { type: 'msg', from: 'me', text: 'Fechado, 8h. Traz roupa de treino.', time: '16:05' },
    ] },
  { id: 5, name: 'Larissa Fonseca', online: false, time: 'Seg', unread: 0,
    msgs: [
      { type: 'day', text: 'Segunda' },
      { type: 'msg', from: 'them', text: 'Adorei o resultado da última avaliação! Obrigada 🙏', time: '11:00' },
      { type: 'msg', from: 'me', text: 'Você que se dedicou, Larissa! Bora manter o ritmo 👏', time: '11:12' },
    ] },
  { id: 6, name: 'Marcelo Vieira', online: false, time: 'Seg', unread: 0,
    msgs: [
      { type: 'day', text: 'Segunda' },
      { type: 'msg', from: 'them', text: 'Bati 91kg hoje na balança!', time: '07:30' },
      { type: 'msg', from: 'me', text: 'Excelente, Marcelo! 4kg em 6 semanas. Tá voando 🚀', time: '07:35' },
    ] },
  { id: 7, name: 'Priscila Matos', online: true, time: 'Dom', unread: 0,
    msgs: [
      { type: 'day', text: 'Domingo' },
      { type: 'msg', from: 'them', text: 'Qual o foco da semana que vem?', time: '18:00' },
      { type: 'msg', from: 'me', text: 'Vamos aumentar volume de pernas. Segunda já te mando o ajuste.', time: '18:20' },
    ] },
  { id: 8, name: 'Henrique Alves', online: false, time: 'Sex', unread: 0,
    msgs: [
      { type: 'day', text: 'Sexta' },
      { type: 'msg', from: 'them', text: 'Voltei a treinar essa semana, faltou disciplina antes 😅', time: '12:00' },
      { type: 'msg', from: 'me', text: 'O importante é voltar! Marquei sua reavaliação, bora retomar com tudo.', time: '12:30' },
    ] },
]

const QUICK_REPLIES = ['👍 Perfeito!', 'Pode trocar sim, mesma porção.', 'Vamos ajustar no treino.', 'Manda foto da execução']

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

function now_hhmm() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Mensagens() {
  const navigate = useNavigate()
  const [convs,       setConvs]       = useState<Conv[]>([])
  const [activeId,    setActiveId]    = useState<number | null>(null)
  const [query,       setQuery]       = useState('')
  const [draft,       setDraft]       = useState('')
  const [toast,       setToast]       = useState('')
  const [attachMenu,  setAttachMenu]  = useState(false)
  const [recording,   setRecording]   = useState(false)
  const [recSecs,     setRecSecs]     = useState(0)

  const toastRef     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autoReplyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const threadRef    = useRef<HTMLDivElement>(null)
  const photoRef     = useRef<HTMLInputElement>(null)
  const fileRef      = useRef<HTMLInputElement>(null)
  const recRef       = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const timerRef     = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const cancelRef    = useRef(false)
  const recSecsRef   = useRef(0)

  const active = convs.find(c => c.id === activeId) ?? convs[0] ?? null
  const pal    = active ? AVATAR_PALETTE[active.id % AVATAR_PALETTE.length] : AVATAR_PALETTE[0]

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 1900)
  }

  function scrollBottom() {
    setTimeout(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
    }, 30)
  }

  useEffect(() => { if (active) scrollBottom() }, [active?.msgs.length])

  function openConv(id: number) {
    setConvs(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
    setActiveId(id)
    setAttachMenu(false)
  }

  function send(text?: string) {
    const t = (text ?? draft).trim()
    if (!t) return
    const hh = now_hhmm()
    setConvs(prev => prev.map(c => {
      if (c.id !== activeId) return c
      return { ...c, msgs: [...c.msgs, { type: 'msg', from: 'me', text: t, time: hh }], time: hh }
    }))
    setDraft('')
    clearTimeout(autoReplyRef.current)
    autoReplyRef.current = setTimeout(() => {
      setConvs(prev => prev.map(c => {
        if (c.id !== activeId) return c
        return { ...c, msgs: [...c.msgs, { type: 'msg', from: 'them', text: 'Recebido, professor! 👊', time: hh }] }
      }))
    }, 1100)
  }

  // ── Attachment ────────────────────────────────────────────────────────────────
  function handleFile(kind: AttachKind, file: File) {
    const url = URL.createObjectURL(file)
    const hh  = now_hhmm()
    setConvs(prev => prev.map(c =>
      c.id !== activeId ? c : {
        ...c,
        msgs: [...c.msgs, { type: 'attach', from: 'me', kind, url, name: file.name, size: fmtSize(file.size), time: hh }],
        time: hh,
      }
    ))
    setAttachMenu(false)
  }

  // ── Audio recording ───────────────────────────────────────────────────────────
  async function startRecording() {
    setAttachMenu(false)
    cancelRef.current = false
    recSecsRef.current = 0
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        if (cancelRef.current) {
          setRecording(false); setRecSecs(0); recSecsRef.current = 0; return
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        const hh   = now_hhmm()
        const dur  = fmtDur(recSecsRef.current)
        setConvs(prev => prev.map(c =>
          c.id !== activeId ? c : {
            ...c,
            msgs: [...c.msgs, { type: 'attach', from: 'me', kind: 'audio', url, name: `Áudio ${hh}`, size: dur, time: hh }],
            time: hh,
          }
        ))
        setRecording(false); setRecSecs(0); recSecsRef.current = 0
      }
      recRef.current = mr
      mr.start()
      setRecording(true)
      timerRef.current = setInterval(() => {
        setRecSecs(s => { const n = s + 1; recSecsRef.current = n; return n })
      }, 1000)
    } catch {
      showToast('Permissão de microfone negada.')
    }
  }

  function stopRecording()   { recRef.current?.stop() }
  function cancelRecording() { cancelRef.current = true; recRef.current?.stop() }

  const filtered    = query.trim() ? convs.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase())) : convs
  const totalUnread = convs.reduce((a, c) => a + c.unread, 0)

  if (!active) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C5BFB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p style={{ font: `500 14px ${FF}`, color: '#a89f8e', margin: 0 }}>Nenhuma conversa ainda.</p>
        <p style={{ font: `400 12px ${FF}`, color: '#c5bfb0', margin: 0 }}>As mensagens dos alunos aparecerão aqui.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Hidden file inputs */}
      <input ref={photoRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f.type.startsWith('video') ? 'video' : 'image', f)
          e.target.value = ''
        }} />
      <input ref={fileRef} type="file" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile('file', f)
          e.target.value = ''
        }} />

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Conversations column ── */}
        <div style={{ width: 330, flexShrink: 0, background: '#fff', borderRight: '1px solid #ece7d9', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          <div style={{ padding: '20px 20px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h1 style={{ font: `800 22px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                Mensagens
                {totalUnread > 0 && (
                  <span style={{ background: '#E8542A', color: '#fff', font: `700 10.5px ${FF}`, minWidth: 19, height: 19, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                    {totalUnread}
                  </span>
                )}
              </h1>
              <button
                onClick={() => showToast('Em breve.')}
                aria-label="Nova conversa"
                style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: '#E8542A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                type="text"
                placeholder="Buscar conversa…"
                style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#faf7ee', padding: '0 14px 0 36px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filtered.map(c => {
              const cp = AVATAR_PALETTE[c.id % AVATAR_PALETTE.length]
              const lastMsg = [...c.msgs].reverse().find((m): m is Extract<MsgEntry, { type: 'msg' }> => m.type === 'msg')
              const lastAttach = [...c.msgs].reverse().find((m): m is Extract<MsgEntry, { type: 'attach' }> => m.type === 'attach')
              const preview = lastMsg
                ? (lastMsg.from === 'me' ? 'Você: ' : '') + lastMsg.text
                : lastAttach
                  ? (lastAttach.from === 'me' ? 'Você: ' : '') + (lastAttach.kind === 'image' ? '📷 Foto' : lastAttach.kind === 'video' ? '🎥 Vídeo' : lastAttach.kind === 'audio' ? '🎤 Áudio' : '📎 ' + lastAttach.name)
                  : ''
              const isActive = c.id === activeId
              return (
                <div
                  key={c.id}
                  onClick={() => openConv(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', borderLeft: `3px solid ${isActive ? '#E8542A' : 'transparent'}`, background: isActive ? '#fdf6f2' : 'transparent', transition: 'background .12s' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#faf7ee' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: cp[0], color: cp[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 15px ${FF}` }}>
                      {getInitials(c.name)}
                    </div>
                    {c.online && (
                      <span style={{ position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: '50%', background: '#1B7a4a', border: '2.5px solid #fff' }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ font: `500 11px ${FF}`, color: '#b0a99c', flexShrink: 0 }}>{c.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                      <span style={{ font: `${c.unread > 0 ? '700' : '500'} 12.5px ${FF}`, color: c.unread > 0 ? '#1B2A4A' : '#9a948a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {preview}
                      </span>
                      {c.unread > 0 && (
                        <span style={{ background: '#E8542A', color: '#fff', font: `700 10.5px ${FF}`, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', font: `500 13px ${FF}`, color: '#a89f8e' }}>
                Nenhuma conversa encontrada.
              </div>
            )}
          </div>
        </div>

        {/* ── Thread column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

          {/* Thread header */}
          <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #ece7d9', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 14px ${FF}` }}>
                {getInitials(active.name)}
              </div>
              {active.online && (
                <span style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: '50%', background: '#1B7a4a', border: '2.5px solid #fff' }} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: `800 15.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active.name}</div>
              <div style={{ font: `500 11.5px ${FF}`, color: active.online ? '#1B7a4a' : '#b0a99c' }}>
                {active.online ? 'online agora' : 'visto por último hoje'}
              </div>
            </div>
            <button
              onClick={() => navigate(`/coach/alunos/${active.id}`)}
              style={{ textDecoration: 'none', font: `700 12.5px ${FF}`, color: '#E8542A', display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdf3ee'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              Ver perfil
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {/* Messages area */}
          <div
            ref={threadRef}
            style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, backgroundImage: 'radial-gradient(#e9e2d1 1px,transparent 1px)', backgroundSize: '22px 22px' }}
          >
            {active.msgs.map((m, i) => {
              if (m.type === 'day') {
                return (
                  <div key={i} style={{ alignSelf: 'center', background: '#e7e0ce', color: '#7c7869', font: `600 11px ${FF}`, padding: '4px 12px', borderRadius: 20, margin: '10px 0' }}>
                    {m.text}
                  </div>
                )
              }

              const me = m.from === 'me'

              if (m.type === 'attach') {
                return (
                  <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '72%', display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                    <div style={{ borderRadius: me ? '14px 14px 4px 14px' : '14px 14px 14px 4px', overflow: 'hidden', background: me ? '#E8542A' : '#fff', boxShadow: '0 1px 3px rgba(27,42,74,.1)' }}>

                      {m.kind === 'image' && (
                        <img src={m.url} alt={m.name}
                          style={{ display: 'block', maxWidth: '100%', maxHeight: 280, objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => window.open(m.url, '_blank')}
                        />
                      )}

                      {m.kind === 'video' && (
                        <video src={m.url} controls style={{ display: 'block', maxWidth: '100%', maxHeight: 280 }} />
                      )}

                      {m.kind === 'audio' && (
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: me ? 'rgba(255,255,255,.2)' : '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={me ? '#fff' : '#1B2A4A'} strokeWidth="2.2" strokeLinecap="round">
                                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <path d="M12 19v3" />
                              </svg>
                            </div>
                            <div>
                              <div style={{ font: `700 12.5px ${FF}`, color: me ? '#fff' : '#1B2A4A' }}>Mensagem de voz</div>
                              <div style={{ font: `500 11px ${FF}`, color: me ? 'rgba(255,255,255,.7)' : '#9a948a' }}>{m.size}</div>
                            </div>
                          </div>
                          <audio src={m.url} controls style={{ width: '100%', height: 32, display: 'block' }} />
                        </div>
                      )}

                      {m.kind === 'file' && (
                        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: me ? 'rgba(255,255,255,.2)' : '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={me ? '#fff' : '#1B2A4A'} strokeWidth="2" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <path d="M14 2v6h6" />
                            </svg>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ font: `700 12.5px ${FF}`, color: me ? '#fff' : '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                            <div style={{ font: `500 11px ${FF}`, color: me ? 'rgba(255,255,255,.7)' : '#9a948a', marginTop: 2 }}>{m.size}</div>
                          </div>
                          <a href={m.url} download={m.name} style={{ color: me ? '#fff' : '#E8542A', display: 'flex', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <path d="M7 10l5 5 5-5" />
                              <path d="M12 15V3" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                    <span style={{ font: `500 10px ${FF}`, color: '#b0a99c', marginTop: 3, alignSelf: me ? 'flex-end' : 'flex-start' }}>{m.time}</span>
                  </div>
                )
              }

              // type === 'msg'
              return (
                <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '74%', display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                  <div style={{ background: me ? '#E8542A' : '#fff', color: me ? '#fff' : '#1B2A4A', font: `400 13.5px/1.5 ${FF}`, padding: '10px 14px', borderRadius: me ? '14px 14px 4px 14px' : '14px 14px 14px 4px', boxShadow: '0 1px 2px rgba(27,42,74,.08)', whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                  <span style={{ font: `500 10px ${FF}`, color: '#b0a99c', marginTop: 3, alignSelf: me ? 'flex-end' : 'flex-start' }}>{m.time}</span>
                </div>
              )
            })}
          </div>

          {/* Quick replies */}
          {activeId === 1 && (
            <div style={{ flexShrink: 0, padding: '10px 22px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {QUICK_REPLIES.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{ border: '1.5px solid #e0d9c8', background: '#fff', color: '#6b6657', font: `600 12px ${FF}`, borderRadius: 18, padding: '7px 13px', cursor: 'pointer' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#E8542A'; el.style.color = '#E8542A' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e0d9c8'; el.style.color = '#6b6657' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div style={{ flexShrink: 0, padding: '14px 22px 18px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>

            {/* Attach button + popup */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {attachMenu && (
                <>
                  <div onClick={() => setAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, boxShadow: '0 8px 28px rgba(27,42,74,.18)', overflow: 'hidden', zIndex: 50, minWidth: 196 }}>
                    {([
                      {
                        label: 'Foto ou vídeo',
                        icon: (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        ),
                        action: () => photoRef.current?.click(),
                      },
                      {
                        label: 'Arquivo',
                        icon: (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                        ),
                        action: () => fileRef.current?.click(),
                      },
                      {
                        label: 'Gravar áudio',
                        icon: (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <path d="M12 19v3" />
                          </svg>
                        ),
                        action: startRecording,
                      },
                    ] as const).map((item, idx, arr) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', border: 'none', background: 'none', padding: '12px 16px', cursor: 'pointer', font: `600 13px ${FF}`, color: '#1B2A4A', borderBottom: idx < arr.length - 1 ? '1px solid #f4efe3' : 'none', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf7ee'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => setAttachMenu(v => !v)}
                aria-label="Anexar"
                style={{ width: 42, height: 42, borderRadius: 11, border: `1.5px solid ${attachMenu ? '#E8542A' : '#e0d9c8'}`, background: attachMenu ? '#fdf3ee' : '#fff', color: attachMenu ? '#E8542A' : '#9a948a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onMouseEnter={e => { if (!attachMenu) { (e.currentTarget as HTMLElement).style.borderColor = '#E8542A'; (e.currentTarget as HTMLElement).style.color = '#E8542A' } }}
                onMouseLeave={e => { if (!attachMenu) { (e.currentTarget as HTMLElement).style.borderColor = '#e0d9c8'; (e.currentTarget as HTMLElement).style.color = '#9a948a' } }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.4 11.05l-8.5 8.5a5 5 0 0 1-7.07-7.07l8.49-8.49a3.34 3.34 0 0 1 4.71 4.72l-8.5 8.49a1.67 1.67 0 0 1-2.36-2.36l7.78-7.78" />
                </svg>
              </button>
            </div>

            {/* Input / Recording UI */}
            {recording ? (
              <>
                <div style={{ flex: 1, height: 46, border: '1.5px solid #c4421e', borderRadius: 23, background: '#fff5f3', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#c4421e', flexShrink: 0 }} />
                  <span style={{ font: `800 15px ${FF}`, color: '#c4421e', minWidth: 38 }}>{fmtDur(recSecs)}</span>
                  <span style={{ font: `400 13px ${FF}`, color: '#9a948a', flex: 1 }}>Gravando áudio…</span>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', font: `600 12px ${FF}`, color: '#9a948a', padding: '4px 8px', borderRadius: 6 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c4421e'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9a948a'}
                  >
                    Cancelar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  aria-label="Enviar áudio"
                  style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: '#c4421e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 0 #9e2e12', flexShrink: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                  type="text"
                  placeholder="Escreva uma mensagem…"
                  style={{ flex: 1, height: 46, border: '1.5px solid #e0d9c8', borderRadius: 23, background: '#fff', padding: '0 18px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none' }}
                />
                <button
                  onClick={() => send()}
                  aria-label="Enviar"
                  style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: '#E8542A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 0 #c4421e', flexShrink: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  )
}
