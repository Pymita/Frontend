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

/** Cómo paga una mesa (mismo orden y nombres que OrderPayment::METHODS). */
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
 * How a sale was charged: the methods money comes in by, plus "A crédito"
 * (OrderPayment::CREDIT), which brings none. Only for reading a sale; the
 * selects where money is received keep `orderPaymentMethodLabels`.
 */
export const saleMethodLabels: Record<string, string> = {
  ...orderPaymentMethodLabels,
  credit: 'A crédito',
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
}

/** Enums that are states: their cells read as a chip of the state's role. */
export const enumColors: Record<string, Record<string, string>> = {
  stock_status: stockStatusColors,
  document_status: recurringInvoiceStatusColors,
  payment_status: paymentStatusColors,
}

/** Opciones de un v-select a partir de un mapa de etiquetas, en su orden. */
export const options = (map: Record<string, string>): { value: string; title: string }[] =>
  Object.entries(map).map(([value, title]) => ({ value, title }))

export const label = (map: Record<string, string>, value?: string | null): string => {
  if (!value) return ''
  return map[value] ?? value
}

/** Un pedido nace con "Cliente" cuando nadie dio su nombre: es un consumidor final. */
export const customerLabel = (name?: string | null): string => {
  const trimmed = name?.trim()
  return trimmed && trimmed !== 'Cliente' ? trimmed : 'Consumidor final'
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
  const who = order.dining_table?.display_name || (customer !== 'Consumidor final' ? customer : '')
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
