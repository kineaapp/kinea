import { useState, useCallback } from 'react'

const DISMISSED_KEY = 'kinea-notif-dismissed'

const DEMO_EVENTS = [
  {
    title: 'Mensagem de Tatiane Ribeiro',
    body: 'Coach, posso mudar o horário do treino de amanhã?',
    tag: 'msg-demo',
  },
  {
    title: 'Pagamento vencido',
    body: 'Rafael Antunes tem uma parcela de R$ 180,00 em atraso.',
    tag: 'payment-demo',
  },
  {
    title: 'Reavaliação pendente',
    body: 'Beatriz Camargo está há 32 dias sem avaliação física.',
    tag: 'assessment-demo',
  },
  {
    title: 'Check-in semanal recebido',
    body: 'Eduardo Nunes enviou o check-in desta semana.',
    tag: 'checkin-demo',
  },
]

function supported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notify(title: string, body: string, tag?: string) {
  if (!supported() || Notification.permission !== 'granted') return
  new Notification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' })
}

export function useNotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (supported() ? Notification.permission : 'denied')
  )
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === '1'
  )

  const requestPermission = useCallback(async () => {
    if (!supported()) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      DEMO_EVENTS.forEach((ev, i) => {
        setTimeout(() => {
          new Notification(ev.title, {
            body: ev.body,
            tag: ev.tag,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          })
        }, i * 1400)
      })
    }
  }, [])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }, [])

  const showBanner =
    supported() && permission === 'default' && !dismissed

  return { permission, showBanner, requestPermission, dismiss }
}
