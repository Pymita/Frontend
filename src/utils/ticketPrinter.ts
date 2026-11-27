/**
 * Cómo imprime ESTE equipo las tirillas POS. Es una preferencia del equipo,
 * no de la empresa: el computador de la oficina imprime con el diálogo del
 * navegador y la pantalla con impresora térmica integrada (POS Android "3 en
 * 1") manda la tirilla directo a la impresora. Por eso vive en el
 * navegador (localStorage) y no en el backend.
 *
 * - `browser`: el diálogo de impresión del navegador. En el computador se abre
 *   en una ventana aparte, como siempre; en Android se imprime desde la misma
 *   pantalla, porque allá la ventana emergente es una pestaña que muestra la
 *   tirilla con una X y nunca abre el diálogo.
 * - `rawbt`: la tirilla se convierte en comandos ESC/POS (el idioma de las
 *   impresoras térmicas) y se entrega a la app RawBT, que la imprime en la
 *   impresora integrada, USB, Bluetooth o de red, sin diálogo y con corte.
 */
import { shallowRef } from 'vue'
import { resolveImageUrl } from './images'

export type TicketPrinterMode = 'browser' | 'rawbt'
export type TicketPaper = 58 | 80

export interface TicketPrinterSettings {
  mode: TicketPrinterMode
  paper: TicketPaper
  /** Corta el papel al terminar (solo RawBT: el navegador no sabe cortar). */
  cut: boolean
  /** Facturas, recibos y cierres de caja: en hoja (carta / media carta) o en tirilla. */
  documents: 'sheet' | 'ticket'
}

const STORAGE_KEY = 'pos.ticketPrinter'
const DEFAULTS: TicketPrinterSettings = { mode: 'browser', paper: 80, cut: true, documents: 'sheet' }

export const RAWBT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter'

export const isAndroid = (): boolean => /Android/i.test(navigator.userAgent)

export const loadTicketPrinter = (): TicketPrinterSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<TicketPrinterSettings> | null
    return {
      mode: saved?.mode === 'rawbt' ? 'rawbt' : 'browser',
      paper: saved?.paper === 58 ? 58 : 80,
      cut: saved?.cut ?? DEFAULTS.cut,
      documents: saved?.documents === 'ticket' ? 'ticket' : 'sheet',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export const saveTicketPrinter = (settings: TicketPrinterSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Without storage (private mode) the choice lasts until the page reloads.
  }
}

/**
 * Characters per line. A thermal printer's standard font fits 32 on 58 mm
 * paper and 48 on 80 mm; 42 is used on 80 mm because many printers sold as
 * 80 mm print only 72 mm (42 columns), and on a 48-column one the ticket
 * just keeps a margin. The browser keeps its 38 columns on 80 mm.
 */
export const ticketColumns = (settings = loadTicketPrinter()): number =>
  settings.paper === 58 ? 32 : settings.mode === 'rawbt' ? 42 : 38

// ===== ESC/POS =====

// Code page 850 (multilingual Latin-1), which Epson-compatible printers
// select with ESC t 2: the Spanish letters and signs a ticket uses.
const CP850: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, '¿': 0xa8, '¡': 0xad, '°': 0xf8, 'º': 0xa7, 'ª': 0xa6, '·': 0xfa,
  '×': 0x9e,
}

// Signs the documents use that code page 850 lacks, as the closest ASCII.
const ASCII: Record<string, string> = { '—': '-', '–': '-', '−': '-', '→': '>', '…': '.', '“': '"', '”': '"', '‘': "'", '’': "'" }

const encodeChar = (char: string): number[] => {
  const code = char.charCodeAt(0)
  if (code >= 0x20 && code < 0x7f) return [code]
  if (char === '\n') return [0x0a]
  const mapped = CP850[char]
  if (mapped !== undefined) return [mapped]
  const ascii = ASCII[char]
  if (ascii !== undefined) return [ascii.charCodeAt(0)]
  // Any other accented letter goes without its accent; anything else as "?".
  const plain = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return plain && plain.charCodeAt(0) < 0x7f ? [plain.charCodeAt(0)] : [0x3f]
}

const ESC = 0x1b
const GS = 0x1d

/**
 * The ticket text as ESC/POS bytes: reset, code page 850, the lines, feed and
 * (optionally) a partial cut. A form feed (`\f`) between documents ends one
 * ticket and starts the next, so each comes out on its own.
 */
export const escposTicket = (text: string, cut: boolean): Uint8Array => {
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 2]
  // GS V 66 n feeds up to the cutter and cuts; without a cut, feed enough to tear it off.
  const end = cut ? [GS, 0x56, 66, 3] : [ESC, 0x64, 5]
  text.replace(/\r/g, '').split('\f').forEach(ticket => {
    for (const char of ticket.replace(/^\n+|\n+$/g, '')) bytes.push(...encodeChar(char))
    bytes.push(0x0a, ...end)
  })
  return Uint8Array.from(bytes)
}

const base64 = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

/**
 * RawBT receives the bytes in an Android intent. Without the app, Chrome
 * opens its page in Play Store.
 */
export const rawbtIntentUrl = (bytes: Uint8Array): string =>
  `intent:base64,${base64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`

// ===== Print jobs =====

export interface TicketJob {
  title: string
  text: string
  logoUrl?: string | null
}

export interface TicketPrint {
  /** Prints the ticket once its data arrived. */
  fill: (job: TicketJob) => void
  /** The data never came: closes what the click opened. */
  cancel: () => void
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ticketHtml = (job: TicketJob, settings: TicketPrinterSettings): string => {
  const logo = resolveImageUrl(job.logoUrl)
  return `<html><head><meta charset="utf-8"><title>${escapeHtml(job.title)}</title>` +
    // Chrome prints its own date and title line in the page margin when its
    // dialog has headers on: no page margin, the ticket keeps its own padding.
    '<style id="page-size">@page { margin: 0; }</style>' +
    `<style>body{font-family:monospace;font-size:${settings.paper === 58 ? 11 : 12}px;white-space:pre;` +
    `width:${settings.paper}mm;margin:0 auto;padding:2mm}` +
    '.logo{display:block;max-width:100%;max-height:48px;margin:0 auto 6px}' +
    '.ticket+.ticket{break-before:page;margin-top:16px;border-top:1px dashed #999;padding-top:8px}</style>' +
    '</head><body>' +
    (logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="">` : '') +
    // Several documents: each on its own page (a cut on the paper roll).
    job.text.split('\f').map(text => `<div class="ticket">${escapeHtml(text.replace(/^\n+/, ''))}</div>`).join('') +
    '</body></html>'
}

/** Calls `print` when the window's logo loaded or failed, five seconds at most: printing earlier prints it blank. */
const printAfterImages = (win: Window, print: () => void) => {
  const image = win.document.images[0]
  if (!image || image.complete) {
    print()
    return
  }
  let printed = false
  const once = () => {
    if (printed) return
    printed = true
    print()
  }
  image.addEventListener('load', once)
  image.addEventListener('error', once)
  win.setTimeout(once, 5000)
}

/** Desktop: its own window, opened in the click (browsers block it after waiting for the server). */
const windowPrint = (settings: TicketPrinterSettings, onBlocked: () => void): TicketPrint | null => {
  const win = window.open('', '_blank', 'width=420,height=650')
  if (!win) {
    onBlocked()
    return null
  }
  win.document.write('<html><body style="font-family:monospace;padding:8px">Generando…</body></html>')
  return {
    fill: job => {
      win.document.open()
      win.document.write(ticketHtml(job, settings))
      win.document.close()
      win.focus()
      printAfterImages(win, () => win.print())
    },
    cancel: () => win.close(),
  }
}

/** Android: a hidden frame in the same page, so the print dialog opens over the app instead of a tab. */
const framePrint = (settings: TicketPrinterSettings): TicketPrint => ({
  fill: job => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.setAttribute('data-ticket-print', '')
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;height:650px;border:0'
    document.body.append(frame)
    const win = frame.contentWindow!
    win.document.open()
    win.document.write(ticketHtml(job, settings))
    win.document.close()
    const remove = () => window.setTimeout(() => frame.remove(), 1000)
    win.addEventListener('afterprint', remove)
    // Some Android browsers never fire afterprint: the frame goes anyway.
    window.setTimeout(() => frame.remove(), 120_000)
    printAfterImages(win, () => {
      win.focus()
      win.print()
    })
  },
  cancel: () => {},
})

/**
 * Chrome only hands an intent to another app inside a recent tap. When the
 * server took long enough for that tap to expire, the caller gets `send` to
 * offer as a button ("Enviar a la impresora"): its tap delivers it.
 */
const rawbtPrint = (settings: TicketPrinterSettings, onNeedsTap: (send: () => void) => void): TicketPrint => ({
  fill: job => {
    const url = rawbtIntentUrl(escposTicket(job.text, settings.cut))
    // A link's click, like following one: Chrome hands the intent to RawBT.
    const send = () => {
      const link = document.createElement('a')
      link.href = url
      link.click()
    }
    const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation
    if (activation && !activation.isActive) onNeedsTap(send)
    else send()
  },
  cancel: () => {},
})

/**
 * A ticket waiting for a tap to reach RawBT, for pages without a message of
 * their own: TicketSendPrompt (in App.vue) shows its button.
 */
export const pendingTicketSend = shallowRef<(() => void) | null>(null)

export interface StartTicketOptions {
  /** The browser blocked the print window (desktop). */
  onBlocked: () => void
  /** RawBT needs a fresh tap: show a button that runs `send`. By default, TicketSendPrompt. */
  onNeedsTap?: (send: () => void) => void
}

/**
 * Starts printing a ticket in the click that asked for it; `fill` it when its
 * data arrives. Null when the browser blocked the print window.
 */
export const startTicketPrint = (options: StartTicketOptions): TicketPrint | null => {
  const settings = loadTicketPrinter()
  const onNeedsTap = options.onNeedsTap ?? (send => { pendingTicketSend.value = send })
  if (settings.mode === 'rawbt') return rawbtPrint(settings, onNeedsTap)
  return isAndroid() ? framePrint(settings) : windowPrint(settings, options.onBlocked)
}
