/**
 * PDF del histórico de abonos. jsPDF + autotable load on demand so the main
 * bundle does not grow for a button most sessions never press (MIT).
 */
import { formatIsoDate, todayIso } from './dates'
import { money } from './money'
import { PAYMENT_METHOD_LABELS } from '../services/salesService'
import type { CashReceipt } from '../services/billingService'
import type { DocumentBusiness } from './printDocuments'

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

/** Builds and downloads historico-abonos-<empresa>-<desde>-<hasta>.pdf */
export async function downloadAbonosPdf(
  business: DocumentBusiness,
  receipts: CashReceipt[],
  filters: AbonosPdfFilters,
  total: number,
): Promise<string> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const margin = 40
  let y = margin

  doc.setFontSize(14)
  doc.text(business.legal_name || 'Empresa', margin, y)
  y += 16
  doc.setFontSize(9)
  const headerBits = [
    business.nit ? `NIT ${business.nit}` : null,
    [business.address, business.city].filter(Boolean).join(', ') || null,
    business.phone || null,
  ].filter(Boolean)
  if (headerBits.length) {
    doc.text(headerBits.join(' · '), margin, y)
    y += 14
  }

  doc.setFontSize(13)
  doc.text('Histórico de abonos', margin, y)
  y += 16
  doc.setFontSize(9)
  const periodLabel = [
    filters.from || filters.to
      ? `Período: ${dmy(filters.from) } – ${dmy(filters.to)}`
      : 'Período: todos',
    filters.customerName ? `Cliente: ${filters.customerName}` : null,
  ].filter(Boolean)
  doc.text(periodLabel.join(' · '), margin, y)
  y += 12
  doc.text(`Generado el ${dmy(todayIso())}`, margin, y)
  y += 18

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

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
  doc.setFontSize(10)
  doc.text(
    `Total abonos: ${money(total)} · ${receipts.length} recibo${receipts.length === 1 ? '' : 's'}`,
    margin,
    finalY + 18,
  )

  const from = filters.from ? filters.from.replace(/-/g, '') : 'inicio'
  const to = filters.to ? filters.to.replace(/-/g, '') : 'hoy'
  const filename = `historico-abonos-${slug(business.legal_name || 'empresa')}-${from}-${to}.pdf`
  doc.save(filename)
  return filename
}
