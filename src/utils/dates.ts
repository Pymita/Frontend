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

/** "2025-01" → "enero de 2025". */
export const formatIsoMonth = (iso: string): string => {
  const [year, month] = iso.split('-').map(Number)
  const name = MONTHS[(month || 0) - 1]
  return name && year ? `${name} de ${year}` : iso
}
