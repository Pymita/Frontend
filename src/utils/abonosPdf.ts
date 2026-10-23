/**
 * PDFs que se descargan: el histórico de abonos y los cierres de caja de un
 * período. jsPDF + autotable load on demand so the main bundle does not grow
 * for a button most sessions never press (MIT).
 */
import type { jsPDF } from 'jspdf'
import type { CellDef, RowInput } from 'jspdf-autotable'
import { formatFullDateTime, formatIsoDate } from './dates'
import { resolveImageUrl } from './images'
import { money } from './money'
import { PAYMENT_METHOD_LABELS, type CashPeriodTotals, type CashSession } from '../services/salesService'
import type { CashReceipt } from '../services/billingService'
import { differenceText, printedAtText, type DocumentBusiness } from './printDocuments'

export interface AbonosPdfFilters {
  from?: string
  to?: string
  customerName?: string
}

const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'empresa'

const methodLabel = (method: string | null | undefined): string => {
  if (!method) return '—'
  return (PAYMENT_METHOD_LABELS as Record<string, string>)[method] ?? method
}

const dmy = (value: string | null | undefined): string =>
  value ? formatIsoDate(value.slice(0, 10)) : '—'

const timeOf = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 16) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const loadPdf = async () => {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable: autoTableMod.default }
}

// Chromium writes "08:00 a. m." with no-break spaces, and one character outside
// the standard fonts' WinAnsi turns the whole string into unreadable glyphs.
const plainSpaces = (text: string): string => text.replace(/[\u00a0\u2009\u202f]/g, ' ')

/**
 * The logo as a data URL for jsPDF, or null. Reading the bytes of an image
 * on the API host or a bucket needs CORS there (showing it in a page does
 * not), so without it the PDF keeps its text header instead of failing.
 */
const logoDataUrl = async (url: string | null | undefined): Promise<string | null> => {
  const src = resolveImageUrl(url)
  if (!src) return null
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const LOGO_BOX = { width: 120, height: 44 }

/** The logo at the left, if any; returns its width and bottom, or nothing when it cannot be drawn. */
const writeLogo = (doc: jsPDF, logo: string | null, margin: number): { width: number; bottom: number } | null => {
  if (!logo) return null
  try {
    const { width, height, fileType } = doc.getImageProperties(logo)
    const scale = Math.min(LOGO_BOX.width / width, LOGO_BOX.height / height, 1)
    const top = margin - 12
    doc.addImage(logo, fileType, margin, top, width * scale, height * scale)
    return { width: width * scale, bottom: top + height * scale }
  } catch {
    // A format jsPDF cannot read: the header stays text only.
    return null
  }
}

/** Logo, business name, NIT · address · phone, the title and the lines under it; returns where the content starts. */
const writeHeader = (doc: jsPDF, business: DocumentBusiness, title: string, lines: string[], margin: number, logo: string | null): number => {
  const drawn = writeLogo(doc, logo, margin)
  const x = drawn ? margin + drawn.width + 12 : margin
  let y = margin
  doc.setFontSize(14)
  doc.text(business.legal_name || 'Empresa', x, y)
  y += 16
  doc.setFontSize(9)
  const headerBits = [
    business.nit ? `NIT ${business.nit}` : null,
    [business.address, business.city].filter(Boolean).join(', ') || null,
    business.phone || null,
  ].filter(Boolean)
  if (headerBits.length) {
    doc.text(headerBits.join(' · '), x, y)
    y += 14
  }

  doc.setFontSize(13)
  doc.text(title, x, y)
  y += 16
  doc.setFontSize(9)
  for (const line of lines) {
    doc.text(line, x, y)
    y += 12
  }
  return Math.max(y, (drawn?.bottom ?? 0) + 12) + 6
}

/** "Impreso el …" and "Página n de m" at the foot of every page. */
const writeFooters = (doc: jsPDF, margin: number): void => {
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const printed = plainSpaces(printedAtText())
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.text(printed, margin, height - 20)
    doc.text(`Página ${page} de ${pages}`, width - margin, height - 20, { align: 'right' })
  }
}

const lastTableEnd = (doc: jsPDF, fallback: number): number =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback

/** Builds and downloads historico-abonos-<empresa>-<desde>-<hasta>.pdf */
export async function downloadAbonosPdf(
  business: DocumentBusiness,
  receipts: CashReceipt[],
  filters: AbonosPdfFilters,
  total: number,
): Promise<string> {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([loadPdf(), logoDataUrl(business.logo_url)])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const margin = 40

  const periodLabel = [
    filters.from || filters.to
      ? `Período: ${dmy(filters.from) } – ${dmy(filters.to)}`
      : 'Período: todos',
    filters.customerName ? `Cliente: ${filters.customerName}` : null,
  ].filter(Boolean)
  const y = writeHeader(doc, business, 'Histórico de abonos', [periodLabel.join(' · ')], margin, logo)

  const body = receipts.map(receipt => {
    const documents = receipt.lines
      .map(line => `${line.document_number ?? '—'} (${money(line.amount)})`)
      .join(', ')
    const when = [dmy(receipt.paid_at), timeOf(receipt.registered_at)].filter(Boolean).join(' ')
    return [
      when,
      receipt.reference,
      receipt.customer.name,
      documents || '—',
      methodLabel(receipt.payment_method),
      money(receipt.total),
      money(receipt.balance_after ?? receipt.lines.reduce((sum, line) => sum + line.balance, 0)),
      receipt.received_by || '—',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Recibo', 'Cliente', 'Documentos', 'Método', 'Total', 'Saldo', 'Registró']],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [55, 65, 80], textColor: 255 },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  doc.setFontSize(10)
  doc.text(
    `Total abonos: ${money(total)} · ${receipts.length} recibo${receipts.length === 1 ? '' : 's'}`,
    margin,
    lastTableEnd(doc, y + 20) + 18,
  )
  writeFooters(doc, margin)

  const from = filters.from ? filters.from.replace(/-/g, '') : 'inicio'
  const to = filters.to ? filters.to.replace(/-/g, '') : 'hoy'
  const filename = `historico-abonos-${slug(business.legal_name || 'empresa')}-${from}-${to}.pdf`
  doc.save(filename)
  return filename
}

// ===== Cierres de caja =====

/** The figures of one close, or of the period: the ones its Excel writes. */
interface CloseFigures {
  sales_total: number | null
  sales_count: number | null
  credit_sales: number | null
  tips_total: number | null
  by_method: Record<string, { amount: number } | undefined>
  recurring_by_method: Partial<Record<string, number>>
  cash_expenses: number
  opening_amount: number
  expected_cash: number
  counted_cash: number | null
  difference: number | null
  total_collected: number
}

const closeFigures = (close: CashSession): CloseFigures => ({
  sales_total: close.summary.sales_total,
  sales_count: close.summary.sales_count,
  credit_sales: close.summary.credit_sales?.total ?? null,
  tips_total: close.summary.tips_total,
  by_method: close.summary.by_method ?? {},
  recurring_by_method: close.summary.recurring_by_method ?? {},
  cash_expenses: close.summary.cash_expenses ?? 0,
  opening_amount: close.opening_amount,
  expected_cash: close.expected_cash,
  counted_cash: close.counted_cash,
  difference: close.difference,
  total_collected: close.summary.total_collected ?? 0,
})

const instant = (iso: string | null): string => plainSpaces(formatFullDateTime(iso))
const moneyOrDash = (value: number | null): string => (value === null ? '—' : money(value))

const METHOD_ORDER = Object.keys(PAYMENT_METHOD_LABELS)
const byListOrder = (a: string, b: string): number => {
  const rank = (method: string) => (METHOD_ORDER.includes(method) ? METHOD_ORDER.indexOf(method) : METHOD_ORDER.length)
  return rank(a) - rank(b)
}

const bold = (content: string): CellDef => ({ content, styles: { fontStyle: 'bold' } })

/**
 * Two columns per row: what came in (cash always, it is the drawer, then
 * each method that brought money) and what the drawer should hold.
 */
const figureRows = (figures: CloseFigures, countedLabel: string): RowInput[] => {
  const charged = Object.keys(figures.by_method)
    .filter(method => method === 'cash' || (figures.by_method[method]?.amount ?? 0) > 0)
  if (!charged.includes('cash')) charged.push('cash')
  const abonos = Object.keys(figures.recurring_by_method).filter(method => (figures.recurring_by_method[method] ?? 0) > 0)

  const received: [string, CellDef | string][] = [
    ['Ventas (sin propina)', moneyOrDash(figures.sales_total)],
    ['N.º de ventas', figures.sales_count === null ? '—' : String(figures.sales_count)],
    ...(figures.credit_sales ? [['Ventas a crédito (en Cartera)', money(figures.credit_sales)] as [string, string]] : []),
    ['Propinas', moneyOrDash(figures.tips_total)],
    ...charged.sort(byListOrder).map(method =>
      [`Cobros · ${methodLabel(method)}`, money(figures.by_method[method]?.amount ?? 0)] as [string, string]),
    ...abonos.sort(byListOrder).map(method =>
      [`Abonos de cuotas · ${methodLabel(method)}`, money(figures.recurring_by_method[method] ?? 0)] as [string, string]),
    ['Total recibido', bold(money(figures.total_collected))],
  ]
  const drawer: [string, CellDef | string][] = [
    ...(figures.opening_amount > 0 ? [['Base', money(figures.opening_amount)] as [string, string]] : []),
    ['Gastos en efectivo', money(figures.cash_expenses)],
    ['Efectivo del turno', bold(money(figures.expected_cash))],
    [countedLabel, moneyOrDash(figures.counted_cash)],
    ['Diferencia', bold(figures.difference === null ? '—' : differenceText(figures.difference))],
  ]

  return Array.from({ length: Math.max(received.length, drawer.length) }, (_, index) => [
    ...(received[index] ?? ['', '']),
    ...(drawer[index] ?? ['', '']),
  ])
}

/** "FE100 a FE120" as the printed close reads it; a close frozen before 2026-10 has no range. */
const invoiceRange = (close: CashSession): string => {
  const { sales_total: sales, first_invoice: first, last_invoice: last } = close.summary
  if (sales === null) return ''
  if (!first) return 'Facturas: sin ventas'
  return `Facturas: ${!last || last === first ? first : `${first} a ${last}`}`
}

const periodText = (from?: string, to?: string): string => {
  if (from && to) return from === to ? `Día: ${dmy(from)}` : `Período: ${dmy(from)} – ${dmy(to)}`
  if (from) return `Desde el ${dmy(from)}`
  if (to) return `Hasta el ${dmy(to)}`
  return 'Período: todos'
}

/** cierres-de-caja-2026-10-01_2026-10-19.pdf, the name of the Excel of the same period. */
const closesFilename = (from?: string, to?: string): string => {
  const range = from && to
    ? from === to ? `-${from}` : `-${from}_${to}`
    : from ? `-desde-${from}` : to ? `-hasta-${to}` : ''
  return `cierres-de-caja${range}.pdf`
}

/**
 * Builds and downloads the closes of a period, oldest first, and the
 * period totals: built from the figures each close froze (`closed=1`), the
 * same ones the Excel lists. The open shift is never in it.
 */
export async function downloadCashClosesPdf(
  business: DocumentBusiness,
  closes: CashSession[],
  totals: CashPeriodTotals,
  period: { from?: string; to?: string },
): Promise<string> {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([loadPdf(), logoDataUrl(business.logo_url)])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const margin = 40
  let y = writeHeader(doc, business, 'Cierres de caja', [
    `${periodText(period.from, period.to)} · Solo los turnos cerrados`,
  ], margin, logo)

  // The drawer half starts a little apart from the money that came in.
  const drawerPadding = { top: 3, bottom: 3, left: 16, right: 3 }
  const table = (head: RowInput[], body: RowInput[]) => {
    autoTable(doc, {
      startY: y,
      head,
      body,
      // A close starts on the next page instead of splitting.
      pageBreak: 'avoid',
      showHead: 'firstPage',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [55, 65, 80], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 170 },
        1: { cellWidth: 96, halign: 'right' },
        2: { cellWidth: 170, cellPadding: drawerPadding },
        3: { cellWidth: 96, halign: 'right' },
      },
      margin: { top: margin, bottom: margin, left: margin, right: margin },
    })
    y = lastTableEnd(doc, y) + 14
  }
  const subHead = { fillColor: [235, 237, 240] as [number, number, number], textColor: 20, fontStyle: 'normal' as const }

  const ordered = [...closes].sort((a, b) => a.number - b.number)
  for (const close of ordered) {
    table(
      [
        [
          { content: `Cierre N.º ${close.number}`, colSpan: 2 },
          { content: invoiceRange(close), colSpan: 2, styles: { halign: 'right' } },
        ],
        [
          { content: `Apertura: ${instant(close.opened_at)} · ${close.opened_by ?? 'Automática'}`, colSpan: 2, styles: subHead },
          { content: `Cierre: ${instant(close.closed_at)} · ${close.closed_by ?? '—'}`, colSpan: 2, styles: { ...subHead, cellPadding: drawerPadding } },
        ],
      ],
      [
        ...figureRows(closeFigures(close), 'Efectivo contado'),
        ...(close.closing_notes ? [[{ content: `Nota: ${close.closing_notes}`, colSpan: 4 }]] : []),
      ],
    )
  }

  if (ordered.length) {
    const counted = totals.counted_closes < totals.closes
      ? `Efectivo contado (${totals.counted_closes} de ${totals.closes} cierres)`
      : 'Efectivo contado'
    table(
      [[{ content: `Total del período (${totals.closes} ${totals.closes === 1 ? 'cierre' : 'cierres'})`, colSpan: 4 }]],
      figureRows(totals, counted),
    )
  } else {
    doc.setFontSize(10)
    doc.text('No hay cierres de caja en estas fechas.', margin, y + 6)
  }

  writeFooters(doc, margin)

  const filename = closesFilename(period.from, period.to)
  doc.save(filename)
  return filename
}
