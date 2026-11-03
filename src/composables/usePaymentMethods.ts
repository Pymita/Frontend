import { ref } from 'vue'
import salesService, { type PaymentDocument, type PaymentMethod, type PaymentMethodRow } from '../services/salesService'
import { useAuthStore } from '../stores/auth'
import { errorMessage } from '../utils/errors'
import { saleMethodLabels } from '../utils/labels'

/**
 * The company's payment methods, shared by a page and everything it opens:
 * the pickers of its dialogs, the labels of its lists and its printed
 * documents. A page asks once when it opens (`fresh`) and its dialogs and
 * panels reuse that answer. An admin also gets the inactive rows (`all=1`)
 * to edit them; anyone gets `labels`, the name of every key the company's
 * history holds (inactive and deleted methods too).
 */
const methods = ref<PaymentMethodRow[]>([])
const labels = ref<Record<PaymentMethod, string>>({})
const loadError = ref('')
let request: Promise<void> | null = null
let sequence = 0

const byPosition = (a: PaymentMethodRow, b: PaymentMethodRow) => a.position - b.position || a.id - b.id

const fetchMethods = async (all: boolean): Promise<void> => {
  const mine = ++sequence
  try {
    const answer = await salesService.paymentMethods({ all })
    if (mine !== sequence) return
    methods.value = [...answer.methods].sort(byPosition)
    labels.value = answer.labels
    loadError.value = ''
  } catch (error) {
    if (mine === sequence) loadError.value = errorMessage(error, 'No fue posible cargar las formas de pago. Inténtalo de nuevo.')
  }
}

/**
 * How a method key reads: the company's name for it, else the legacy name
 * (`legacy` first when a page passes its own, as Gastos does), else the key
 * itself. History keeps the key of a method renamed or deleted since.
 */
export const paymentMethodLabel = (key: string | null | undefined, legacy?: Record<string, string>): string => {
  if (!key) return ''
  return methods.value.find(method => method.key === key)?.name ?? legacy?.[key] ?? labels.value[key] ?? saleMethodLabels[key] ?? key
}

/** Several methods of one record, "Efectivo + Nequi". */
export const paymentMethodsLabel = (keys: string[]): string => keys.map(key => paymentMethodLabel(key)).join(' + ')

/** What a cash close (or the totals of a period of closes) carries about its methods. */
interface CloseNames {
  method_labels?: Record<PaymentMethod, string>
  cash_methods?: PaymentMethod[]
}

/**
 * A method of a cash close by the name the close froze with it, so a later
 * rename never rewrites a closed shift; a close frozen before names were
 * kept reads as any other key.
 */
export const closeMethodLabel = (close: CloseNames | null | undefined, key: string): string =>
  close?.method_labels?.[key] ?? paymentMethodLabel(key)

/**
 * Where the cash of a close came in by: "en efectivo", or the drawer's
 * methods by name when the company marked others as going into the drawer
 * ("en Efectivo y Caja menor").
 */
export const drawerText = (close: CloseNames | null | undefined): string => {
  const names = (close?.cash_methods?.length ? close.cash_methods : ['cash']).map(key => closeMethodLabel(close, key))
  if (names.length === 1 && names[0] === 'Efectivo') return 'en efectivo'
  return `en ${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0]}`
}

/** The active methods allowed for a document, in the company's order; without one, every active method (Gastos). */
export const methodsFor = (document?: PaymentDocument): PaymentMethodRow[] =>
  methods.value.filter(method => method.active && (!document || method.documents.includes(document)))

/**
 * The items of a picker. `keep` is the value the record already has: a
 * method deactivated or not allowed since still reads by its name instead of
 * as its key (saving it again gets the API's message on what to do).
 */
export const methodOptions = (
  document?: PaymentDocument,
  keep?: string | null,
  legacy?: Record<string, string>,
): { value: string; title: string }[] => {
  const items = methodsFor(document).map(method => ({ value: method.key, title: method.name }))
  if (keep && !items.some(item => item.value === keep)) items.push({ value: keep, title: paymentMethodLabel(keep, legacy) })
  return items
}

/** Sorts method keys as the company orders its methods; keys it no longer has go last, as they came. */
export const compareMethodKeys = (a: string, b: string): number => {
  const rank = (key: string) => {
    const index = methods.value.findIndex(method => method.key === key)
    return index < 0 ? methods.value.length : index
  }
  return rank(a) - rank(b)
}

export function usePaymentMethods({ fresh = false }: { fresh?: boolean } = {}) {
  const authStore = useAuthStore()
  const load = () => (request = fetchMethods(authStore.isAdmin))
  if (fresh || !request) load()
  return {
    methods,
    loadError,
    /** Resolves once the list in flight arrived (or failed: `loadError` says why). */
    ready: (): Promise<void> => request ?? load(),
    reload: load,
  }
}
