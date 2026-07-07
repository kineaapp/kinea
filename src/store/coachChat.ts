import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AttachKind = 'image' | 'video' | 'audio' | 'file'

export type MsgEntry =
  | { type: 'day';    text: string }
  | { type: 'msg';    from: 'me' | 'them'; text: string; time: string }
  | { type: 'attach'; from: 'me' | 'them'; kind: AttachKind; url: string; name: string; size: string; time: string }

export const SEED_MSGS: MsgEntry[] = [
  { type: 'day',  text: 'Ontem' },
  { type: 'msg',  from: 'them', text: 'Boa noite coach! Posso trocar o frango do jantar por atum?', time: '20:07' },
  { type: 'msg',  from: 'me',   text: 'Pode trocar sim, mesma porção.', time: '20:11' },
  { type: 'msg',  from: 'them', text: 'Ótimo! Obrigada 😊', time: '20:13' },
  { type: 'day',  text: 'Hoje' },
  { type: 'msg',  from: 'them', text: 'Coach, e o treino de hoje? Posso adiantar pra manhã?', time: '08:42' },
]

interface CoachChatStore {
  msgs:        Record<number, MsgEntry[]>
  unread:      Record<number, number>
  addMsg:      (studentId: number, msg: MsgEntry) => void
  markRead:    (studentId: number) => void
  seedStudent: (studentId: number, messages: MsgEntry[]) => void
}

export const useCoachChatStore = create<CoachChatStore>()(
  persist(
    (set) => ({
      msgs:   {},
      unread: {},

      addMsg: (studentId, msg) => set(s => {
        const extra = msg.type === 'msg' && msg.from === 'them' ? 1 : 0
        return {
          msgs:   { ...s.msgs,   [studentId]: [...(s.msgs[studentId] ?? []), msg] },
          unread: { ...s.unread, [studentId]: (s.unread[studentId] ?? 0) + extra },
        }
      }),

      markRead: (studentId) => set(s => ({
        unread: { ...s.unread, [studentId]: 0 },
      })),

      seedStudent: (studentId, messages) => set(s => {
        if (s.msgs[studentId] !== undefined) return s
        return {
          msgs:   { ...s.msgs,   [studentId]: messages },
          unread: { ...s.unread, [studentId]: 1 },
        }
      }),
    }),
    { name: 'kinea-coach-chat' }
  )
)
