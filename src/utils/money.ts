/**
 * Pesos colombianos en toda la web: separador de miles con punto y el signo
 * antes del peso ("-$12.500", no "$-12.500").
 */
const format = (value: number | string | null | undefined, maximumFractionDigits: number): string => {
  const amount = Number(value)
  const safe = Number.isFinite(amount) ? amount : 0
  const text = Math.abs(safe).toLocaleString('es-CO', { maximumFractionDigits })
  return `${safe < 0 ? '-' : ''}$${text}`
}

/** Precios, totales y saldos: sin centavos ("$12.500"). */
export const money = (value: number | string | null | undefined): string => format(value, 0)

/** Costos unitarios, que pueden llevar centavos ("$3,45" el gramo). */
export const preciseMoney = (value: number | string | null | undefined): string => format(value, 2)

/** Un valor dentro de un campo de pesos: con puntos de miles y sin el signo ("250.000"). */
export const moneyInput = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? ''
    : Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 })

/**
 * Lo que alguien escribe como pesos: "250.000", "$ 250.000", "250000" o
 * "12.500,50". Null si no es una cifra. Mismas reglas que el backend al leer
 * un Excel (SimpleXlsxReader::number): el separador seguido de exactamente
 * tres cifras es el de miles.
 */
export const parseMoney = (text: string | null | undefined): number | null => {
  let clean = String(text ?? '').replace(/[\s\u00a0$]/g, '')
  if (clean === '') return null
  if (clean.includes(',') && clean.includes('.')) {
    const decimal = clean.lastIndexOf(',') > clean.lastIndexOf('.') ? ',' : '.'
    clean = clean.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.')
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(clean)) {
    clean = clean.replace(/[.,]/g, '')
  } else {
    clean = clean.replace(',', '.')
  }
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : null
}
