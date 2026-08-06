<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Kardex</h1>
            <p class="text-body-1 text-grey-darken-1">
              Movimientos de inventario con costos y saldos (promedio ponderado)
            </p>
          </div>
          <v-btn
            color="success"
            size="large"
            :loading="exporting"
            :disabled="!report || report.movements.length === 0"
            @click="exportExcel"
          >
            <v-icon start>mdi-microsoft-excel</v-icon>
            Descargar Excel
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <v-row dense align="center">
            <v-col cols="12" md="3">
              <v-autocomplete
                v-model="filters.product_id"
                :items="products"
                item-title="name"
                item-value="id"
                label="Producto"
                clearable
                hide-details
                prepend-inner-icon="mdi-package-variant"
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-text-field v-model="filters.from" label="Desde" type="date" hide-details />
            </v-col>
            <v-col cols="6" md="2">
              <v-text-field v-model="filters.to" label="Hasta" type="date" hide-details />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="filters.document_type_id"
                :items="documentTypes"
                :item-title="(t: any) => `${t.code} — ${t.name}`"
                item-value="id"
                label="Tipo de documento"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="filters.movement_type"
                :items="[
                  { title: 'Entradas', value: 'in' },
                  { title: 'Salidas', value: 'out' },
                ]"
                label="Movimiento"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="12" md="1">
              <v-btn color="primary" block :loading="loading" @click="load">
                <v-icon>mdi-magnify</v-icon>
              </v-btn>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- Resumen del producto -->
    <v-row v-if="report?.product">
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Existencia actual</div>
          <div class="text-h5">{{ report.product.current_stock }} {{ report.product.unit }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Costo promedio</div>
          <div class="text-h5">{{ money(report.product.unit_cost) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Valor del inventario</div>
          <div class="text-h5">{{ money(report.product.current_stock * report.product.unit_cost) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabla kardex -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-alert
            v-if="report?.truncated"
            type="warning"
            variant="tonal"
            density="compact"
            class="ma-2"
          >
            Se muestran los primeros 1000 movimientos: acota el rango de fechas para ver el resto.
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Doc.</th>
                <th>Referencia</th>
                <th v-if="!filters.product_id">Producto</th>
                <th class="text-right">Entrada</th>
                <th class="text-right">Salida</th>
                <th class="text-right">Costo unit.</th>
                <th class="text-right">Costo total</th>
                <th class="text-right">Saldo cant.</th>
                <th class="text-right">Saldo costo</th>
                <th class="text-right">Saldo total</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="report?.opening_balance" class="bg-grey-lighten-4 font-weight-medium">
                <td>{{ filters.from }}</td>
                <td>—</td>
                <td>SALDO ANTERIOR</td>
                <td v-if="!filters.product_id"></td>
                <td colspan="4"></td>
                <td class="text-right">{{ report.opening_balance.quantity }}</td>
                <td class="text-right">{{ money(report.opening_balance.unit_cost) }}</td>
                <td class="text-right">{{ money(report.opening_balance.total_cost) }}</td>
                <td></td>
              </tr>
              <tr v-for="m in report?.movements ?? []" :key="m.id">
                <td>{{ formatDate(m.moved_at) }}</td>
                <td>
                  <v-tooltip :text="m.document_name">
                    <template #activator="{ props }">
                      <v-chip
                        v-bind="props"
                        size="x-small"
                        :color="m.movement_type === 'in' ? 'success' : 'error'"
                        variant="tonal"
                      >
                        {{ m.document_code }}
                      </v-chip>
                    </template>
                  </v-tooltip>
                </td>
                <td>{{ m.reference || '—' }}</td>
                <td v-if="!filters.product_id">{{ m.product.name }}</td>
                <td class="text-right text-success">
                  {{ m.movement_type === 'in' ? m.quantity : '' }}
                </td>
                <td class="text-right text-error">
                  {{ m.movement_type === 'out' ? m.quantity : '' }}
                </td>
                <td class="text-right">{{ money(m.unit_cost) }}</td>
                <td class="text-right">{{ money(m.total_cost) }}</td>
                <td class="text-right">{{ m.balance_quantity }}</td>
                <td class="text-right">{{ money(m.balance_unit_cost) }}</td>
                <td class="text-right">{{ money(m.balance_total_cost) }}</td>
                <td class="text-caption">{{ m.user || '—' }}</td>
              </tr>
              <tr v-if="report && report.movements.length === 0">
                <td colspan="12" class="text-center text-grey py-6">
                  No hay movimientos con los filtros seleccionados
                </td>
              </tr>
            </tbody>
            <tfoot v-if="report && report.movements.length > 0">
              <tr class="font-weight-bold bg-grey-lighten-4">
                <td :colspan="filters.product_id ? 3 : 4">Totales del periodo</td>
                <td class="text-right text-success">{{ report.totals.in_quantity }}</td>
                <td class="text-right text-error">{{ report.totals.out_quantity }}</td>
                <td></td>
                <td class="text-right">
                  {{ money(report.totals.in_cost - report.totals.out_cost) }}
                </td>
                <td colspan="4"></td>
              </tr>
            </tfoot>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import kardexService, { type DocumentType, type KardexFilters, type KardexReport } from '../services/kardexService'
import { productsService } from '../services/productsService'

const loading = ref(false)
const exporting = ref(false)
const report = ref<KardexReport | null>(null)
const products = ref<{ id: number; name: string }[]>([])
const documentTypes = ref<DocumentType[]>([])

const filters = ref<KardexFilters>({})

const snackbar = ref({ show: false, text: '', color: 'error' })
const notify = (text: string, color = 'error') => {
  snackbar.value = { show: true, text, color }
}

const money = (value: number): string =>
  '$' + Number(value ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const load = async () => {
  loading.value = true
  try {
    report.value = await kardexService.report(filters.value)
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al cargar el kardex')
  } finally {
    loading.value = false
  }
}

const exportExcel = async () => {
  exporting.value = true
  try {
    await kardexService.export(filters.value)
  } catch {
    notify('Error al exportar el kardex')
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  try {
    const [productList, docTypes] = await Promise.all([
      productsService.getAll(),
      kardexService.documentTypes(),
    ])
    products.value = productList
    documentTypes.value = docTypes
  } catch {
    notify('Error al cargar los filtros')
  }
  await load()
})
</script>
