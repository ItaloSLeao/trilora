self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Trilora Atlas', {body:'Há uma atualização na central de acompanhamento.',tag:'atlas-monitor'}))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow(new URL('./#inteligencia',self.registration.scope).href))
})
