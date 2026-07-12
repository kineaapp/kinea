import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type AttachKind = 'image' | 'video' | 'audio' | 'file'

export type MsgEntry =
  | { type: 'text';   from: 'coach' | 'aluno'; text: string; time: string }
  | { type: 'attach'; from: 'coach' | 'aluno'; kind: AttachKind; url: string; name: string; size: string; time: string }

interface DbRow {
  from_role: string; text: string | null; created_at: string
  attachment_url?: string | null; attachment_name?: string | null
  attachment_size?: number | null; attachment_kind?: string | null
}

function fmtBytes(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

function rowsToEntries(rows: DbRow[]): MsgEntry[] {
  return rows.map(row => {
    const d = new Date(row.created_at)
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    const from: 'coach' | 'aluno' = row.from_role === 'coach' ? 'coach' : 'aluno'
    if (row.attachment_url && row.attachment_name) {
      return {
        type: 'attach' as const, from, kind: (row.attachment_kind ?? 'file') as AttachKind,
        url: row.attachment_url, name: row.attachment_name,
        size: row.attachment_size != null ? fmtBytes(row.attachment_size) : '',
        time,
      }
    }
    return { type: 'text' as const, from, text: row.text ?? '', time }
  })
}

interface ChatStore {
  messages:  MsgEntry[]
  loading:   boolean
  studentId: number | null
  fetchMessages: (studentUuid: string) => Promise<void>
  sendMessage:   (text: string) => Promise<void>
  addIncoming:   (row: DbRow) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages:  [],
  loading:   false,
  studentId: null,

  fetchMessages: async (studentUuid) => {
    if (get().studentId !== null) return
    set({ loading: true })
    const { data: row } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', studentUuid)
      .single()
    if (!row) { set({ loading: false }); return }
    const studentId = (row as { id: number }).id
    const { data } = await supabase
      .from('chat_messages')
      .select('from_role, text, created_at, attachment_url, attachment_name, attachment_size, attachment_kind')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
    set({ messages: rowsToEntries((data as DbRow[] | null) ?? []), studentId, loading: false })
  },

  sendMessage: async (text) => {
    const studentId = get().studentId
    if (!studentId) return
    const now  = new Date()
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    set(s => ({ messages: [...s.messages, { type: 'text', from: 'aluno', text, time }] }))
    await supabase.from('chat_messages').insert({ student_id: studentId, from_role: 'student', text })
  },

  addIncoming: (row) => {
    const entries = rowsToEntries([row])
    const entry = entries[0]
    if (entry) set(s => ({ messages: [...s.messages, entry] }))
  },
}))
