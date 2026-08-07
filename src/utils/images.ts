/**
 * Las imágenes subidas se guardan como ruta relativa al host del API
 * (`/storage/...`), para que la misma URL sirva desde la web y desde un
 * celular en la red local. Las URLs externas pegadas a mano se dejan igual.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api'

/** Origen del API sin el sufijo /api */
export const apiOrigin = (): string => API_BASE.replace(/\/api\/?$/, '')

export const resolveImageUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
  return apiOrigin() + url
}
