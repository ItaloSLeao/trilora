import { useAction, useRemote } from './remote'
import { useState } from 'react'
export function PushControl() {
  const { call } = useRemote(),
    { run, error, busy } = useAction(),
    [message, say] = useState('')
  async function enable() {
    if (
      !window.isSecureContext ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    )
      throw Error('Web Push requer origem segura e navegador compatível.')
    const { key } = await call<{ key: string }>('push')
    if (!key) throw Error('Web Push não configurado pelo administrador.')
    if ((await Notification.requestPermission()) !== 'granted')
      throw Error('Permissão de notificações não concedida.')
    await navigator.serviceWorker.register(
      import.meta.env.BASE_URL + 'atlas-push.js',
    )
    const reg = await navigator.serviceWorker.ready
    const bytes = Uint8Array.from(
      atob(key.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    )
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }))
    const json = sub.toJSON()
    await call('push', 'POST', { endpoint: json.endpoint, keys: json.keys })
    say('Notificações deste dispositivo ativadas.')
  }
  return (
    <div>
      <p>
        Web Push usa o serviço de entrega do navegador para um aviso genérico,
        inclusive com a aba fechada.
      </p>
      <button
        type="button"
        disabled={busy}
        className="secondary"
        onClick={() => run(enable)}
      >
        Autorizar Web Push
      </button>
      <button
        type="button"
        onClick={() =>
          run(async () => {
            await call('push', 'DELETE')
            say('Entregas push desativadas em todos os dispositivos da conta.')
          })
        }
      >
        Desativar entregas push
      </button>
      <p role="status">{error || message}</p>
    </div>
  )
}
