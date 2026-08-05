/**
 * Etiquetas en español para los enums del API (que ahora viajan en inglés).
 * Los valores de datos son ingleses; los textos visibles para el usuario, españoles.
 */

// ===== Pedidos =====
export const paymentStatusLabels: Record<string, string> = {
  pending: 'Por pagar',
  paid: 'Pagado',
  partial: 'Pago parcial',
}

export const paymentStatusColors: Record<string, string> = {
  pending: 'error',
  partial: 'warning',
  paid: 'success',
}

export const orderStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const itemStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
}

// ===== Mesas =====
export const tableStatusLabels: Record<string, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
}

// ===== Productos =====
export const productTypeLabels: Record<string, string> = {
  raw_material: 'Materia Prima',
  intermediate: 'Intermedio',
  final: 'Final',
}

// ===== Gastos =====
export const expenseCategoryTypeLabels: Record<string, string> = {
  inventory_purchase: 'Compra Inventario',
  variable_expense: 'Variable',
  fixed_expense: 'Fijo',
  administrative_expense: 'Administrativo',
  payroll: 'Nómina',
  taxes: 'Impuestos',
}

export const orderPaymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  credit_card: 'Tarjeta crédito',
  debit_card: 'Tarjeta débito',
  transfer: 'Transferencia',
  other: 'Otro',
}

export const expensePaymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit: 'Crédito',
}

export const label = (map: Record<string, string>, value?: string | null): string => {
  if (!value) return ''
  return map[value] ?? value
}
