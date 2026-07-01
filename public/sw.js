self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Kinea', {
      body: data.body ?? '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag ?? 'kinea',
      data: { url: data.url ?? '/aluno/home' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/aluno'))
      if (existing) return existing.focus()
      return clients.openWindow(e.notification.data?.url ?? '/aluno/home')
    })
  )
})
