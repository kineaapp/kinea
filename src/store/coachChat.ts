import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type AttachKind = 'image' | 'video' | 'audio' | 'file'

export type MsgEntry =
  | { type: 'day';    text: string }
  | { type: 'msg';    from: 'me' | 'them'; text: string; time: string }
  | { type: 'attach'; from: 'me' | 'them'; kind: AttachKind; url: string; name: string; size: string; time: string }

export const SEED_MSGS: MsgEntry[] = []

interface DbRow { from_role: string; text: string; created_at: string }

function rowsToEntries(rows: DbRow[]): MsgEntry[] {
  const result: MsgEntry[] = []
  let lastDay = ''
  for (const row of rows) {
    const d = new Date(row.created_at)
    const dayStr = d.toLocaleDateString('pt-BR')
    if (dayStr !== lastDay) {
      const today     = new Date().toLocaleDateString('pt-BR')
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR')
      result.push({ type: 'day', text: dayStr === today ? 'Hoje' : dayStr === yesterday ? 'Ontem' : dayStr })
      lastDay = dayStr
    }
    const hh = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    result.push({ type: 'msg', from: row.from_role === 'coach' ? 'me' : 'them', text: row.text, time: hh })
  }
  return result
}

interface CoachChatStore {
  msgs:    Record<number, MsgEntry[]>
  unread:  Record<number, number>
  loading: Record<number, boolean>
  fetchMessages: (studentId: number) => Promise<void>
  sendMessage:   (studentId: number, text: string) => Promise<void>
  addMsg:        (studentId: number, msg: MsgEntry) => void
  markRead:      (studentId: number) => void
  seedStudent:   (_studentId: number, _messages: MsgEntry[]) => void
  addIncoming:   (studentId: number, row: DbRow) => void
}

export const useCoachChatStore = create<CoachChatStore>((set, get) => ({
  msgs:    {},
  unread:  {},
  loading: {},

  fetchMessages: async (studentId) => {
    if (get().loading[studentId] || studentId in get().msgs) return
    set(s => ({ loading: { ...s.loading, [studentId]: true } }))
    const { data } = await supabase
      .from('chat_messages')
      .select('from_role, text, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
    const entries = rowsToEntries((data as DbRow[] | null) ?? [])
    set(s => ({
      msgs:    { ...s.msgs,    [studentId]: entries },
      loading: { ...s.loading, [studentId]: false  },
    }))
  },

  sendMessage: async (studentId, text) => {
    const now = new Date()
    const hh  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    set(s => ({
      msgs: { ...s.msgs, [studentId]: [...(s.msgs[studentId] ?? []), { type: 'msg', from: 'me', text, time: hh }] },
    }))
    await supabase.from('chat_messages').insert({ student_id: studentId, from_role: 'coach', text })
  },

  addMsg: (studentId, msg) => set(s => ({
    msgs:   { ...s.msgs, [studentId]: [...(s.msgs[studentId] ?? []), msg] },
    unread: msg.type === 'msg' && msg.from === 'them'
      ? { ...s.unread, [studentId]: (s.unread[studentId] ?? 0) + 1 }
      : s.unread,
  })),

  markRead: (studentId) => set(s => ({ unread: { ...s.unread, [studentId]: 0 } })),

  seedStudent: () => {},

  addIncoming: (studentId, row) => {
    const d  = new Date(row.created_at)
    const hh = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    set(s => ({
      msgs:   { ...s.msgs,   [studentId]: [...(s.msgs[studentId] ?? []), { type: 'msg', from: 'them', text: row.text, time: hh }] },
      unread: { ...s.unread, [studentId]: (s.unread[studentId] ?? 0) + 1 },
    }))
  },
}))
