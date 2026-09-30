<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-1">Finanzas</h1>
        <p class="text-body-1 text-medium-emphasis mb-4">
          Estado de resultados y balance de tu negocio
        </p>
      </v-col>
    </v-row>

    <v-row>
      <!-- Estado de resultados -->
      <v-col cols="12" md="7">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Estado de resultados</h2>
            <v-spacer />
            <DateField
              v-model="from"
              label="Desde"
              density="compact"
              hide-details
              class="mr-2"
              max-width="160"
            />
            <DateField
              v-model="to"
              label="Hasta"
              density="compact"
              hide-details
              class="mr-2"
              max-width="160"
            />
            <v-btn color="primary" :loading="loadingIncome" aria-label="Ver el estado de resultados de esas fechas" @click="loadIncome">
              <v-icon>mdi-magnify</v-icon>
            </v-btn>
          </div>

          <v-table v-if="income" density="comfortable">
            <tbody>
              <tr>
                <td>Ventas</td>
                <td class="text-right font-weight-medium">{{ money(income.sales) }}</td>
              </tr>
              <tr>
                <td class="pl-8 text-medium-emphasis">(−) Costo de ventas (kardex)</td>
                <td class="text-right">{{ money(income.cost_of_sales) }}</td>
              </tr>
              <tr class="bg-surface-light">
                <td class="font-weight-bold">Utilidad bruta</td>
                <td class="text-right font-weight-bold">
                  {{ money(income.gross_profit) }}
                  <span class="text-caption text-medium-emphasis ml-1">({{ income.gross_margin }}%)</span>
                </td>
              </tr>
              <tr>
                <td class="pl-8 text-medium-emphasis">(−) Gastos operativos</td>
                <td class="text-right">{{ money(income.operating_expenses) }}</td>
              </tr>
              <tr v-for="e in income.expenses_by_category" :key="e.category">
                <td class="pl-12 text-caption text-medium-emphasis">{{ e.category }}</td>
                <td class="text-right text-caption text-medium-emphasis">{{ money(e.total) }}</td>
              </tr>
              <tr v-if="income.other_income">
                <td class="pl-8 text-medium-emphasis">(+) Otros ingresos</td>
                <td class="text-right">{{ money(income.other_income) }}</td>
              </tr>
              <tr v-if="income.other_expenses">
                <td class="pl-8 text-medium-emphasis">(−) Otros egresos</td>
                <td class="text-right">{{ money(income.other_expenses) }}</td>
              </tr>
              <tr :class="income.net_profit >= 0 ? 'bg-success-container' : 'bg-error-container'">
                <td class="font-weight-bold">Utilidad neta</td>
                <td class="text-right font-weight-bold" :class="income.net_profit >= 0 ? 'text-success' : 'text-error'">
                  {{ money(income.net_profit) }}
                  <span class="text-caption text-medium-emphasis ml-1">({{ income.net_margin }}%)</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>

      <!-- Balance -->
      <v-col cols="12" md="5">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Balance</h2>
            <v-spacer />
            <span v-if="balance" class="text-caption text-medium-emphasis">al {{ formatDay(balance.as_of) }}</span>
          </div>

          <v-table v-if="balance" density="comfortable">
            <tbody>
              <tr class="bg-surface-light">
                <td class="font-weight-bold" colspan="2">Activos</td>
              </tr>
              <tr>
                <td class="pl-8">Caja (cobrado − pagado)</td>
                <td class="text-right">{{ money(balance.assets.cash) }}</td>
              </tr>
              <tr>
                <td class="pl-8">Inventario valorizado (costo promedio)</td>
                <td class="text-right">{{ money(balance.assets.inventory) }}</td>
              </tr>
              <tr v-if="balance.assets.uncosted_stock?.length">
                <td colspan="2" class="py-2">
                  <v-alert type="warning" variant="tonal" density="compact" class="text-body-2">
                    Estos productos tienen existencias pero su costo en el kardex es $0, así que no suman al inventario:
                    <strong>{{ uncostedLabel }}</strong>.
                    Para valorizarlos, en el Kardex sácalos con un ajuste (AJ) y vuelve a entrarlos con su costo.
                  </v-alert>
                </td>
              </tr>
              <tr>
                <td class="font-weight-medium">Total activos</td>
                <td class="text-right font-weight-medium">{{ money(balance.assets.total) }}</td>
              </tr>
              <tr class="bg-surface-light">
                <td class="font-weight-bold" colspan="2">Pasivos</td>
              </tr>
              <tr>
                <td class="pl-8">Cuentas por pagar (deudas)</td>
                <td class="text-right">{{ money(balance.liabilities.accounts_payable) }}</td>
              </tr>
              <tr v-if="balance.liabilities.loans">
                <td class="pl-8">Préstamos por pagar</td>
                <td class="text-right">{{ money(balance.liabilities.loans) }}</td>
              </tr>
              <tr :class="balance.equity >= 0 ? 'bg-success-container' : 'bg-error-container'">
                <td class="font-weight-bold">Patrimonio</td>
                <td class="text-right font-weight-bold" :class="balance.equity >= 0 ? 'text-success' : 'text-error'">
                  {{ money(balance.equity) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Movimientos manuales de dinero -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-1">
            <h2 class="text-h6">Movimientos manuales</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" @click="openMovementDialog()">
              Registrar movimiento
            </LockableButton>
          </div>
          <p class="text-caption text-medium-emphasis mb-3">
            Plata que entra o sale sin ser una venta ni una compra: aportes tuyos,
            retiros, préstamos u otros ingresos y egresos sueltos.
          </p>

          <v-table density="compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th class="text-right">Monto</th>
                <th>Afecta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movement in movements" :key="movement.id">
                <td class="text-no-wrap">{{ formatDay(movement.occurred_at) }}</td>
                <td>
                  <v-chip size="x-small" :color="movement.cash_effect >= 0 ? 'success' : 'error'" variant="tonal">
                    {{ movement.kind_label }}
                  </v-chip>
                </td>
                <td>{{ movement.concept }}</td>
                <td class="text-right" :class="movement.cash_effect >= 0 ? 'text-success' : 'text-error'">
                  {{ movement.cash_effect >= 0 ? '+' : '−' }}{{ money(Math.abs(movement.cash_effect)) }}
                </td>
                <td class="text-caption text-medium-emphasis">{{ effectLabel(movement) }}</td>
                <td class="text-right">
                  <v-btn icon size="x-small" variant="text" :disabled="isReadOnly" :aria-label="`Editar el movimiento ${movement.concept}`" @click="openMovementDialog(movement)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn icon size="x-small" variant="text" color="error" :disabled="isReadOnly" :aria-label="`Eliminar el movimiento ${movement.concept}`" @click="removeMovement(movement)">
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
              <tr v-if="!movements.length">
                <td colspan="6" class="text-center text-medium-emphasis py-4">
                  Todavía no has registrado movimientos manuales
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: registrar / editar movimiento -->
    <v-dialog v-model="movementDialog" max-width="540" persistent>
      <v-card>
        <v-card-title>{{ editingMovement ? 'Editar movimiento' : 'Registrar movimiento' }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="movementForm.kind"
            :items="kinds"
            item-title="label"
            item-value="value"
            label="Tipo de movimiento"
          />
          <v-alert
            v-if="selectedKind"
            :type="selectedKind.affects_profit ? 'info' : 'warning'"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ kindExplanation }}
          </v-alert>

          <v-text-field
            v-model="movementForm.concept"
            label="Concepto"
            placeholder="Ej: Aporte para comprar la nevera"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="movementForm.amount"
                label="Monto"
                type="number"
                prefix="$"
              />
            </v-col>
            <v-col cols="6">
              <DateField v-model="movementForm.occurred_at" label="Fecha" />
            </v-col>
          </v-row>
          <v-select
            v-model="movementForm.payment_method"
            :items="[
              { value: 'cash', title: 'Efectivo' },
              { value: 'transfer', title: 'Transferencia' },
              { value: 'card', title: 'Tarjeta' },
              { value: 'other', title: 'Otro' },
            ]"
            item-title="title"
            item-value="value"
            label="Medio de pago"
          />
          <v-textarea v-model="movementForm.notes" label="Notas (opcional)" rows="2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="movementDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingMovement" @click="saveMovement">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDay, todayIso, toIsoDate } from '@/utils/dates'
import { errorMessage } from '@/utils/errors'
import { computed, onMounted, ref } from 'vue'
import kardexService, {
  type BalanceReport,
  type FinancialMovement,
  type IncomeStatement,
  type MovementKind,
  type MovementKindOption,
} from '../services/kardexService'
import LockableButton from '../components/LockableButton.vue'
import DateField from '../components/DateField.vue'
import { useReadOnly } from '../composables/useReadOnly'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const loadingIncome = ref(false)
const income = ref<IncomeStatement | null>(null)
const balance = ref<BalanceReport | null>(null)

const uncostedLabel = computed(() =>
  (balance.value?.assets.uncosted_stock ?? [])
    .map(p => `${p.name} (${p.quantity.toLocaleString('es-CO')}${p.unit ? ' ' + p.unit : ''})`)
    .join(', '),
)

// Rango por defecto: el mes actual.
const now = new Date()
const from = ref(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
const to = ref(todayIso())

const snackbar = ref({ show: false, text: '', color: 'error' })
const notify = (text: string, color: 'success' | 'error' = 'error') => {
  snackbar.value = { show: true, text, color }
}


const loadIncome = async () => {
  loadingIncome.value = true
  try {
    income.value = await kardexService.incomeStatement(from.value, to.value)
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible cargar el estado de resultados. Inténtalo de nuevo.'))
  } finally {
    loadingIncome.value = false
  }
}

// --- Movimientos manuales de dinero ---
const movements = ref<FinancialMovement[]>([])
const kinds = ref<MovementKindOption[]>([])
const movementDialog = ref(false)
const savingMovement = ref(false)
const editingMovement = ref<FinancialMovement | null>(null)

const emptyMovement = () => ({
  kind: 'income' as MovementKind,
  concept: '',
  amount: 0,
  occurred_at: todayIso(),
  payment_method: 'cash',
  notes: '',
})
const movementForm = ref(emptyMovement())

const selectedKind = computed(() => kinds.value.find(k => k.value === movementForm.value.kind))

const kindExplanation = computed(() => {
  const kind = selectedKind.value
  if (!kind) return ''
  if (kind.affects_debt) {
    return kind.value === 'loan_received'
      ? 'Entra plata a la caja y sube tu deuda. No cuenta como utilidad: un préstamo no es ganancia.'
      : 'Sale plata de la caja y baja tu deuda. No afecta la utilidad.'
  }
  if (!kind.affects_profit) {
    return 'Mueve la caja pero no es utilidad ni pérdida: es plata tuya entrando o saliendo del negocio.'
  }
  return 'Entra o sale de la caja y sí afecta la utilidad del periodo.'
})

const effectLabel = (movement: FinancialMovement): string => {
  const parts: string[] = []
  if (movement.profit_effect !== 0) parts.push('utilidad')
  if (movement.debt_effect !== 0) parts.push('deuda')
  return parts.length ? `Caja y ${parts.join(' y ')}` : 'Solo caja'
}

const loadMovements = async () => {
  try {
    const data = await kardexService.movements()
    movements.value = data.movements
    kinds.value = data.kinds
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible cargar los movimientos. Inténtalo de nuevo.'))
  }
}

const openMovementDialog = (movement?: FinancialMovement) => {
  editingMovement.value = movement ?? null
  movementForm.value = movement
    ? {
        kind: movement.kind,
        concept: movement.concept,
        amount: movement.amount,
        occurred_at: movement.occurred_at,
        payment_method: movement.payment_method,
        notes: movement.notes || '',
      }
    : emptyMovement()
  movementDialog.value = true
}

const saveMovement = async () => {
  if (!movementForm.value.concept || !movementForm.value.amount) {
    notify('Completa el concepto y el monto')
    return
  }

  savingMovement.value = true
  try {
    const payload = { ...movementForm.value, notes: movementForm.value.notes || null }

    if (editingMovement.value) {
      await kardexService.updateMovement(editingMovement.value.id, payload)
    } else {
      await kardexService.createMovement(payload)
    }

    movementDialog.value = false
    notify(editingMovement.value ? 'Movimiento actualizado' : 'Movimiento registrado', 'success')
    await refreshAll()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible guardar el movimiento. Inténtalo de nuevo.'))
  } finally {
    savingMovement.value = false
  }
}

const removeMovement = async (movement: FinancialMovement) => {
  if (!window.confirm(`¿Eliminar "${movement.concept}"?`)) return

  try {
    await kardexService.deleteMovement(movement.id)
    notify('Movimiento eliminado', 'success')
    await refreshAll()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible eliminar el movimiento. Inténtalo de nuevo.'))
  }
}

/** Un movimiento cambia caja, utilidad y deuda: se recarga todo. */
const refreshAll = async () => {
  await Promise.all([loadMovements(), loadIncome(), loadBalance()])
}

const loadBalance = async () => {
  try {
    balance.value = await kardexService.balance()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible cargar el balance. Inténtalo de nuevo.'))
  }
}

onMounted(async () => {
  await Promise.all([loadIncome(), loadBalance(), loadMovements()])
})
</script>
