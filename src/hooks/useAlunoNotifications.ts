import { useState, useCallback } from 'react'

export type NotifCategory = 'mensagens' | 'pagamentos' | 'avaliacoes' | 'checkins'

const STORAGE_KEY = 'kinea-aluno-notif-prefs'


function loadPrefs(): Record<NotifCategory, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {} as Record<NotifCategory, boolean>
  }
}

function savePrefs(prefs: Record<NotifCategory, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}


export function useAlunoNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<NotificationPermission>(
    () => (isSupported ? Notification.permission : 'denied')
  )
  const [prefs, setPrefs] = useState<Record<NotifCategory, boolean>>(loadPrefs)
  const [requesting, setRequesting] = useState(false)

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone
  const needsInstall = isIOS && !isStandalone

  const requestPermission = useCallback(async () => {
    if (!isSupported || requesting) return
    setRequesting(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } finally {
      setRequesting(false)
    }
  }, [isSupported, requesting])

  const toggleCategory = useCallback(async (cat: NotifCategory) => {
    if (permission !== 'granted') return
    setPrefs(prev => {
      const next = { ...prev, [cat]: !prev[cat] }
      savePrefs(next)
      return next
    })
  }, [permission])

  return { permission, isSupported, needsInstall, requesting, prefs, requestPermission, toggleCategory }
}
