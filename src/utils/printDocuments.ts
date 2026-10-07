import { money } from './money'
/**
 * Documentos imprimibles en hoja carta: cuenta de cobro / factura de venta y
 * recibo de caja de la facturación automática, y el cierre de caja de un
 * turno. Es UNA plantilla para todas las empresas: el encabezado sale de los
 * datos de cada una (Configuración > Datos del negocio), así que cada negocio
 * imprime con su nombre, NIT, régimen, dirección, teléfonos y observaciones.
 */
import { orderPaymentMethodLabels, taxRegimeLabels } from './labels'
import { APP_NAME } from './branding'
import { formatFullDateTime, formatIsoDate } from './dates'
import type { CashSession } from '../services/salesService'

export interface DocumentBusiness {
  legal_name: string
  trade_name?: string | null
  nit?: string | null
  tax_regime?: string | null
  address?: string | null
  city?: string | null
  department?: string | null
  phone?: string | null
  email?: string | null
  document_notes?: string | null
  complete?: boolean
}

/** The resolution a factura was numbered under, as it read then (not the current settings). */
export interface DocumentResolution {
  number: string
  date?: string | null
  prefix?: string | null
  range_from?: number | null
  range_to?: number | null
  valid_until?: string | null
}

export interface PrintableInvoice {
  document_kind: 'invoice' | 'collection'
  document_number: string
  issued_at: string
  due_date: string | null
  period: string
  customer_name: string
  customer_document_type: string | null
  customer_document: string | null
  customer_address: string | null
  customer_city: string | null
  customer_phone: string | null
  customer_email: string | null
  concept: string
  quantity: number
  unit_price: number
  subtotal: number
  discount: number
  tax_name: string | null
  tax_rate: number
  tax_amount: number
  total: number
  amount_paid: number
  balance: number
  notes: string | null
  seller: string | null
}

export interface PrintableReceipt {
  reference: string
  paid_at: string | null
  payment_method: string | null
  notes: string | null
  received_by: string | null
  customer: {
    name: string
    document_type: string | null
    document: string | null
    address: string | null
    city: string | null
    phone: string | null
  }
  total: number
  lines: {
    payment_id?: number
    document_kind: 'invoice' | 'collection' | null
    document_number: string | null
    concept: string | null
    period: string | null
    document_total: number
    amount: number
    balance: number
  }[]
}

const METHOD_LABELS = orderPaymentMethodLabels

// ===== Valor en letras =====

const UNITS = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

const below100 = (n: number): string =>
  n < 30 ? UNITS[n]! : TENS[Math.floor(n / 10)]! + (n % 10 ? ` y ${UNITS[n % 10]}` : '')

const below1000 = (n: number): string => {
  if (n === 100) return 'cien'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return [HUNDREDS[hundreds], rest ? below100(rest) : ''].filter(Boolean).join(' ')
}

// "uno" se acorta delante de "mil", "millones" y "pesos": veintiún mil, un peso.
const apocope = (words: string): string =>
  words.endsWith('veintiuno') ? words.replace(/veintiuno$/, 'veintiún') : words.replace(/uno$/, 'un')

const below1Million = (n: number): string => {
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const head = thousands === 0 ? '' : thousands === 1 ? 'mil' : `${apocope(below1000(thousands))} mil`
  return [head, rest ? below1000(rest) : ''].filter(Boolean).join(' ')
}

/** Valor en letras como va en las facturas colombianas: "SETENTA MIL PESOS M/CTE". */
export const amountInWords = (value: number): string => {
  const n = Math.round(Math.abs(value))
  if (n === 0) return 'CERO PESOS M/CTE'

  const millions = Math.floor(n / 1_000_000)
  const rest = n % 1_000_000
  const head = millions === 0 ? '' : millions === 1 ? 'un millón' : `${apocope(below1Million(millions))} millones`
  const tail = rest ? apocope(below1Million(rest)) : ''
  // Millones exactos llevan "de": un millón de pesos.
  const currency = rest === 0 && millions > 0 ? 'de pesos' : n === 1 ? 'peso' : 'pesos'

  return `${[head, tail].filter(Boolean).join(' ')} ${currency} M/CTE`.toUpperCase()
}

// ===== Formato =====

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')


/** DD/MM/AAAA sin pasar por Date: la zona horaria no corre el día. */
const dmy = (value: string | null | undefined): string => (value ? formatIsoDate(value) : '')

const periodName = (value: string): string => {
  const [y = 0, m = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

/**
 * The resolution exactly as the business registered it: the range reads as
 * the numbers it authorizes, prefix immediately followed by the number.
 */
const resolutionLine = (resolution: DocumentResolution): string => {
  const prefix = resolution.prefix ?? ''
  return [
    `Resolución DIAN N.º ${resolution.number}${resolution.date ? ` del ${dmy(resolution.date)}` : ''}`,
    resolution.range_from && resolution.range_to ? `Rango ${prefix}${resolution.range_from} a ${prefix}${resolution.range_to}` : '',
    resolution.valid_until ? `Vigente hasta ${dmy(resolution.valid_until)}` : '',
  ].filter(Boolean).map(part => `<span>${escape(part)}</span>`).join(' · ')
}

/**
 * "Responsable de IVA", or '' when it must not print: the regime is a tax
 * statement of the NIT, and without a NIT loaded it is the database default,
 * not something the company said.
 */
export const taxRegimeText = (business: { nit?: string | null; tax_regime?: string | null }): string =>
  business.nit && business.tax_regime ? taxRegimeLabels[business.tax_regime] ?? '' : ''

const header = (business: DocumentBusiness, kind: string, number: string, resolution: DocumentResolution | null = null): string => {
  const regime = taxRegimeText(business)
  const place = [business.city, business.department].filter(Boolean).join(' - ')
  return `
    <div class="box header">
      <div class="business">
        <div class="business-name">${escape(business.legal_name)}</div>
        ${business.trade_name ? `<div>${escape(business.trade_name)}</div>` : ''}
        ${business.nit || regime ? `<div>${business.nit ? `NIT: ${escape(business.nit)}` : ''}${business.nit && regime ? ' · ' : ''}${escape(regime.toUpperCase())}</div>` : ''}
        ${business.address ? `<div>${escape(business.address)}</div>` : ''}
        ${business.phone || place ? `<div>${business.phone ? `TELÉFONO: ${escape(business.phone)}` : ''} ${escape(place.toUpperCase())}</div>` : ''}
        ${business.email ? `<div>${escape(business.email)}</div>` : ''}
        ${resolution ? `<div class="resolution">${resolutionLine(resolution)}</div>` : ''}
      </div>
      <div class="box doc-number">
        <div class="doc-kind">${escape(kind)}</div>
        <div><span class="label">No.</span> <span class="number">${escape(number)}</span></div>
      </div>
    </div>`
}

const partyRows = (rows: [string, string | null | undefined][]): string =>
  rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="party-row"><span class="label">${escape(label)}:</span> ${escape(value)}</div>`)
    .join('')

const footer = (left: string, right: string) => `
  <div class="signatures">
    <div class="signature">${left}</div>
    <div class="signature">${right}</div>
  </div>
  <div class="printed-by">Documento impreso por computador · ${escape(APP_NAME)}</div>`

export const invoiceHtml = (
  business: DocumentBusiness,
  invoice: PrintableInvoice,
  resolution: DocumentResolution | null,
): string => {
  const isInvoice = invoice.document_kind === 'invoice'
  const kind = isInvoice ? 'FACTURA DE VENTA' : 'CUENTA DE COBRO'
  const notes = [business.document_notes, invoice.notes].filter(Boolean).map(escape).join('<br>')

  return `
  <section class="document">
    ${header(business, kind, invoice.document_number, isInvoice ? resolution : null)}
    <div class="box party">
      <div class="party-grid">
        <div>
          ${partyRows([
            ['NOMBRE', invoice.customer_name],
            [invoice.customer_document_type === 'NIT' ? 'NIT' : invoice.customer_document_type || 'NIT', invoice.customer_document],
            ['DIRECCIÓN', invoice.customer_address],
            ['TELÉFONO', invoice.customer_phone],
          ])}
        </div>
        <div>
          ${partyRows([
            ['FECHA (D/M/A)', dmy(invoice.issued_at)],
            ['VENCE', dmy(invoice.due_date)],
            ['CIUDAD', invoice.customer_city],
            ['PERÍODO', periodName(invoice.period)],
          ])}
        </div>
      </div>
    </div>
    <div class="box items">
      <table>
        <thead>
          <tr><th class="left">DESCRIPCIÓN</th><th>CANT.</th><th class="right">VL. UNIDAD</th><th class="right">VR. TOTAL</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="left">${escape(invoice.concept.toUpperCase())}</td>
            <td class="center">${invoice.quantity}</td>
            <td class="right">${money(invoice.unit_price)}</td>
            <td class="right">${money(invoice.subtotal)}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        ${invoice.discount > 0 ? `<div><span>DESCUENTO:</span> <span>-${money(invoice.discount)}</span></div>` : ''}
        ${invoice.tax_amount > 0 ? `<div><span>${escape(invoice.tax_name || 'IMPUESTO')} (INCLUIDO):</span> <span>${money(invoice.tax_amount)}</span></div>` : ''}
        <div class="grand-total"><span>TOTAL:</span> <span>${money(invoice.total)}</span></div>
      </div>
    </div>
    <div class="son"><span class="label">SON:</span> ${escape(amountInWords(invoice.total))}</div>
    <div class="box notes">
      <div class="label">OBSERVACIONES:</div>
      <div>${notes || '&nbsp;'}</div>
    </div>
    ${footer('RECIBIDO / CLIENTE', 'FIRMA VENDEDOR')}
  </section>`
}

export const receiptHtml = (business: DocumentBusiness, receipt: PrintableReceipt): string => `
  <section class="document">
    ${header(business, 'RECIBO DE CAJA', receipt.reference)}
    <div class="box party">
      <div class="party-grid">
        <div>
          ${partyRows([
            ['RECIBIMOS DE', receipt.customer.name],
            [receipt.customer.document_type === 'NIT' ? 'NIT' : receipt.customer.document_type || 'NIT', receipt.customer.document],
            ['DIRECCIÓN', receipt.customer.address],
            ['TELÉFONO', receipt.customer.phone],
          ])}
        </div>
        <div>
          ${partyRows([
            ['FECHA (D/M/A)', dmy(receipt.paid_at)],
            ['CIUDAD', receipt.customer.city],
            ['FORMA DE PAGO', METHOD_LABELS[receipt.payment_method ?? ''] ?? receipt.payment_method],
          ])}
        </div>
      </div>
    </div>
    <div class="son"><span class="label">LA SUMA DE:</span> ${escape(amountInWords(receipt.total))} (${money(receipt.total)})</div>
    <div class="box items">
      <table>
        <thead>
          <tr><th class="left">POR CONCEPTO DE</th><th class="right">VALOR DOCUMENTO</th><th class="right">ABONO</th><th class="right">SALDO</th></tr>
        </thead>
        <tbody>
          ${receipt.lines.map(line => `
          <tr>
            <td class="left">Abono a ${line.document_kind === 'invoice' ? 'factura' : 'cuenta de cobro'} ${escape(line.document_number)}${line.concept ? ` · ${escape(line.concept)}` : ''}${line.period ? ` (${escape(periodName(line.period))})` : ''}</td>
            <td class="right">${money(line.document_total)}</td>
            <td class="right">${money(line.amount)}</td>
            <td class="right">${money(line.balance)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="grand-total"><span>TOTAL RECIBIDO:</span> <span>${money(receipt.total)}</span></div>
      </div>
    </div>
    <div class="box notes">
      <div class="label">OBSERVACIONES:</div>
      <div>${[receipt.notes, receipt.received_by ? `Recibió: ${receipt.received_by}` : ''].filter(Boolean).map(escape).join('<br>') || '&nbsp;'}</div>
    </div>
    ${footer('ENTREGA (QUIEN PAGA)', 'RECIBIDO POR')}
  </section>`

const amountRows = (rows: [string, number | null | undefined, boolean?][]): string =>
  rows
    .map(([label, value, strong]) =>
      `<tr${strong ? ' class="grand-total"' : ''}><td class="left">${escape(label)}</td><td class="right">${value === null || value === undefined ? '—' : money(value)}</td></tr>`)
    .join('')

const differenceText = (difference: number): string =>
  Math.abs(difference) < 0.01 ? 'Cuadra' : difference > 0 ? `Sobran ${money(difference)}` : `Faltan ${money(Math.abs(difference))}`

const productsTable = (products: { name: string; quantity: number }[]): string => `
  <table class="compact">
    <thead><tr><th class="left">PRODUCTO</th><th class="right">CANT.</th></tr></thead>
    <tbody>${products.map(p => `<tr><td class="left">${escape(p.name)}</td><td class="right">${p.quantity}</td></tr>`).join('')}</tbody>
  </table>`

/**
 * Built only from the summary frozen at the close, so a reprint never
 * changes. Closes frozen before 2026-10 have no sales, products or invoice
 * range: they print without them.
 */
export const cashCloseHtml = (business: DocumentBusiness, session: CashSession): string => {
  const summary = session.summary
  const detailed = summary.sales_total !== null
  const methods = Object.entries(summary.by_method).filter(([, totals]) => totals.count > 0)
  const recurring = Object.entries(summary.recurring_by_method).filter(([, amount]) => (amount ?? 0) > 0)
  const recurringTotal = recurring.reduce((sum, [, amount]) => sum + (amount ?? 0), 0)
  const products = summary.products ?? []
  const half = Math.ceil(products.length / 2)
  const invoices = summary.first_invoice
    ? summary.first_invoice === summary.last_invoice ? summary.first_invoice : `${summary.first_invoice} a ${summary.last_invoice}`
    : null
  const trail = session.adjustments.map(a =>
    `${formatFullDateTime(a.at)} · ${a.user_name} movió ${a.field === 'opened_at' ? 'la apertura' : 'el cierre'} ` +
    `de ${formatFullDateTime(a.from)} a ${formatFullDateTime(a.to)}: ${a.reason}` +
    (a.before.sales_total !== null && a.after.sales_total !== null
      ? ` (ventas ${money(a.before.sales_total)} → ${money(a.after.sales_total)})`
      : ''))
  const notes = [session.closing_notes, ...trail].filter(Boolean).map(escape).join('<br>')

  return `
  <section class="document">
    ${header(business, 'CIERRE DE CAJA', String(session.number))}
    <div class="box party">
      <div class="party-grid">
        <div>
          ${partyRows([
            ['APERTURA', `${formatFullDateTime(session.opened_at)} · ${session.opened_by ?? 'Automática'}`],
            ['CIERRE', `${formatFullDateTime(session.closed_at)}${session.closed_by ? ` · ${session.closed_by}` : ''}`],
          ])}
        </div>
        <div>
          ${detailed
            ? partyRows([
                ['FACTURAS', invoices ?? 'Sin ventas'],
                ['VENTAS', String(summary.sales_count ?? 0)],
                ['PEDIDOS', String(summary.orders_count ?? 0)],
              ])
            : '<div class="party-row">Cierre anterior al resumen detallado</div>'}
        </div>
      </div>
    </div>
    <div class="box">
      <table class="compact">
        <thead>
          <tr><th class="left">RECIBIDO POR MEDIO DE PAGO</th><th class="right">COBROS</th><th class="right">PROPINAS</th><th class="right">TOTAL</th></tr>
        </thead>
        <tbody>
          ${methods.map(([method, totals]) => `
          <tr>
            <td class="left">${escape(METHOD_LABELS[method] ?? method)}</td>
            <td class="right">${totals.count}</td>
            <td class="right">${money(totals.tips)}</td>
            <td class="right">${money(totals.amount)}</td>
          </tr>`).join('')}
          ${recurring.map(([method, amount]) => `
          <tr>
            <td class="left">Abonos de cuotas · ${escape(METHOD_LABELS[method] ?? method)}</td>
            <td class="right"></td>
            <td class="right"></td>
            <td class="right">${money(amount ?? 0)}</td>
          </tr>`).join('')}
          ${methods.length || recurring.length ? '' : '<tr><td class="left" colspan="4">No hubo cobros en este turno.</td></tr>'}
        </tbody>
      </table>
      <div class="columns">
        <table class="compact">
          <tbody>
            ${amountRows([
              ...(detailed
                ? [
                    ['Ventas (sin propina)', summary.sales_total],
                    ['Propinas', summary.tips_total],
                    ['Abonos a cuentas abiertas', summary.order_abonos],
                  ] as [string, number | null][]
                : []),
              ...(recurringTotal > 0 ? [['Abonos de cuotas', recurringTotal] as [string, number]] : []),
              ['TOTAL RECIBIDO', summary.total_collected, true],
            ])}
          </tbody>
        </table>
        <table class="compact">
          <tbody>
            ${amountRows([
              ...(session.opening_amount > 0 ? [['+ Base', session.opening_amount] as [string, number]] : []),
              ['+ Cobros en efectivo (con propinas)', summary.cash_sales],
              ...(summary.cash_recurring > 0 ? [['+ Abonos de cuotas en efectivo', summary.cash_recurring] as [string, number]] : []),
              ['− Gastos pagados en efectivo', summary.cash_expenses],
              ['EFECTIVO DEL TURNO', session.expected_cash, true],
              ...(session.counted_cash !== null ? [['Efectivo contado', session.counted_cash] as [string, number]] : []),
            ])}
            ${session.difference !== null ? `<tr class="grand-total"><td class="left">DIFERENCIA</td><td class="right">${differenceText(session.difference)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
    ${detailed ? `
    <div class="box">
      <div class="label">PRODUCTOS VENDIDOS</div>
      ${products.length
        ? `<div class="columns">${productsTable(products.slice(0, half))}${products.length > 1 ? productsTable(products.slice(half)) : ''}</div>`
        : '<div>No se vendieron productos en este turno.</div>'}
      ${summary.products_others ? `<div>Otros ${summary.products_others.count} productos: ${summary.products_others.quantity} unidades.</div>` : ''}
    </div>` : ''}
    <div class="box notes">
      <div class="label">OBSERVACIONES:</div>
      <div>${notes || '&nbsp;'}</div>
    </div>
    ${footer('ENTREGA (CAJERO)', 'RECIBE (ADMINISTRADOR)')}
  </section>`
}

// Documento en blanco y negro: se imprime en cualquier impresora de oficina.
const STYLES = `
  @page { size: letter; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: black; margin: 0; }
  .document { max-width: 190mm; margin: 0 auto; page-break-after: always; }
  .document:last-child { page-break-after: auto; }
  .box { border: 1.5px solid black; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .business { flex: 1; text-align: center; line-height: 1.5; }
  .business-name { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
  .doc-number { min-width: 190px; text-align: center; margin: 0; }
  .doc-kind { font-weight: bold; font-size: 14px; margin-bottom: 6px; }
  .number { font-size: 20px; font-weight: bold; }
  .label { font-weight: bold; }
  .party-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
  .party-row { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1.5px solid black; padding: 4px; font-size: 12px; }
  td { padding: 6px 4px; vertical-align: top; }
  .left { text-align: left; } .right { text-align: right; } .center { text-align: center; }
  .items { min-height: 70mm; display: flex; flex-direction: column; justify-content: space-between; }
  .totals { align-self: flex-end; min-width: 240px; margin-top: 12px; }
  .totals div { display: flex; justify-content: space-between; gap: 16px; margin: 2px 0; }
  .grand-total { font-weight: bold; font-size: 14px; }
  .son { margin: 4px 6px 8px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; margin-top: 8px; }
  .compact td { padding: 3px 4px; }
  .notes { min-height: 22mm; }
  .resolution { margin-top: 4px; font-size: 11px; }
  .resolution span { display: inline-block; }
  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 36px; }
  .signature { flex: 1; border-top: 1px solid black; padding-top: 4px; text-align: center; font-weight: bold; }
  .printed-by { margin-top: 12px; text-align: center; font-size: 9px; color: dimgray; }
`

/**
 * La ventana se abre en el mismo clic (los navegadores bloquean las que se
 * abren después de esperar al servidor) y se llena cuando llegan los datos.
 */
export const openDocumentWindow = (): Window | null => {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (win) {
    win.document.write('<html><body style="font-family:sans-serif;padding:16px">Generando…</body></html>')
  }
  return win
}

export const fillDocumentWindow = (win: Window, title: string, sections: string): void => {
  win.document.open()
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(title)}</title>` +
      `<style>${STYLES}</style></head><body>${sections}</body></html>`,
  )
  win.document.close()
  win.focus()
  win.print()
}
