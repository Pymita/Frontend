/**
 * Fechas de la app: el API y los formularios usan texto ISO (AAAA-MM-DD, o
 * AAAA-MM para un período) y la pantalla siempre las muestra en español,
 * sin depender del idioma del navegador.
 */

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const pad = (value: number): string => String(value).padStart(2, '0')

/** Fecha local (no UTC) como AAAA-MM-DD. */
export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const todayIso = (): string => toIsoDate(new Date())

/** Local time as 24-hour HH:MM. */
export const toTimeText = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/**
 * "8:00", "08:00", "23:30" or "11:30 p. m." → 24-hour "HH:MM"; null when it
 * is not a time. A native time input follows the browser's language, the same
 * reason `DateField` exists.
 */
export const parseTimeText = (text: string): string | null => {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$/)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  const meridiem = match[3]
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0)
  }
  if (hours > 23 || minutes > 59) return null
  return `${pad(hours)}:${pad(minutes)}`
}

const isRealDate = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2999) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** "29/09/2026" (o ISO ya escrito) → "2026-09-29"; null si no es una fecha real. */
export const parseDateText = (text: string): string | null => {
  const value = text.trim()
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const local = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local
      ? [Number(local[3]), Number(local[2]), Number(local[1])]
      : [NaN, NaN, NaN]
  if (!isRealDate(year, month, day)) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const plain = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "enero de 2025", "ene 2025", "01/2025" o "2025-01" → "2025-01". */
export const parseMonthText = (text: string): string | null => {
  const value = plain(text.trim())
  const iso = value.match(/^(\d{4})-(\d{1,2})$/)
  const numeric = value.match(/^(\d{1,2})[/.-](\d{4})$/)
  const named = value.match(/^([a-z]+)\.?\s+(?:de\s+)?(\d{4})$/)

  let year = NaN
  let month = NaN
  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
  } else if (numeric) {
    year = Number(numeric[2])
    month = Number(numeric[1])
  } else if (named?.[1] && named[1].length >= 3) {
    const prefix = named[1]
    year = Number(named[2])
    month = MONTHS.findIndex(name => plain(name).startsWith(prefix)) + 1
  }
  if (!isRealDate(year, month, 1)) return null
  return `${year}-${pad(month)}`
}

/** "2026-09-29" → "29/09/2026" (lo que se escribe en un campo de fecha). */
export const formatIsoDate = (iso: string): string => {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : iso
}

/**
 * "05 de oct de 2026" para una fecha de calendario (vencimiento, fecha del
 * gasto). Solo cuenta AAAA-MM-DD: el API la manda como medianoche en UTC y
 * convertirla a la hora local podría mostrar el día anterior.
 */
export const formatDay = (value: string | null | undefined): string => {
  if (!value) return '—'
  const [year = 0, month = 1, day = 1] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** El día (hora local) de un instante: último ingreso, fecha de creación. */
export const formatMomentDay = (value: string | null | undefined): string => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "05 oct, 14:30": un instante con su hora (cobros, movimientos, cierres). */
export const formatDateTime = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

/** "05/10/2026, 02:30 p. m.": an instant with its year, for printed documents. */
export const formatFullDateTime = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

/** "14:30". */
export const formatTime = (value: string): string =>
  new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

/** Hoy solo la hora; otro día, "28/09 14:30". */
export const formatRecent = (value: string): string => {
  const date = new Date(value)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = formatTime(value)
  if (date.getTime() >= startOfToday) return time
  return `${date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })} ${time}`
}

/** "2025-01" → "enero de 2025". */
export const formatIsoMonth = (iso: string): string => {
  const [year, month] = iso.split('-').map(Number)
  const name = MONTHS[(month || 0) - 1]
  return name && year ? `${name} de ${year}` : iso
}
