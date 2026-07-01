import { useState, useCallback } from 'react'

export type NotifCategory = 'mensagens' | 'pagamentos' | 'avaliacoes' | 'checkins'

const STORAGE_KEY = 'kinea-aluno-notif-prefs'

const DEMO: Record<NotifCategory, { title: string; body: string; tag: string }> = {
  mensagens:  { title: 'Mensagem do Coach', body: 'Ótimo treino hoje! Lembre de caprichar na contração do peitoral.', tag: 'kinea-msg' },
  pagamentos: { title: 'Pagamento próximo', body: 'Sua mensalidade de R$ 180,00 vence em 3 dias.', tag: 'kinea-pay' },
  avaliacoes: { title: 'Avaliação pendente', body: 'Você está há 32 dias sem avaliação física. Agende com seu coach!', tag: 'kinea-aval' },
  checkins:   { title: 'Check-in semanal', body: 'Não esqueça de enviar seu check-in desta semana para o coach.', tag: 'kinea-checkin' },
}

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

async function sendDemoNotif(category: NotifCategory) {
  const demo = DEMO[category]
  const opts: NotificationOptions = { body: demo.body, tag: demo.tag, icon: '/favicon.svg', badge: '/favicon.svg', data: { url: '/aluno/home' } }
  try {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification(demo.title, opts)
  } catch {
    new Notification(demo.title, opts)
  }
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
      if (next[cat]) sendDemoNotif(cat)
      return next
    })
  }, [permission])

  return { permission, isSupported, needsInstall, requesting, prefs, requestPermission, toggleCategory }
}
