/**
 * The letter documents (factura de venta, cuenta de cobro, recibo de caja,
 * retiro y cierre de caja) as POS ticket text. It reads the very HTML the
 * sheet prints, by its classes, so a ticket never says something the sheet
 * does not: one template per document, two papers.
 *
 * Several documents come out as several tickets separated by `\f`, which the
 * printer turns into a cut (RawBT) or a page break (browser).
 */

export const TICKET_BREAK = '\f'

const clean = (text: string | null | undefined): string =>
  (text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

export interface TicketText {
  width: number
  center: (text: string) => string[]
  wrap: (text: string, indent?: string) => string[]
  /** `left ...... right` on one line, or the left wrapped and the right under it when they do not fit. */
  pair: (left: string, right: string) => string[]
  rule: string
}

export const ticketText = (width: number): TicketText => {
  /** Breaks at spaces; continuation lines take `indent`. A word wider than the paper is cut, never lost off the edge. */
  const wrap = (text: string, indent = ''): string[] => {
    const lines: string[] = []
    let current = ''
    const push = () => {
      if (current) lines.push(current)
      current = ''
    }
    for (let word of clean(text).split(' ').filter(Boolean)) {
      while (word) {
        if (current && current.length + 1 + word.length <= width) {
          current = `${current} ${word}`
          word = ''
        } else if (current) {
          push()
        } else {
          const prefix = lines.length ? indent : ''
          const room = width - prefix.length
          current = prefix + word.slice(0, room)
          word = word.slice(room)
          if (word) push()
        }
      }
    }
    push()
    return lines
  }
  const center = (text: string): string[] =>
    wrap(text).map(line => ' '.repeat(Math.floor((width - line.length) / 2)) + line)
  const pair = (left: string, right: string): string[] => {
    const l = clean(left)
    const r = clean(right)
    if (!r) return wrap(l)
    if (l.length + r.length + 1 <= width) return [l + r.padStart(width - l.length)]
    return [...wrap(l), r.padStart(width)]
  }
  return { width, center, wrap, pair, rule: '-'.repeat(width) }
}

const cells = (row: HTMLTableRowElement): string[] => [...row.cells].map(cell => clean(cell.textContent))

/**
 * A table row: two cells are a label and its amount; more cells put the
 * first (the description) on its own line and the rest under it, the last
 * one (the value) to the right.
 */
const tableRow = (t: TicketText, values: string[]): string[] => {
  const filled = values.filter(Boolean)
  if (filled.length <= 1) return t.wrap(filled[0] ?? '')
  if (values.length === 2 || filled.length === 2) return t.pair(filled[0]!, filled[filled.length - 1]!)
  const [first, ...rest] = values
  const last = rest.pop() ?? ''
  return [...t.wrap(first ?? ''), ...t.pair(`  ${rest.filter(Boolean).join(' · ')}`, last)]
}

const tableLines = (t: TicketText, table: HTMLTableElement): string[] => {
  const lines: string[] = []
  const head = table.tHead?.rows[0]
  if (head) lines.push(...tableRow(t, cells(head)), t.rule)
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      if (row.classList.contains('grand-total') && lines.length && lines[lines.length - 1] !== t.rule) lines.push(t.rule)
      lines.push(...tableRow(t, cells(row)))
    }
  }
  return lines
}

const notesLines = (t: TicketText, box: Element): string[] => {
  const body = box.querySelector(':scope > div:not(.label)')
  const notes = (body?.innerHTML ?? '')
    .split(/<br\s*\/?>/i)
    .map(part => clean(new DOMParser().parseFromString(part, 'text/html').body.textContent))
    .filter(Boolean)
  const extra = [...box.querySelectorAll(':scope > .resolution')].map(el => clean(el.textContent))
  if (!notes.length && !extra.length) return []
  return [t.rule, 'OBSERVACIONES:', ...notes.flatMap(note => t.wrap(note)), ...extra.flatMap(note => t.wrap(note))]
}

const elementLines = (t: TicketText, el: Element): string[] => {
  const has = (name: string) => el.classList.contains(name)
  if (el.tagName === 'IMG' || has('page-foot') || has('page-head')) return []
  if (has('header')) {
    const business = [...el.querySelectorAll('.business > div')].flatMap(div => t.center(clean(div.textContent)))
    const kind = clean(el.querySelector('.doc-kind')?.textContent)
    const number = clean(el.querySelector('.number')?.textContent)
    return [...business, t.rule, ...t.center(`${kind} No. ${number}`), t.rule]
  }
  if (has('party-row')) return t.wrap(clean(el.textContent), '  ')
  if (el.tagName === 'TABLE') return tableLines(t, el as HTMLTableElement)
  if (has('totals')) {
    return [t.rule, ...[...el.children].flatMap(row => {
      const [label, value] = [...row.querySelectorAll('span')].map(span => clean(span.textContent))
      return t.pair(label ?? '', value ?? '')
    })]
  }
  if (has('notes')) return notesLines(t, el)
  if (has('son')) return ['', ...t.wrap(clean(el.textContent))]
  if (has('signatures')) {
    return [...el.querySelectorAll('.signature')].flatMap(signature => [
      '', '', '', ` ${'_'.repeat(t.width - 2)}`, ...t.center(clean(signature.textContent)),
    ])
  }
  if (has('printed-by')) return ['', ...t.center(clean(el.textContent))]
  if (has('party')) return [...el.querySelectorAll('.party-row')].flatMap(row => elementLines(t, row))
  if (has('box') && !has('items') && el.children.length) {
    // A titled box (RETIROS DE CAJA, PRODUCTOS VENDIDOS): a rule before it.
    return [t.rule, ...[...el.children].flatMap(child => elementLines(t, child))]
  }
  if (el.children.length) return [...el.children].flatMap(child => elementLines(t, child))
  const text = clean(el.textContent)
  return text ? t.wrap(text) : []
}

/** Every `<section class="document">` of `sections` as ticket text of `width` columns, separated by `TICKET_BREAK`. */
export const documentsTicketText = (sections: string, width: number): string => {
  const t = ticketText(width)
  const doc = new DOMParser().parseFromString(`<body>${sections}</body>`, 'text/html')
  return [...doc.querySelectorAll('section.document')]
    .map(section => [...section.children].flatMap(child => elementLines(t, child))
      // A rule never follows another, nor opens or closes the ticket.
      .filter((line, i, all) => !(line === t.rule && (all[i - 1] === t.rule || i === all.length - 1)))
      .join('\n'))
    .join(`\n${TICKET_BREAK}`)
}
