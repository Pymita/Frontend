import { onMounted, onUnmounted } from 'vue'
import api from '@/services/api'

interface ChangesResponse {
  data: { version: string; latest_id: number; orders_count: number }
}

/**
 * Live refresh without websockets: asks the backend for a cheap change
 * marker every few seconds and calls `onChange` only when it moved. Pauses
 * while the tab is hidden and checks again the moment it comes back.
 *
 * The waiter app creates and edits orders on the same backend; this is
 * how the cashier's screen picks them up within seconds.
 */
export function useLiveRefresh(
  onChange: (info: { newOrders: number }) => void,
  intervalMs = 4000,
) {
  let version: string | null = null
  let ordersCount: number | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let checking = false

  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return
    checking = true
    try {
      const response = await api.get<ChangesResponse>('/orders/changes')
      const next = response.data.data
      const first = version === null
      const moved = next.version !== version
      const previousCount = ordersCount
      version = next.version
      ordersCount = next.orders_count
      if (!first && moved) {
        // Ids are shared by every company: only the company's own count says how many arrived.
        onChange({ newOrders: Math.max(0, next.orders_count - (previousCount ?? next.orders_count)) })
      }
    } catch {
      // Sin red o backend caído: se vuelve a intentar en el siguiente ciclo.
    } finally {
      checking = false
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }

  onMounted(() => {
    check()
    timer = setInterval(check, intervalMs)
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { check }
}
