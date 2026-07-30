import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../../store/chat'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import type { MsgEntry } from '../../store/chat'

function AttachBubble({ msg }: { msg: Extract<MsgEntry, { type: 'attach' }> }) {
  const { t } = useTranslation()
  const isAluno = msg.from === 'aluno'
  const bg = isAluno ? '#1B2A4A' : '#fff'
  const radius = isAluno ? '16px 16px 4px 16px' : '16px 16px 16px 4px'

  return (
    <div style={{ display: 'flex', justifyContent: isAluno ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%' }}>
        <div style={{ background: bg, borderRadius: radius, overflow: 'hidden', boxShadow: isAluno ? 'none' : '0 2px 8px rgba(27,42,74,.07)' }}>

          {msg.kind === 'image' && (
            <img src={msg.url} alt={msg.name}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'cover', cursor: 'pointer' }}
              onClick={() => window.open(msg.url, '_blank')}
            />
          )}

          {msg.kind === 'audio' && (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ font: `700 12px "Libre Franklin",sans-serif`, color: isAluno ? '#FAEEDA' : '#1B2A4A', marginBottom: 6 }}>{t('chat.voice_message', { size: msg.size })}</div>
              <audio src={msg.url} controls style={{ width: '100%', height: 32, display: 'block' }} />
            </div>
          )}

          {(msg.kind === 'file' || msg.kind === 'video') && (
            <a href={msg.url} target="_blank" rel="noreferrer" download={msg.name}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textDecoration: 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: isAluno ? 'rgba(255,255,255,.15)' : '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isAluno ? '#FAEEDA' : '#1B2A4A'} strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 12.5px "Libre Franklin",sans-serif`, color: isAluno ? '#FAEEDA' : '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.name}</div>
                {msg.size && <div style={{ font: `400 11px "Libre Franklin",sans-serif`, color: isAluno ? '#8B97AD' : '#A39E90', marginTop: 2 }}>{msg.size}</div>}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isAluno ? '#8B97AD' : '#A39E90'} strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
            </a>
          )}
        </div>
        <div style={{ font: `400 10px "Libre Franklin",sans-serif`, color: '#C5BFB0', marginTop: 4, textAlign: isAluno ? 'right' : 'left', padding: '0 4px' }}>
          {msg.time}
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const { t } = useTranslation()
  const { messages, loading, studentId, fetchMessages, sendMessage, addIncoming } = useChatStore()
  const { user } = useAuthStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.id) fetchMessages(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!studentId) return
    const channel = supabase
      .channel('student-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `student_id=eq.${studentId}` }, (payload) => {
        const row = payload.new as { from_role: string; text: string | null; created_at: string; attachment_url?: string | null; attachment_name?: string | null; attachment_size?: number | null; attachment_kind?: string | null }
        if (row.from_role === 'coach') addIncoming(row)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [studentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function send() {
    const text = input.trim()
    if (!text) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px)' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8DC', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1B2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}>{t('chat.your_coach')}</div>
          <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{t('chat.direct_chat')}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && messages.length === 0 && (
          <div style={{ alignSelf: 'center', marginTop: 40, font: `500 13px "Libre Franklin",sans-serif`, color: '#a89f8e' }}>
            {t('chat.loading')}
          </div>
        )}
        {messages.map((m, i) => {
          if (m.type === 'attach') return <AttachBubble key={i} msg={m} />

          const isAluno = m.from === 'aluno'
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isAluno ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%' }}>
                <div style={{
                  background: isAluno ? '#1B2A4A' : '#fff',
                  borderRadius: isAluno ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '12px 14px',
                  boxShadow: isAluno ? 'none' : '0 2px 8px rgba(27,42,74,.07)',
                  font: `400 13.5px "Libre Franklin",sans-serif`,
                  color: isAluno ? '#FAEEDA' : '#1B2A4A',
                  lineHeight: 1.5,
                }}>
                  {m.text}
                </div>
                <div style={{ font: `400 10px "Libre Franklin",sans-serif`, color: '#C5BFB0', marginTop: 4, textAlign: isAluno ? 'right' : 'left', padding: '0 4px' }}>
                  {m.time}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ background: '#fff', borderTop: '1px solid #EDE8DC', padding: '12px 18px 16px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={t('chat.input_placeholder')}
          style={{ flex: 1, background: '#F4EFE3', borderRadius: 22, padding: '11px 16px', border: 'none', outline: 'none', font: `400 14px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}
        />
        <button
          onClick={send}
          style={{ width: 40, height: 40, borderRadius: '50%', background: '#E8542A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Send size={16} color="#fff" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
