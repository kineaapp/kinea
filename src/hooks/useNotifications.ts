import { useState, useCallback } from 'react'

const DISMISSED_KEY = 'kinea-notif-dismissed'


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
  }, [])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }, [])

  const showBanner =
    supported() && permission === 'default' && !dismissed

  return { permission, showBanner, requestPermission, dismiss }
}
