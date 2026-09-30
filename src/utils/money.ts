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
