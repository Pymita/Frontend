<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-1">Finanzas</h1>
        <p class="text-body-1 text-grey-darken-1 mb-4">
          Estado de resultados y balance de tu negocio
        </p>
      </v-col>
    </v-row>

    <v-row>
      <!-- Estado de resultados -->
      <v-col cols="12" md="7">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Estado de Resultados</h2>
            <v-spacer />
            <v-text-field
              v-model="from"
              type="date"
              label="Desde"
              density="compact"
              hide-details
              class="mr-2"
              style="max-width: 160px"
            />
            <v-text-field
              v-model="to"
              type="date"
              label="Hasta"
              density="compact"
              hide-details
              class="mr-2"
              style="max-width: 160px"
            />
            <v-btn color="primary" :loading="loadingIncome" @click="loadIncome">
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
                <td class="pl-8 text-grey-darken-1">(−) Costo de ventas (kardex)</td>
                <td class="text-right text-error">{{ money(income.cost_of_sales) }}</td>
              </tr>
              <tr class="bg-grey-lighten-4">
                <td class="font-weight-bold">Utilidad bruta</td>
                <td class="text-right font-weight-bold">
                  {{ money(income.gross_profit) }}
                  <span class="text-caption text-grey ml-1">({{ income.gross_margin }}%)</span>
                </td>
              </tr>
              <tr>
                <td class="pl-8 text-grey-darken-1">(−) Gastos operativos</td>
                <td class="text-right text-error">{{ money(income.operating_expenses) }}</td>
              </tr>
              <tr v-for="e in income.expenses_by_category" :key="e.category">
                <td class="pl-12 text-caption text-grey">{{ e.category }}</td>
                <td class="text-right text-caption text-grey">{{ money(e.total) }}</td>
              </tr>
              <tr :class="income.net_profit >= 0 ? 'bg-green-lighten-5' : 'bg-red-lighten-5'">
                <td class="font-weight-bold">Utilidad neta</td>
                <td class="text-right font-weight-bold" :class="income.net_profit >= 0 ? 'text-success' : 'text-error'">
                  {{ money(income.net_profit) }}
                  <span class="text-caption text-grey ml-1">({{ income.net_margin }}%)</span>
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
            <span v-if="balance" class="text-caption text-grey">al {{ balance.as_of }}</span>
          </div>

          <v-table v-if="balance" density="comfortable">
            <tbody>
              <tr class="bg-grey-lighten-4">
                <td class="font-weight-bold" colspan="2">Activos</td>
              </tr>
              <tr>
                <td class="pl-8">Caja (cobrado − pagado)</td>
                <td class="text-right">{{ money(balance.assets.cash) }}</td>
              </tr>
              <tr>
                <td class="pl-8">Cuentas por cobrar</td>
                <td class="text-right">{{ money(balance.assets.accounts_receivable) }}</td>
              </tr>
              <tr>
                <td class="pl-8">Inventario valorizado</td>
                <td class="text-right">{{ money(balance.assets.inventory) }}</td>
              </tr>
              <tr>
                <td class="font-weight-medium">Total activos</td>
                <td class="text-right font-weight-medium">{{ money(balance.assets.total) }}</td>
              </tr>
              <tr class="bg-grey-lighten-4">
                <td class="font-weight-bold" colspan="2">Pasivos</td>
              </tr>
              <tr>
                <td class="pl-8">Cuentas por pagar (deudas)</td>
                <td class="text-right">{{ money(balance.liabilities.accounts_payable) }}</td>
              </tr>
              <tr :class="balance.equity >= 0 ? 'bg-green-lighten-5' : 'bg-red-lighten-5'">
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

    <v-snackbar v-model="snackbar.show" color="error" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import kardexService, { type BalanceReport, type IncomeStatement } from '../services/kardexService'

const loadingIncome = ref(false)
const income = ref<IncomeStatement | null>(null)
const balance = ref<BalanceReport | null>(null)

// Rango por defecto: el mes actual.
const now = new Date()
const from = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const to = ref(now.toISOString().slice(0, 10))

const snackbar = ref({ show: false, text: '' })
const notify = (text: string) => {
  snackbar.value = { show: true, text }
}

const money = (value: number): string =>
  '$' + Number(value ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const loadIncome = async () => {
  loadingIncome.value = true
  try {
    income.value = await kardexService.incomeStatement(from.value, to.value)
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al cargar el estado de resultados')
  } finally {
    loadingIncome.value = false
  }
}

onMounted(async () => {
  await loadIncome()
  try {
    balance.value = await kardexService.balance()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al cargar el balance')
  }
})
</script>
