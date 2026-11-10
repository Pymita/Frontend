/**
 * Etiquetas en español para los enums del API (que ahora viajan en inglés).
 * Los valores de datos son ingleses; los textos visibles para el usuario, españoles.
 */
import { formatTime } from './dates'

// ===== Pedidos =====
export const paymentStatusLabels: Record<string, string> = {
  pending: 'Por pagar',
  paid: 'Pagado',
  partial: 'Pago parcial',
  // Not an API status: a paid order whose sale went to Cartera (`paymentState()`).
  credit: 'A crédito',
}

export const paymentStatusColors: Record<string, string> = {
  pending: 'error',
  partial: 'warning',
  paid: 'success',
  credit: 'info',
}

export const orderStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

/** Theme role per order status (same map in mobile/src/utils/labels.ts). */
export const orderStatusColors: Record<string, string> = {
  pending: 'warning',
  preparing: 'info',
  ready: 'success',
  delivered: 'secondary',
  cancelled: 'error',
}

/** Who pays a table's time (same texts as TIME_BILLING_LABELS in mobile/src/utils/labels.ts). */
export const timeBillingLabels: Record<string, string> = {
  table: 'Por mesa',
  person: 'Por persona',
}

/** "1 h", "1 h 30 min", "45 min": the minutes of a printed time line. */
export const durationLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** "5 personas", "1 persona" (same as `playersLabel()` in mobile/src/utils/labels.ts). */
export const playersLabel = (players: number): string => `${players} ${players === 1 ? 'persona' : 'personas'}`

export const itemStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
}

// ===== Facturación automática (solo web: la app del mesero no la muestra) =====
export const recurringInvoiceStatusLabels: Record<string, string> = {
  pending: 'Por pagar',
  partial: 'Abonada',
  paid: 'Pagada',
  cancelled: 'Anulada',
}

export const recurringInvoiceStatusColors: Record<string, string> = {
  pending: 'error',
  partial: 'warning',
  paid: 'success',
  cancelled: 'secondary',
}

export const documentKindLabels: Record<string, string> = {
  invoice: 'Factura',
  collection: 'Cuenta de cobro',
  // An order charged "A crédito" in Pedidos: what the customer owes for it.
  credit_sale: 'Venta a crédito',
  // What a customer already owed before Servify: never a sale, only cartera.
  opening_balance: 'Saldo inicial',
}

/** Where a sale in Ventas comes from: an order charged or a document issued. */
export const saleOriginLabels: Record<string, string> = {
  order: 'Pedido',
  recurring: 'Facturación automática',
}

/** Qué pasa con cada fila del Excel de clientes. */
export const customerImportStatusLabels: Record<string, string> = {
  valid: 'Se crea',
  created: 'Creado',
  skipped: 'Se salta',
  error: 'Con error',
}

/** Each row of the opening balances Excel; the colors are `customerImportStatusColors`. */
export const openingBalanceImportStatusLabels: Record<string, string> = {
  valid: 'Se registra',
  created: 'Registrado',
  skipped: 'Se salta',
  error: 'Con error',
}

export const customerImportStatusColors: Record<string, string> = {
  valid: 'info',
  created: 'success',
  skipped: 'secondary',
  error: 'error',
}

// ===== Mesas =====
export const tableStatusLabels: Record<string, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
}

/** Theme role per table status (same map in mobile/src/utils/labels.ts). */
export const tableStatusColors: Record<string, string> = {
  available: 'success',
  occupied: 'primary',
  reserved: 'warning',
}

type ReservedTable = { reserved_for?: string | null; reserved_at?: string | null }

/** "Ana · 08:00 p. m.": who and when a reserved table waits for, only the parts it has (same in mobile/src/utils/labels.ts). */
export const tableReservation = (table: ReservedTable): string =>
  [table.reserved_for, table.reserved_at ? formatTime(table.reserved_at) : null].filter(Boolean).join(' · ')

/** "Reservada · Ana · 08:00 p. m.": a reserved table where it cannot be picked. */
export const reservedTableLabel = (table: ReservedTable): string =>
  [tableStatusLabels.reserved, tableReservation(table)].filter(Boolean).join(' · ')

/** "Reservada a nombre de Ana para las 08:00 p. m.", with the parts it has (same in mobile/src/utils/labels.ts). */
export const reservationSentence = (table: ReservedTable): string => {
  const name = table.reserved_for ? ` a nombre de ${table.reserved_for}` : ''
  const time = table.reserved_at ? ` para las ${formatTime(table.reserved_at)}` : ''
  const sentence = `Reservada${name}${time}`
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

// ===== Productos =====
export const productTypeLabels: Record<string, string> = {
  raw_material: 'Materia prima',
  intermediate: 'Intermedio',
  final: 'Final',
}

// ===== Gastos =====
export const expenseCategoryTypeLabels: Record<string, string> = {
  inventory_purchase: 'Compra inventario',
  variable_expense: 'Variable',
  fixed_expense: 'Fijo',
  administrative_expense: 'Administrativo',
  payroll: 'Nómina',
  taxes: 'Impuestos',
}

/**
 * The legacy names of the seven built-in methods (OrderPayment::METHODS),
 * which the waiter app still offers. Each company now has its own list
 * (`usePaymentMethods`): this map only names a key the company no longer has.
 */
export const orderPaymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  credit_card: 'Tarjeta crédito',
  debit_card: 'Tarjeta débito',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  other: 'Otro',
}

/**
 * How a sale was charged: the legacy methods plus "A crédito"
 * (OrderPayment::CREDIT), which brings no money and is never a method of the
 * company. The fallback of `paymentMethodLabel()`; the selects where money is
 * received offer the company's methods.
 */
export const saleMethodLabels: Record<string, string> = {
  ...orderPaymentMethodLabels,
  credit: 'A crédito',
}

/** Where a company's payment method can be used (`documents`; web only: the waiter app keeps its list). */
export const paymentDocumentLabels: Record<string, string> = {
  sale: 'Ventas',
  receipt: 'Recibos de caja',
  order_abono: 'Abonos a pedidos',
  financial_movement: 'Movimientos financieros',
}

/** The documents asked when a customer is created while charging (Customer::DOCUMENT_TYPES takes more). */
export const customerDocumentTypeLabels: Record<string, string> = {
  CC: 'Cédula de ciudadanía (CC)',
  NIT: 'NIT',
  CE: 'Cédula de extranjería (CE)',
  Pasaporte: 'Pasaporte',
}

/** Régimen tributario de la empresa, como debe leerse en la tirilla. */
export const taxRegimeLabels: Record<string, string> = {
  common: 'Responsable de IVA',
  simplified: 'No responsable de IVA',
  large_taxpayer: 'Gran contribuyente',
}

export const expensePaymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit: 'Crédito',
}

// ===== Informes =====
/** How a product's stock stands at the cut-off in "Productos con saldo". */
export const stockStatusLabels: Record<string, string> = {
  out_of_stock: 'Agotado',
  low: 'Bajo mínimo',
  uncosted: 'Sin costo',
  inactive: 'Inactivo',
}

export const stockStatusColors: Record<string, string> = {
  out_of_stock: 'error',
  low: 'warning',
  uncosted: 'info',
  inactive: 'secondary',
}

/** "Ventas por producto" reads what was sold: the orders' products and the documents' services. */
export const soldOriginLabels: Record<string, string> = {
  order: 'Productos',
  recurring: 'Servicios',
}

/** How old what a customer owes is, by its due date. */
export const debtAgeLabels: Record<string, string> = {
  not_due: 'Por vencer',
  days_1_30: '1–30 días',
  days_31_60: '31–60 días',
  days_61_90: '61–90 días',
  days_90_plus: 'Más de 90 días',
}

export const yesNoLabels: Record<string, string> = {
  yes: 'Sí',
  no: 'No',
}

/** The direction of a kardex movement, as the Kardex Excel writes its "Tipo". */
export const movementTypeLabels: Record<string, string> = {
  in: 'Entrada',
  out: 'Salida',
}

/** Green in, red out: the Kardex's own colors for a movement. */
export const movementTypeColors: Record<string, string> = {
  in: 'success',
  out: 'error',
}

// ===== Contabilidad =====
/** The side an account posts on in the normal entry (`nature` in /accounting/settings). */
export const accountingNatureLabels: Record<string, string> = {
  debit: 'Débito',
  credit: 'Crédito',
}

/** How a template writes its dates (`date_format`), with the example the Excel will read. */
export const accountingDateFormatLabels: Record<string, string> = {
  'd/m/Y': 'dd/mm/aaaa (31/12/2026)',
  'Y-m-d': 'aaaa-mm-dd (2026-12-31)',
  'm/d/Y': 'mm/dd/aaaa (12/31/2026)',
}

/**
 * The label map of each enum a report column names (`enum` in
 * /reports/definitions, `Report::ENUMS` in the API, which labels the Excel
 * with the same texts): the rows carry the keys.
 */
export const enumLabels: Record<string, Record<string, string>> = {
  sale_method: saleMethodLabels,
  sale_origin: saleOriginLabels,
  sold_origin: soldOriginLabels,
  product_type: productTypeLabels,
  stock_status: stockStatusLabels,
  yes_no: yesNoLabels,
  document_kind: documentKindLabels,
  document_status: recurringInvoiceStatusLabels,
  debt_age: debtAgeLabels,
  expense_type: expenseCategoryTypeLabels,
  expense_payment_method: expensePaymentMethodLabels,
  payment_status: paymentStatusLabels,
  movement_type: movementTypeLabels,
}

/** Enums that are states (or a kardex direction): their cells read as a chip of its role. */
export const enumColors: Record<string, Record<string, string>> = {
  stock_status: stockStatusColors,
  document_status: recurringInvoiceStatusColors,
  payment_status: paymentStatusColors,
  movement_type: movementTypeColors,
}

/** Opciones de un v-select a partir de un mapa de etiquetas, en su orden. */
export const options = (map: Record<string, string>): { value: string; title: string }[] =>
  Object.entries(map).map(([value, title]) => ({ value, title }))

export const label = (map: Record<string, string>, value?: string | null): string => {
  if (!value) return ''
  return map[value] ?? value
}

/**
 * The buyer of a sale nobody identified, as the API sends it on receipts and
 * sales: the DIAN's final-consumer NIT, the same for every company
 * (Customer::FINAL_CONSUMER_* in the backend).
 */
export const FINAL_CONSUMER = { name: 'Consumidor final', documentType: 'NIT', document: '222222222222' } as const

/** Un pedido nace con "Cliente" cuando nadie dio su nombre: es un consumidor final. */
export const customerLabel = (name?: string | null): string => {
  const trimmed = name?.trim()
  return trimmed && trimmed !== 'Cliente' ? trimmed : FINAL_CONSUMER.name
}

interface NamedOrder {
  number?: number | null
  dining_table?: { display_name: string } | null
  customer_name?: string | null
  created_at?: string
}

/**
 * Lo que sigue a "pedido" (mismas reglas en mobile/src/utils/labels.ts): su
 * número, "#12", desde el primer cobro. Antes no tiene número (el id es
 * interno y compartido entre empresas): se nombra por su mesa, su cliente o
 * la hora en que entró ("de Mesa 4", "de Ana", "de las 02:30 p. m.").
 */
export const orderReference = (order: NamedOrder): string => {
  if (order.number) return `#${order.number}`
  const customer = customerLabel(order.customer_name)
  const who = order.dining_table?.display_name || (customer !== FINAL_CONSUMER.name ? customer : '')
  if (who) return `de ${who}`
  return order.created_at ? `de las ${formatTime(order.created_at)}` : 'sin cobrar'
}

/** "Pedido #12" o, antes del primer cobro, "Pedido de Mesa 4". */
export const orderLabel = (order: NamedOrder): string => `Pedido ${orderReference(order)}`

/** The key of `paymentStatusLabels` an order reads: a paid order sold on credit is still owed, in Cartera. */
export const paymentState = (order: { payment_status: string; payments?: { payment_method: string }[] | null }): string =>
  order.payment_status === 'paid' && order.payments?.some(payment => payment.payment_method === 'credit')
    ? 'credit'
    : order.payment_status
