import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface TextMsg {
  type: 'text'
  from: 'coach' | 'aluno'
  text: string
  time: string
}

export interface FileMsg {
  type: 'file'
  from: 'coach' | 'aluno'
  filename: string
  dataUri: string
  size: string
  time: string
}

export type Msg = TextMsg | FileMsg

interface DbRow { from_role: string; text: string; created_at: string }

function rowToMsg(row: DbRow): TextMsg {
  const d = new Date(row.created_at)
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  return { type: 'text', from: row.from_role === 'coach' ? 'coach' : 'aluno', text: row.text, time }
}

interface ChatStore {
  messages:   Msg[]
  loading:    boolean
  studentId:  number | null
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
      .select('from_role, text, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
    set({ messages: ((data as DbRow[] | null) ?? []).map(rowToMsg), studentId, loading: false })
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
    set(s => ({ messages: [...s.messages, rowToMsg(row)] }))
  },
}))
