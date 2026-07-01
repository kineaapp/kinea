import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

const INITIAL: Msg[] = [
  { type: 'text', from: 'coach', text: 'Bom dia! Como você se sentiu no treino de ontem?', time: '09:15' },
  { type: 'text', from: 'aluno', text: 'Ótimo! As pernas ainda estão doendo mas foi um treino incrível 💪', time: '09:22' },
  { type: 'text', from: 'coach', text: 'Ótimo sinal! Isso é DOMS — músculo crescendo. Para hoje o foco é peito e tríceps. Capricha no supino!', time: '09:25' },
  { type: 'text', from: 'aluno', text: 'Entendido! Vou lá às 18h', time: '09:30' },
  { type: 'text', from: 'coach', text: 'Perfeito. Lembre de caprichar na contração no crucifixo. Qualquer dúvida me chama!', time: '14:32' },
]

interface ChatStore {
  messages: Msg[]
  addMessage: (msg: Msg) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: INITIAL,
      addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
    }),
    { name: 'kinea-chat' }
  )
)
