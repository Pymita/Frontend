<template>
  <div class="d-flex align-center flex-wrap ga-2">
    <template v-if="session">
      <v-chip color="info" variant="tonal" prepend-icon="mdi-cash-register" data-testid="cash-open-chip">
        Caja abierta desde {{ formatTime(session.opened_at) }}
      </v-chip>
      <LockableButton variant="outlined" color="primary" icon="mdi-lock-outline" @click="openCloseDialog">
        Cerrar caja
      </LockableButton>
    </template>
    <LockableButton v-else-if="loaded" variant="outlined" color="primary" icon="mdi-cash-register" @click="openDialog = true">
      Abrir caja
    </LockableButton>

    <!-- Apertura: con cuánto efectivo arranca el cajón -->
    <v-dialog v-model="openDialog" max-width="420">
      <v-card>
        <v-card-title>Abrir caja</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Cuenta el efectivo con el que arranca el cajón (la base para dar vueltas). Puede ser 0.
          </p>
          <v-text-field
            v-model.number="openingAmount"
            label="Base en efectivo"
            type="number"
            min="0"
            prefix="$"
            autofocus
          />
          <v-text-field v-model="openingNotes" label="Nota (opcional)" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="openDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!(openingAmount >= 0)" @click="openRegister">Abrir caja</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cierre: lo cobrado por medio, el efectivo esperado y el conteo -->
    <v-dialog v-model="closeDialog" max-width="560">
      <v-card v-if="session">
        <v-card-title>Cerrar caja</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Abierta por {{ session.opened_by || '—' }} a las {{ formatTime(session.opened_at) }}
          </p>

          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>Medio</th>
                <th class="text-end">Cobros</th>
                <th class="text-end">Recaudado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in methodRows" :key="entry.method">
                <td>{{ entry.label }}</td>
                <td class="text-end tabular-nums">{{ entry.count }}</td>
                <td class="text-end tabular-nums">{{ money(entry.amount) }}</td>
              </tr>
              <tr v-if="!methodRows.length">
                <td colspan="3" class="text-medium-emphasis">Aún no hay cobros en este turno.</td>
              </tr>
            </tbody>
          </v-table>

          <div class="mb-4">
            <div class="d-flex justify-space-between"><span>Base</span><span class="tabular-nums">{{ money(session.opening_amount) }}</span></div>
            <div class="d-flex justify-space-between"><span>+ Cobros en efectivo (con propinas)</span><span class="tabular-nums">{{ money(session.summary.cash_sales) }}</span></div>
            <div v-if="session.summary.cash_recurring" class="d-flex justify-space-between">
              <span>+ Abonos de cuotas en efectivo</span><span class="tabular-nums">{{ money(session.summary.cash_recurring) }}</span>
            </div>
            <div v-if="session.summary.cash_expenses" class="d-flex justify-space-between">
              <span>− Gastos pagados en efectivo</span><span class="tabular-nums">{{ money(session.summary.cash_expenses) }}</span>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex justify-space-between font-weight-bold">
              <span>Efectivo que debería haber</span><span class="tabular-nums" data-testid="cash-expected">{{ money(session.expected_cash) }}</span>
            </div>
          </div>

          <v-text-field
            v-model.number="countedCash"
            label="Efectivo contado"
            type="number"
            min="0"
            prefix="$"
            hint="Cuenta los billetes y monedas del cajón"
            persistent-hint
          />
          <p v-if="typeof countedCash === 'number'" class="text-body-1 font-weight-bold mt-2" :class="differenceClass" data-testid="cash-difference">
            {{ differenceText }}
          </p>
          <v-text-field v-model="closingNotes" label="Nota (opcional)" class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="countedCash === null || countedCash < 0" @click="closeRegister">
            Cerrar caja
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LockableButton from './LockableButton.vue'
import salesService, { PAYMENT_METHOD_LABELS, type CashSession, type PaymentMethod } from '../services/salesService'
import { errorMessage } from '../utils/errors'

const session = ref<CashSession | null>(null)
const loaded = ref(false)
const saving = ref(false)
const openDialog = ref(false)
const closeDialog = ref(false)
const openingAmount = ref<number>(0)
const openingNotes = ref('')
const countedCash = ref<number | null>(null)
const closingNotes = ref('')
const snackbar = ref({ show: false, text: '', color: 'success' })

const money = (value: number | null | undefined): string =>
  '$' + Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const methodRows = computed(() =>
  Object.entries(session.value?.summary.by_method ?? {})
    .filter(([, totals]) => totals.count > 0)
    .map(([method, totals]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
      count: totals.count,
      amount: totals.amount,
    })),
)

const difference = computed(() => Number(countedCash.value ?? 0) - Number(session.value?.expected_cash ?? 0))
const differenceText = computed(() => {
  const value = difference.value
  if (Math.abs(value) < 0.01) return 'Cuadra: el efectivo está completo'
  return value > 0 ? `Sobran ${money(value)}` : `Faltan ${money(Math.abs(value))}`
})
// Sobrante o faltante es una cifra con signo: verde o rojo.
const differenceClass = computed(() =>
  Math.abs(difference.value) < 0.01 ? 'text-success' : difference.value > 0 ? 'text-success' : 'text-error',
)

const notify = (text: string, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

const load = async () => {
  try {
    session.value = await salesService.currentCashSession()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo consultar la caja.'), 'error')
  } finally {
    loaded.value = true
  }
}

const openRegister = async () => {
  saving.value = true
  try {
    session.value = await salesService.openCashSession(Number(openingAmount.value || 0), openingNotes.value)
    openDialog.value = false
    openingNotes.value = ''
    notify('Caja abierta')
  } catch (error) {
    notify(errorMessage(error, 'No se pudo abrir la caja.'), 'error')
  } finally {
    saving.value = false
  }
}

// Al abrir el cierre se trae el turno al día: pudo cobrarse algo más.
const openCloseDialog = async () => {
  countedCash.value = null
  closingNotes.value = ''
  await load()
  closeDialog.value = true
}

const closeRegister = async () => {
  if (!session.value) return
  saving.value = true
  try {
    const { message } = await salesService.closeCashSession(session.value.id, Number(countedCash.value), closingNotes.value)
    closeDialog.value = false
    session.value = null
    notify(message, Math.abs(difference.value) < 0.01 ? 'success' : 'warning')
  } catch (error) {
    notify(errorMessage(error, 'No se pudo cerrar la caja.'), 'error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
