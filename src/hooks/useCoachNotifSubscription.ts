import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useStudentsStore } from '../store/students'
import { useCoachChatStore } from '../store/coachChat'
import { useCoachNotificationsStore } from '../store/coachNotifications'
import { notify } from './useNotifications'
import { useAuthStore } from '../store/auth'

export function useCoachNotifSubscription() {
  const { user } = useAuthStore()
  const { students } = useStudentsStore()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!user?.id || students.length === 0) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const studentMap = new Map(students.map(s => [s.id, s.name]))

    const channel = supabase
      .channel('coach-global-notif')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const row = payload.new as {
            student_id: number; from_role: string; text: string | null
            created_at: string; attachment_url?: string | null
            attachment_name?: string | null; attachment_size?: number | null
            attachment_kind?: string | null
          }
          if (row.from_role !== 'student') return

          const studentName = studentMap.get(row.student_id)
          if (!studentName) return

          const { activeStudentId, addIncoming } = useCoachChatStore.getState()

          // Skip addIncoming for the active student — Mensagens.tsx handles it
          // via its own per-student subscription to avoid duplicate messages.
          if (row.student_id !== activeStudentId) {
            addIncoming(row.student_id, row)
          }

          // Always show in-app toast (unless viewing that conversation)
          if (row.student_id !== activeStudentId) {
            useCoachNotificationsStore.getState().showToast({
              kind: 'msg',
              studentName,
              studentId: row.student_id,
            })
          }

          notify('Nova mensagem', `${studentName} enviou uma mensagem`)
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'assessments' },
        (payload) => {
          const row = payload.new as { student_id: number }
          const studentName = studentMap.get(row.student_id)
          if (!studentName) return

          useCoachNotificationsStore.getState().incrementAssessments()
          useCoachNotificationsStore.getState().showToast({
            kind: 'eval',
            studentName,
            studentId: row.student_id,
          })
          notify('Nova avaliação', `${studentName} registrou uma avaliação`)
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user?.id, students.length])
}
