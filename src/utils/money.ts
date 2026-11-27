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

/** Unidades y conteos: el stock puede ir en kilos o litros, pero 12 unidades no se leen "12,00" ("1.250,5", "19,125"). */
export const quantity = (value: number | string | null | undefined): string =>
  Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })

/** Decimales de una cantidad que se vende por fracción: un gramo de un kilo (OrderItem::QUANTITY_DECIMALS). */
export const QUANTITY_DECIMALS = 3

/**
 * La cantidad de una línea como se lee en pedidos, facturas y cierres: lo
 * pesado con sus tres decimales y su unidad ("1,250 kg"), lo demás como
 * siempre ("2"). `unit` es el de la línea (null = unidades enteras).
 */
export const lineQuantity = (value: number | string | null | undefined, unit?: string | null): string =>
  unit
    ? `${Number(value || 0).toLocaleString('es-CO', { minimumFractionDigits: QUANTITY_DECIMALS, maximumFractionDigits: QUANTITY_DECIMALS })} ${unit}`
    : quantity(value)

/**
 * Una cantidad escrita a mano: "1,5" y "1.5" son lo mismo (en un pedido
 * nadie escribe miles de kilos, así que el punto es decimal, no de miles).
 * Null si no es un número o lleva más de tres decimales.
 */
export const parseQuantity = (text: string | number | null | undefined): number | null => {
  const clean = String(text ?? '').replace(/[\s\u00a0]/g, '').replace(',', '.')
  if (!new RegExp(`^\\d+(\\.\\d{1,${QUANTITY_DECIMALS}})?$`).test(clean)) return null
  return Number(clean)
}

/** Una cantidad dentro de su campo: coma decimal y sin puntos de miles, para que se relea igual ("1,375"). */
export const quantityInput = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? '' : String(Number(value)).replace('.', ',')

/**
 * Cuánto mueven los botones − / + de una línea: una unidad entera, medio
 * kilo (o litro, o libra) de lo que se vende por fracción, y 100 de lo que
 * se vende por gramos o mililitros. Igual en la app de meseros.
 */
export const quantityStep = (unit?: string | null): number => {
  if (!unit) return 1
  return /^(g|gr|grs|gramo|gramos|ml|mililitro|mililitros)$/i.test(unit.trim()) ? 100 : 0.5
}

/** A rate as Colombia writes it, with a decimal comma and no trailing zeros ("2,5", "0,966"). */
export const rateNumber = (value: number | null | undefined): string =>
  Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 })

/** La parte de un total, con una cifra decimal como la manda el API ("86,2 %"). */
export const percent = (value: number | null | undefined): string =>
  `${Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

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
  // A zero the field already showed, typed after: "0100.000" is still 100.000.
  let clean = String(text ?? '').replace(/[\s\u00a0$]/g, '').replace(/^(-?)0+(?=\d)/, '$1')
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
