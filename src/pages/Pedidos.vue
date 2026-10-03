<template>
  <v-container fluid :class="{ 'pa-0': embedded }">
    <!-- Dentro del plano del salón: la mesa elegida, sin encabezado ni filtros. -->
    <div v-if="embedded" class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
      <span class="text-body-2 text-medium-emphasis">
        {{ orders.length ? 'Pedido abierto de la mesa' : 'La mesa no tiene pedidos por cobrar.' }}
      </span>
      <LockableButton
        v-if="canManageOrders && !orders.length"
        icon="mdi-plus"
        color="primary"
        @click="openNuevoPedidoDialog"
      >
        Nuevo pedido en esta mesa
      </LockableButton>
    </div>

    <v-row v-if="!embedded" align="center" class="mb-2">
      <v-col cols="12" lg="5">
        <h1 class="text-h4">Pedidos</h1>
        <p class="text-body-1 text-medium-emphasis">
          Primero lo pendiente de cobro; los de otros días quedan marcados.
        </p>
      </v-col>
      <v-col cols="12" lg="7" class="d-flex flex-wrap align-center justify-lg-end ga-2">
        <CashRegisterPanel v-if="canManageOrders" />
        <LockableButton
          v-if="canManageOrders"
          icon="mdi-plus"
          color="primary"
          size="large"
          @click="openNuevoPedidoDialog"
        >
          Nuevo pedido
        </LockableButton>
        <v-btn-toggle v-model="filterPago" color="primary" mandatory>
          <v-btn value="pending">Pendientes</v-btn>
          <v-btn value="paid">Pagados</v-btn>
          <v-btn value="all">Todos</v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>

    <!-- Pendientes de otros días: lo más urgente de la página. -->
    <v-alert
      v-if="!embedded && overdueCount > 0"
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-alert-circle"
      class="mb-4"
    >
      <div class="d-flex align-center flex-wrap ga-2">
        <span>
          <strong>{{ overdueCount }}</strong>
          {{ overdueCount === 1
            ? 'pedido pendiente de cobro de un día anterior'
            : 'pedidos pendientes de cobro de días anteriores' }}:
          revísalos antes de seguir. En la lista quedan resaltados.
        </span>
        <v-btn
          v-if="!showsAllPending"
          size="small"
          variant="tonal"
          color="warning"
          @click="verTodosLosPendientes"
        >
          Ver pendientes
        </v-btn>
      </div>
    </v-alert>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title v-if="!embedded">
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="search"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar mesa o pedido"
                  placeholder="Mesa 3, Terraza o #120"
                  single-line
                  hide-details
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="6" md="3">
                <DateField
                  v-model="dateFrom"
                  label="Desde"
                  :max="dateTo || undefined"
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols="6" md="3">
                <DateField
                  v-model="dateTo"
                  label="Hasta"
                  :min="dateFrom || undefined"
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="3" class="d-flex align-center justify-end flex-wrap ga-1">
                <v-btn
                  :variant="showsToday ? 'flat' : 'tonal'"
                  :aria-pressed="showsToday"
                  color="primary"
                  size="small"
                  @click="setToday"
                >
                  Pedidos del día
                </v-btn>
                <v-btn v-if="hasDateRange" variant="text" size="small" @click="clearDates">Quitar fechas</v-btn>
                <v-btn variant="text" @click="loadOrders()">
                  <v-icon start>mdi-refresh</v-icon>
                  Actualizar
                </v-btn>
              </v-col>
              <v-col v-if="filterPago === 'pending' && hasDateRange" cols="12" class="pt-0">
                <div class="text-caption text-warning">
                  Con un rango de fechas no ves los pendientes de otros días.
                </div>
              </v-col>
            </v-row>
          </v-card-title>
          
          <v-data-table-server
            v-model:expanded="expanded"
            v-model:page="page"
            v-model:items-per-page="perPage"
            v-model:sort-by="sortBy"
            :headers="headers"
            :items="orders"
            :items-length="ordersTotal"
            :items-per-page-options="PAGE_SIZE_OPTIONS"
            :loading="loading"
            :row-props="rowProps"
            :hide-default-footer="embedded"
            class="elevation-0"
            item-value="id"
            show-expand
          >
            <template #item.dining_table="{ item }">
              <div class="d-flex align-center">
                <v-avatar color="primary" size="32" class="mr-2">
                  <span class="text-caption">{{ item.dining_table?.number || '?' }}</span>
                </v-avatar>
                <span>{{ item.dining_table?.display_name || 'Sin mesa' }}</span>
              </div>
            </template>
            
            <template #item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" size="small">
                {{ getStatusText(item.status) }}
              </v-chip>
            </template>
            
            <template #item.payment_status="{ item }">
              <v-chip :color="getPagoColor(item.payment_status)" size="small">
                {{ getPagoText(item.payment_status) }}
              </v-chip>
            </template>
            
            <template #item.total="{ item }">
              <span class="font-weight-bold tabular-nums text-no-wrap">
                {{ money(item.total) }}
              </span>
              <div
                v-if="Number(item.pending_balance) > 0 && item.payment_status === 'partial'"
                class="text-error text-caption text-no-wrap"
              >
                Debe: {{ money(item.pending_balance) }}
              </div>
            </template>
            
            <template #item.waiter="{ item }">
              {{ item.waiter || '—' }}
            </template>

            <template #item.created_at="{ item }">
              <div class="text-no-wrap text-caption">
                {{ formatRecent(item.created_at) }}
                <v-chip
                  v-if="isOverdue(item)"
                  color="warning"
                  size="x-small"
                  variant="flat"
                  class="ml-1"
                >
                  Otro día
                </v-chip>
              </div>
            </template>
            
            <template #item.actions="{ item }">
              <div class="d-flex align-center justify-end ga-1 text-no-wrap">
                <!-- Cobrar es la acción principal de la página: a la vista, no en el menú. -->
                <LockableButton
                  v-if="isOpen(item)"
                  icon="mdi-cash-check"
                  color="primary"
                  size="small"
                  variant="flat"
                  @click="openPayDialog(item)"
                >
                  Cobrar
                </LockableButton>
                <v-btn
                  v-else-if="item.payment_status === 'paid'"
                  size="small"
                  variant="tonal"
                  color="primary"
                  @click="printReceipt(item)"
                >
                  <v-icon start>mdi-printer</v-icon>
                  Factura
                </v-btn>
                <v-menu v-if="isOpen(item) || item.payment_status === 'paid'">
                  <template #activator="{ props }">
                    <v-btn icon size="small" variant="text" aria-label="Más acciones del pedido" v-bind="props">
                      <v-icon>mdi-dots-vertical</v-icon>
                    </v-btn>
                  </template>
                  <!-- Neutral icons; only the destructive entries are colored. -->
                  <v-list density="compact">
                    <v-list-item v-if="item.payment_status === 'paid'" @click="openTipDialog(item)">
                      <template #prepend>
                        <v-icon>mdi-hand-coin</v-icon>
                      </template>
                      <v-list-item-title>Agregar propina</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="item.payment_status === 'paid' && isAdmin" @click="openRevertDialog(item)">
                      <template #prepend>
                        <v-icon color="error">mdi-undo-variant</v-icon>
                      </template>
                      <v-list-item-title>Revertir cobro</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="isOpen(item)" @click="printPreBill(item)">
                      <template #prepend>
                        <v-icon>mdi-receipt-text</v-icon>
                      </template>
                      <v-list-item-title>Imprimir cuenta</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="isOpen(item) && isAdmin" @click="openDiscountDialog(item)">
                      <template #prepend>
                        <v-icon>mdi-percent</v-icon>
                      </template>
                      <v-list-item-title>Aplicar descuento</v-list-item-title>
                    </v-list-item>
                    <v-list-item v-if="isOpen(item)" @click="openPagoDialog(item)">
                      <template #prepend>
                        <v-icon>mdi-cash-plus</v-icon>
                      </template>
                      <v-list-item-title>Registrar pago parcial</v-list-item-title>
                    </v-list-item>
                    <!-- Un pedido con productos lo cancela el admin; uno vacío, cualquiera. -->
                    <template v-if="isOpen(item) && (isAdmin || !item.items?.length)">
                      <v-divider />
                      <v-list-item @click="cancelarPedido(item)">
                        <template #prepend>
                          <v-icon color="error">mdi-cancel</v-icon>
                        </template>
                        <v-list-item-title>Cancelar pedido</v-list-item-title>
                      </v-list-item>
                    </template>
                  </v-list>
                </v-menu>
              </div>
            </template>
            
            <template #expanded-row="{ columns, item }">
              <tr>
                <td :colspan="columns.length" class="pa-4 bg-surface-light">
                  <v-row>
                    <v-col cols="12" md="8">
                      <div class="d-flex justify-space-between align-center mb-2">
                        <h4>Productos del pedido</h4>
                        <LockableButton
                          v-if="canManageOrders && item.payment_status !== 'paid'"
                          icon="mdi-plus"
                          color="primary"
                          size="small"
                          variant="tonal"
                          @click="openAgregarItemsDialog(item)"
                        >
                          Agregar productos
                        </LockableButton>
                      </div>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>Cantidad</th>
                            <th>Producto</th>
                            <th v-if="hasGuests(item)">Persona</th>
                            <th>Precio unit.</th>
                            <th>Total</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="orderItem in item.items" :key="orderItem.id">
                            <td>{{ orderItem.quantity }}</td>
                            <td>
                              {{ orderItem.product_name }}
                              <span v-if="orderItem.variant" class="text-medium-emphasis"> ({{ orderItem.variant }})</span>
                            </td>
                            <td v-if="hasGuests(item)">
                              <v-chip size="x-small" :color="orderItem.guest_number ? 'primary' : undefined" variant="tonal">
                                {{ guestLabel(orderItem.guest_number) }}
                              </v-chip>
                            </td>
                            <td>{{ money(orderItem.unit_price) }}</td>
                            <td class="font-weight-bold">{{ money(orderItem.total_price) }}</td>
                            <td>
                              <v-btn
                                v-if="item.payment_status !== 'paid'"
                                icon
                                size="x-small"
                                variant="text"
                                :aria-label="`Editar ${orderItem.product_name ?? 'el producto'}`" @click="openEditItemDialog(item, orderItem)"
                              >
                                <v-icon size="small">mdi-pencil</v-icon>
                              </v-btn>
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-card variant="tonal">
                        <v-card-text>
                          <template v-if="item.time">
                            <div class="d-flex justify-space-between mb-1 align-center">
                              <span>
                                🎱 Tiempo
                                <v-chip
                                  v-if="item.time.running"
                                  size="x-small"
                                  :color="isOvertime(item.time) ? 'error' : 'success'"
                                  class="ml-1"
                                >
                                  {{ elapsedLabel(item.time) }}
                                </v-chip>
                                <span v-else class="text-caption text-medium-emphasis">({{ item.time.minutes_billed }} min)</span>
                              </span>
                              <span class="font-weight-medium">
                                {{ money(item.time.running ? liveTimeAmount(item.time) : item.time.amount) }}
                              </span>
                            </div>
                            <v-btn
                              v-if="item.time.running && item.payment_status !== 'paid'"
                              size="x-small"
                              color="warning"
                              variant="tonal"
                              block
                              class="mb-2"
                              @click="stopTime(item)"
                            >
                              <v-icon start size="small">mdi-timer-stop</v-icon>
                              Detener tiempo
                            </v-btn>
                          </template>
                          <div class="d-flex justify-space-between mb-2">
                            <span>Subtotal:</span>
                            <span>{{ money(item.subtotal) }}</span>
                          </div>
                          <div v-if="item.discount_percentage > 0 || item.discount_amount > 0" class="d-flex justify-space-between mb-2 text-warning">
                            <span>Descuento:</span>
                            <span>-{{ money(Number(item.subtotal || 0) * Number(item.discount_percentage || 0) / 100 + Number(item.discount_amount || 0)) }}</span>
                          </div>
                          <div v-if="Number(item.delivery_fee) > 0" class="d-flex justify-space-between mb-2">
                            <span>Domicilio:</span>
                            <span>{{ money(item.delivery_fee) }}</span>
                          </div>
                          <div v-if="Number(item.tip) > 0" class="d-flex justify-space-between mb-2">
                            <span>Propina:</span>
                            <span>{{ money(item.tip) }}</span>
                          </div>
                          <v-divider class="my-2" />
                          <div class="d-flex justify-space-between font-weight-bold">
                            <span>Total:</span>
                            <span class="tabular-nums">{{ money(item.total) }}</span>
                          </div>
                          <div v-if="item.invoice_number" class="d-flex justify-space-between text-caption text-medium-emphasis mt-1">
                            <span>Factura:</span>
                            <span>{{ item.invoice_number }}</span>
                          </div>
                          <!-- Cuentas separadas: lo que debe cada persona. -->
                          <template v-if="hasGuests(item)">
                            <v-divider class="my-2" />
                            <div class="text-caption text-medium-emphasis mb-1">Por persona</div>
                            <div
                              v-for="guest in item.guests"
                              :key="guest.number ?? 0"
                              class="d-flex justify-space-between text-body-2"
                            >
                              <span>
                                {{ guest.label }}
                                <v-icon v-if="guest.paid" size="small" color="success">mdi-check-circle</v-icon>
                              </span>
                              <span :class="guest.paid ? 'text-medium-emphasis' : ''">{{ money(guest.amount) }}</span>
                            </div>
                          </template>
                          <div v-if="Number(item.amount_paid) > 0 && item.payment_status !== 'paid'" class="d-flex justify-space-between mt-2">
                            <span>Pagado:</span>
                            <span>{{ money(item.amount_paid) }}</span>
                          </div>
                          <div v-if="Number(item.pending_balance) > 0" class="d-flex justify-space-between text-error font-weight-bold">
                            <span>Pendiente:</span>
                            <span>{{ money(item.pending_balance) }}</span>
                          </div>
                        </v-card-text>
                      </v-card>
                      <div v-if="item.notes" class="mt-3">
                        <strong>Notas:</strong>
                        <p class="text-medium-emphasis">{{ item.notes }}</p>
                      </div>
                    </v-col>
                  </v-row>
                </td>
              </tr>
            </template>
          </v-data-table-server>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: agregar propina a un pedido ya pagado -->
    <v-dialog v-model="tipDialog" max-width="440" persistent>
      <v-card>
        <v-card-title>Agregar propina</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            El pedido #{{ tippingOrder?.id }} ya está pagado. La propina es
            voluntaria (Ley 1935 de 2018) y se registra aparte de la venta.
          </p>
          <v-text-field
            v-model.number="tipAmount"
            label="Propina"
            type="number"
            min="0"
            prefix="$"
            autofocus
          />
          <v-select
            v-model="tipMethod"
            :items="payMethodOptions"
            item-title="title"
            item-value="value"
            label="Medio de pago de la propina"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="tipDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!(tipAmount > 0)" @click="saveTip">
            Agregar propina
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: revertir cobro -->
    <v-dialog v-model="revertDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>Revertir cobro</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            El pedido volverá a quedar pendiente de pago y se borrarán los pagos
            registrados. Queda anotado quién lo hizo y por qué.
          </v-alert>
          <v-text-field
            v-model="revertReason"
            placeholder="Ej: se cobró en la mesa equivocada"
            autofocus
          >
            <template #label>
              ¿Por qué se revierte? <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
            </template>
          </v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="revertDialog = false">Cancelar</v-btn>
          <v-btn color="error" :loading="saving" :disabled="!revertReason.trim()" @click="revertPayment">
            Revertir cobro
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!--
      Dialog Cobrar. El orden importa: primero se imprime la CUENTA (sin
      número de factura) con el total con y sin propina, el cliente elige, y
      solo al confirmar el cobro el backend toma el consecutivo de la
      resolución DIAN y se imprime la FACTURA. Imprimir la factura antes de
      cobrar gastaría un consecutivo en una venta que quizá no ocurre.
    -->
    <v-dialog v-model="payDialog" max-width="760" persistent scrollable>
      <v-card v-if="selectedOrder">
        <v-card-title class="d-flex align-center">
          Cobrar pedido #{{ selectedOrder.id }}
          <span v-if="selectedOrder.dining_table" class="text-body-2 text-medium-emphasis ml-2">
            {{ selectedOrder.dining_table.display_name }}
          </span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Cerrar" @click="payDialog = false" />
        </v-card-title>
        <v-card-text>
          <!-- La mesa separó la cuenta: se pregunta si pagan juntos o cada uno lo suyo. -->
          <v-btn-toggle
            v-if="hasGuests(selectedOrder)"
            v-model="payMode"
            mandatory
            density="compact"
            color="primary"
            class="mb-4"
          >
            <v-btn value="together">Todos juntos</v-btn>
            <v-btn value="split">Por persona</v-btn>
          </v-btn-toggle>

          <v-select
            v-model="payMethod"
            :items="payMethodOptions"
            label="Método de pago"
            class="mb-1"
          />

          <template v-if="payMode === 'split'">
            <p class="text-body-2 text-medium-emphasis mb-2">
              Cada persona paga lo suyo. Los descuentos y cargos de la mesa se reparten
              proporcionalmente. Al pagar la última, el pedido queda cerrado.
            </p>
            <v-row dense class="align-center mb-1">
              <v-col cols="12" sm="7">
                <v-switch
                  v-model="tipEnabled"
                  label="Sugerir propina voluntaria"
                  color="primary"
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col v-if="tipEnabled" cols="12" sm="5">
                <v-text-field
                  v-model.number="tipPercent"
                  label="Propina sugerida (%)"
                  type="number"
                  min="0"
                  max="100"
                  suffix="%"
                  density="compact"
                  hide-details
                />
              </v-col>
            </v-row>
            <p v-if="tipEnabled" class="text-caption text-medium-emphasis mb-2">
              La propina es voluntaria (Ley 1935 de 2018). El monto sugerido es solo una
              referencia: a cada persona se le cobra la propina que escribas, o ninguna.
            </p>
            <v-list density="compact" class="border rounded mb-2">
              <v-list-item v-for="guest in selectedOrder.guests" :key="guest.number ?? 0">
                <v-list-item-title>
                  {{ guest.label }}
                  <span class="text-caption text-medium-emphasis"> · {{ guest.items_count }} prod.</span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  <span v-if="guest.paid" class="text-success">Pagado</span>
                  <template v-else>
                    <strong>{{ money(guest.pending_amount) }}</strong>
                    <span v-if="tipEnabled && guestTip(guest) > 0" class="text-medium-emphasis">
                      · con propina {{ money(guest.pending_amount + guestTip(guest)) }}
                    </span>
                    <span v-else-if="tipEnabled && guestSuggestedTip(guest) > 0" class="text-medium-emphasis">
                      · sugerida {{ tipPercent }}%: {{ money(guestSuggestedTip(guest)) }}
                      <a href="#" class="text-primary text-decoration-none" @click.prevent="useGuestSuggested(guest)">usar</a>
                    </span>
                  </template>
                </v-list-item-subtitle>
                <template #append>
                  <div class="d-flex align-center flex-wrap justify-end ga-1">
                    <v-text-field
                      v-if="tipEnabled && !guest.paid"
                      :model-value="guestTip(guest)"
                      label="Propina"
                      type="number"
                      min="0"
                      prefix="$"
                      density="compact"
                      hide-details
                      width="120"
                      @update:model-value="(v: string) => setGuestTip(guest, v)"
                    />
                    <v-btn
                      size="small"
                      variant="text"
                      color="primary"
                      :loading="printing"
                      @click="printGuestBill(selectedOrder, guest.number)"
                    >
                      <v-icon start>mdi-printer</v-icon>
                      Cuenta
                    </v-btn>
                    <template v-if="!guest.paid">
                      <v-btn
                        v-if="tipEnabled && guestTip(guest) > 0"
                        size="small"
                        color="primary"
                        variant="tonal"
                        :loading="saving"
                        @click="cobrarPersona(guest, true)"
                      >
                        Cobrar con propina
                      </v-btn>
                      <v-btn
                        size="small"
                        :color="tipEnabled && guestTip(guest) > 0 ? undefined : 'primary'"
                        :variant="tipEnabled && guestTip(guest) > 0 ? 'text' : 'tonal'"
                        :loading="saving"
                        @click="cobrarPersona(guest, false)"
                      >
                        {{ tipEnabled && guestTip(guest) > 0 ? 'Cobrar sin propina' : 'Cobrar' }}
                      </v-btn>
                    </template>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div class="d-flex justify-space-between text-body-2">
              <span>Pendiente de la mesa:</span>
              <strong class="text-error">{{ money(selectedOrder.pending_balance) }}</strong>
            </div>
          </template>
          <template v-else>
          <v-autocomplete
            v-model="payCustomerId"
            :items="customers"
            :item-title="(c: any) => `${c.name} (${c.document_number})`"
            item-value="id"
            label="Cliente (opcional)"
            hint="Se registra en la venta y sale en la factura"
            persistent-hint
            clearable
          />

          <!-- Propina: apagada, el negocio no la ofrece y no aparece en la cuenta. -->
          <v-switch
            v-model="tipEnabled"
            label="Sugerir propina voluntaria"
            color="primary"
            hide-details
            density="compact"
            class="mt-3"
          />
          <template v-if="tipEnabled">
            <v-row dense class="mt-1">
              <v-col cols="5">
                <v-text-field
                  v-model.number="tipPercent"
                  label="Sugerida (%)"
                  type="number"
                  min="0"
                  max="100"
                  suffix="%"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="7">
                <v-text-field
                  v-model.number="payTip"
                  label="Propina (opcional)"
                  type="number"
                  min="0"
                  prefix="$"
                  density="compact"
                  hint="Se calcula con el porcentaje; puedes ajustar el valor"
                  persistent-hint
                />
              </v-col>
            </v-row>
            <p class="text-caption text-medium-emphasis mt-2 mb-0">
              La propina es voluntaria (Ley 1935 de 2018). Primero
              <strong>imprime la cuenta</strong>: el cliente ve el total con y sin
              propina y decide; después cobras con la opción que eligió.
            </p>
          </template>

          <v-card flat color="surface-light" class="pa-3 mt-3">
            <div v-if="Number(selectedOrder.amount_paid) > 0" class="d-flex justify-space-between text-medium-emphasis mb-1">
              <span>Ya pagado (personas que pagaron aparte):</span>
              <span>{{ money(selectedOrder.amount_paid) }}</span>
            </div>
            <div class="d-flex justify-space-between tabular-nums">
              <span>Total sin propina:</span>
              <strong>{{ money(payBase) }}</strong>
            </div>
            <div v-if="tipOffered" class="d-flex justify-space-between mt-1 tabular-nums">
              <span>Total con propina:</span>
              <strong>{{ money(payBase + payTip) }}</strong>
            </div>
          </v-card>

          </template>

          <v-checkbox
            v-model="printOnPay"
            label="Imprimir la factura al cobrar"
            density="compact"
            hide-details
            class="mt-1"
          />
        </v-card-text>
        <v-card-actions class="flex-wrap">
          <v-btn
            v-if="payMode === 'together'"
            :variant="tipOffered ? 'tonal' : 'text'"
            color="primary"
            :loading="printing"
            @click="printPreBill(selectedOrder)"
          >
            <v-icon start>mdi-printer</v-icon>
            Imprimir cuenta
          </v-btn>
          <v-spacer />
          <v-btn @click="payDialog = false">{{ payMode === 'split' ? 'Cerrar' : 'Cancelar' }}</v-btn>
          <template v-if="payMode === 'together'">
            <v-btn
              v-if="tipOffered"
              color="primary"
              variant="tonal"
              :loading="saving"
              @click="confirmarCobro(true)"
            >
              Cobrar con propina
            </v-btn>
            <v-btn color="primary" variant="flat" :loading="saving" @click="confirmarCobro(false)">
              {{ tipOffered ? 'Cobrar sin propina' : 'Confirmar cobro' }}
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Descuento -->
    <v-dialog v-model="discountDialog" max-width="400">
      <v-card>
        <v-card-title>Aplicar descuento</v-card-title>
        <v-card-text>
          <v-radio-group v-model="discountType" inline>
            <v-radio label="Porcentaje" value="percentage" />
            <v-radio label="Monto fijo" value="amount" />
          </v-radio-group>
          <v-text-field
            v-model.number="discountValue"
            :label="discountType === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'"
            type="number"
            min="0"
            :max="discountType === 'percentage' ? 100 : undefined"
          />
          <v-text-field
            v-model="discountReason"
            label="Motivo (opcional)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="discountDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="applyDiscount">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Pago parcial / división de cuenta -->
    <PartialPaymentDialog
      v-model="pagoDialog"
      :order="selectedOrder"
      @paid="message => { showMessage(message); loadOrders(); }"
      @failed="message => showMessage(message, 'error')"
    />

    <!-- Dialog Editar item -->
    <v-dialog v-model="editItemDialog" max-width="400">
      <v-card>
        <v-card-title>Editar item</v-card-title>
        <v-card-text>
          <p class="mb-4 font-weight-bold">{{ selectedItem?.product_name }}</p>
          <v-text-field
            v-model.number="editItemData.quantity"
            label="Cantidad"
            type="number"
            min="1"
          />
          <v-select
            v-model="editItemData.guest_number"
            :items="guestOptions"
            label="Persona (cuentas separadas)"
            hint="Compartido = lo paga la mesa junta"
            persistent-hint
            class="mb-2"
          />
          <!-- Cambiar precio o descontar es ajustar el cobro: solo admin. -->
          <template v-if="isAdmin">
            <v-text-field
              v-model.number="editItemData.unit_price"
              label="Precio unitario"
              type="number"
              min="0"
              step="0.01"
              prefix="$"
            />
            <v-text-field
              v-model.number="editItemData.discount"
              label="Descuento"
              type="number"
              min="0"
              step="0.01"
              prefix="$"
            />
          </template>
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" variant="text" @click="eliminarItem">Eliminar</v-btn>
          <v-spacer />
          <v-btn @click="editItemDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="guardarItem">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Nuevo pedido -->
    <v-dialog v-model="nuevoPedidoDialog" max-width="900" persistent scrollable>
      <v-card>
        <v-card-title class="bg-primary">
          <v-icon start>mdi-receipt-text-plus</v-icon>
          Nuevo pedido
        </v-card-title>
        <v-card-text class="pt-4">
          <v-row dense>
            <v-col cols="12" md="6">
              <v-select
                v-model="nuevoPedido.dining_table_id"
                :items="mesasDisponibles"
                :item-title="(t: any) => t.display_name || `Mesa ${t.number}`"
                item-value="id"
                label="Mesa (opcional)"
                hint="Sin mesa el pedido queda como venta de mostrador"
                persistent-hint
                clearable
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="nuevoPedido.customer_name"
                label="Cliente (opcional)"
                placeholder="Ej: Juan Pérez"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <ProductPicker
            :items="menuItems"
            :loading="loadingMenu"
            :selection="nuevoPedido.items"
            :guest-names="nuevoPedido.guest_names"
            @add="agregarAlPedido"
            @remove="quitarDelPedido"
            @rename="renombrarPersonaNueva"
          />

          <v-textarea
            v-model="nuevoPedido.notes"
            label="Notas (opcional)"
            rows="2"
            class="mt-4"
          />
        </v-card-text>
        <v-card-actions>
          <div class="text-h6 ml-4">
            Total: {{ money(totalNuevoPedido) }}
          </div>
          <v-spacer />
          <v-btn @click="nuevoPedidoDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="nuevoPedido.items.length === 0"
            @click="crearPedido"
          >
            <v-icon start>mdi-check</v-icon>
            Crear pedido
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Agregar productos a un pedido abierto -->
    <v-dialog v-model="agregarItemsDialog" max-width="900" persistent scrollable>
      <v-card>
        <v-card-title class="bg-primary">
          <v-icon start>mdi-plus-box</v-icon>
          Agregar productos al pedido #{{ selectedOrder?.id }}
        </v-card-title>
        <v-card-text class="pt-4">
          <ProductPicker
            :items="menuItems"
            :loading="loadingMenu"
            :selection="itemsParaAgregar"
            :existing-guests="guestsOf(selectedOrder)"
            :guest-names="agregarGuestNames"
            @add="(item: any, guest: number | null) => agregarASeleccion(itemsParaAgregar, item, guest)"
            @remove="(line: PickedLine) => quitarDeSeleccion(itemsParaAgregar, line)"
            @rename="renombrarPersonaExistente"
          />
        </v-card-text>
        <v-card-actions>
          <div class="text-h6 ml-4">
            Total: {{ money(totalParaAgregar) }}
          </div>
          <v-spacer />
          <v-btn @click="agregarItemsDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="itemsParaAgregar.length === 0"
            @click="guardarItemsAgregados"
          >
            <v-icon start>mdi-check</v-icon>
            Agregar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/errors';
import { useAuthStore } from '@/stores/auth';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  ordersService,
  type Order,
  type OrderItem,
  type OrderPaymentMethod,
  type OrderReceipt,
} from '@/services/ordersService';
import { billingService, type Customer } from '@/services/billingService';
import {
  orderStatusLabels,
  orderStatusColors,
  paymentStatusLabels,
  paymentStatusColors,
  orderPaymentMethodLabels,
  taxRegimeLabels,
  label,
  options,
} from '@/utils/labels';
import LockableButton from '../components/LockableButton.vue'
import CashRegisterPanel from '../components/CashRegisterPanel.vue'
import PartialPaymentDialog from '../components/PartialPaymentDialog.vue'
import DateField from '../components/DateField.vue'
import ProductPicker from '../components/ProductPicker.vue'
import { menuItemsService } from '@/services/menuService';
import { tablesService } from '@/services/tablesService';
import { effectiveFeatures } from '@/types/auth';
import { addLine, removeLine, linesTotal, guestLabel, type PickedLine } from '@/utils/orderLines';
import { useLiveRefresh } from '@/composables/useLiveRefresh';
import { money } from '@/utils/money';
import { formatRecent, todayIso } from '@/utils/dates';
import { PAGE_SIZE_OPTIONS, useServerPage } from '@/composables/useServerPage';
import type { PageQuery, PaginatedResponse } from '@/types/api';
import type { OrderGuest } from '@/services/ordersService';

// El plano del salón monta esta misma página para una mesa: se gestiona el
// pedido ahí sin duplicar la lógica de cobro, productos y descuentos.
const props = defineProps<{ tableId?: number | null; embedded?: boolean }>();
const emit = defineEmits<{ changed: [] }>();

// Vuetify lo tipa como string[], pero compara contra item-value (el id numérico).
const expanded = ref<any[]>([]);
const saving = ref(false);
// Por defecto: TODO lo pendiente de cobro, de cualquier día. Un pedido de
// ayer sin cobrar es plata que se pierde si solo se ve lo de hoy.
const filterPago = ref<'pending' | 'paid' | 'all'>('pending');
// Rango por fecha de creación (AAAA-MM-DD, hora local del negocio).
const dateFrom = ref('');
const dateTo = ref('');
const hasDateRange = computed(() => !!dateFrom.value || !!dateTo.value);
const showsToday = computed(() => dateFrom.value === todayIso() && dateTo.value === todayIso());
// Los pedidos del día son todos los de hoy, también los cobrados: sobre
// "Pendientes" la lista se vacía en cuanto se cobran las mesas.
const setToday = () => {
  filterPago.value = 'all';
  dateFrom.value = todayIso();
  dateTo.value = todayIso();
};
const clearDates = () => {
  dateFrom.value = '';
  dateTo.value = '';
};


/** Pedido abierto: se puede cobrar, descontar o cancelar. */
const isOpen = (order: Order) =>
  order.payment_status !== 'paid' && order.status !== 'cancelled';

/** La mesa separó la cuenta por personas. */
const hasGuests = (order: Order | null | undefined) => (order?.guests?.length ?? 0) > 0;

/** Cuántas personas numeradas tiene el pedido. */
const guestsOf = (order: Order | null | undefined) =>
  (order?.guests ?? []).reduce((max, g) => Math.max(max, g.number ?? 0), 0);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

/** Pendiente de cobro y creado antes de hoy: lo que no puede pasar desapercibido. */
const isOverdue = (order: Order) =>
  isOpen(order) && new Date(order.created_at).getTime() < startOfToday();

// Pendientes de otros días: solo el conteo, con una consulta aparte para que
// la alerta no dependa de la página ni del filtro que se esté viendo.
const overdueCount = ref(0);
const showsAllPending = computed(() => filterPago.value === 'pending' && !hasDateRange.value);

const verTodosLosPendientes = () => {
  filterPago.value = 'pending';
  clearDates();
};

const rowProps = ({ item }: { item: Order }) => ({
  class: isOverdue(item) ? 'bg-warning-container' : '',
});

const selectedOrder = ref<Order | null>(null);
const selectedItem = ref<OrderItem | null>(null);

const discountDialog = ref(false);
const discountType = ref<'percentage' | 'amount'>('percentage');
const discountValue = ref(0);
const discountReason = ref('');

const pagoDialog = ref(false);
const editItemDialog = ref(false);
const editItemData = ref({ quantity: 1, unit_price: 0, discount: 0, guest_number: null as number | null });

// Compartido + las personas que ya hay + una más, por si llega alguien.
const guestOptions = computed(() => {
  const count = guestsOf(selectedOrder.value) + 1;
  return [
    { title: 'Compartido', value: null },
    ...Array.from({ length: count }, (_, i) => ({ title: `Persona ${i + 1}`, value: i + 1 })),
  ];
});

// Nuevo pedido y "seguir pidiendo" sobre un pedido abierto.
const nuevoPedidoDialog = ref(false);
const agregarItemsDialog = ref(false);
const menuItems = ref<any[]>([]);
const loadingMenu = ref(false);
const mesasDisponibles = ref<any[]>([]);
const itemsParaAgregar = ref<PickedLine[]>([]);
const nuevoPedido = ref({
  dining_table_id: null as number | null,
  customer_name: '',
  notes: '',
  items: [] as PickedLine[],
  guest_names: {} as Record<number, string>,
});
// Nombres de las personas al agregar productos a un pedido ya abierto.
const agregarGuestNames = ref<Record<number, string>>({});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Mesa', key: 'dining_table', sortable: false },
  // Quién atiende la mesa es lo operativo; el cliente casi nunca se llena.
  { title: 'Mesero', key: 'waiter', sortable: false },
  { title: 'Estado', key: 'status' },
  { title: 'Pago', key: 'payment_status' },
  { title: 'Total', key: 'total' },
  // La fecha va compacta para dejarle sitio al botón de cobrar.
  { title: 'Fecha', key: 'created_at', width: 130 },
  { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 200 },
];

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

// --- Billar: reloj en vivo para los tiempos en curso ---
const authStore = useAuthStore();
// Revertir un cobro es una acción sensible: solo el admin.
const isAdmin = computed(() => authStore.isAdmin);

// Crear pedidos y agregar productos depende del permiso de pedidos; el
// backend vuelve a comprobarlo (esconder un botón no bloquea nada).
const canManageOrders = computed(() =>
  effectiveFeatures(authStore.user).includes('orders'),
);

const nowTick = ref(Date.now());
const tickInterval = setInterval(() => { nowTick.value = Date.now(); }, 15_000);
onUnmounted(() => clearInterval(tickInterval));

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

/**
 * Con tiempo acordado muestra lo que falta (o de cuánto se pasaron);
 * sin acuerdo, el tiempo transcurrido.
 */
const elapsedLabel = (time: { started_at: string; planned_minutes?: number | null }): string => {
  const elapsed = Math.max(0, Math.floor((nowTick.value - new Date(time.started_at).getTime()) / 60000));

  if (!time.planned_minutes) return formatMinutes(elapsed);

  const remaining = time.planned_minutes - elapsed;
  return remaining >= 0
    ? `faltan ${formatMinutes(remaining)}`
    : `+${formatMinutes(Math.abs(remaining))} de más`;
};

/** Se pasaron del tiempo que acordaron. */
const isOvertime = (time: { started_at: string; planned_minutes?: number | null }): boolean => {
  if (!time.planned_minutes) return false;
  const elapsed = (nowTick.value - new Date(time.started_at).getTime()) / 60000;
  return elapsed > time.planned_minutes;
};

// Estimación en vivo con la misma regla del backend: fracción hacia arriba, mínimo una.
const liveTimeAmount = (time: { started_at: string; rate: number; increment_minutes: number }): number => {
  const elapsed = (nowTick.value - new Date(time.started_at).getTime()) / 60000;
  const increment = Math.max(1, time.increment_minutes || 15);
  const billed = Math.max(increment, Math.ceil(elapsed / increment) * increment);
  return Math.round((time.rate * billed) / 60 * 100) / 100;
};

// --- Revertir un cobro (solo admin) ---
// --- Propina posterior al cobro (endpoint /orders/{id}/tip) ---
const tipDialog = ref(false);
const tippingOrder = ref<Order | null>(null);
const tipAmount = ref<number>(0);
const tipMethod = ref<OrderPaymentMethod>('cash');

const openTipDialog = (order: Order) => {
  tippingOrder.value = order;
  tipAmount.value = 0;
  tipMethod.value = 'cash';
  tipDialog.value = true;
};

const saveTip = async () => {
  if (!tippingOrder.value || !(tipAmount.value > 0)) return;

  saving.value = true;
  try {
    await ordersService.addTip(tippingOrder.value.id, {
      tip: tipAmount.value,
      payment_method: tipMethod.value,
    });
    showMessage('Propina registrada');
    tipDialog.value = false;
    await loadOrders();
  } catch (error: any) {
    showMessage(errorMessage(error, 'No se pudo registrar la propina'), 'error');
  } finally {
    saving.value = false;
  }
};

const revertDialog = ref(false);
const revertReason = ref('');
const revertingOrder = ref<Order | null>(null);

const openRevertDialog = (order: Order) => {
  revertingOrder.value = order;
  revertReason.value = '';
  revertDialog.value = true;
};

const revertPayment = async () => {
  if (!revertingOrder.value || !revertReason.value.trim()) return;

  saving.value = true;
  try {
    await ordersService.revertPayment(revertingOrder.value.id, revertReason.value.trim());
    showMessage('Cobro revertido: el pedido quedó pendiente de pago');
    revertDialog.value = false;
    await loadOrders();
  } catch (error: any) {
    showMessage(errorMessage(error, 'No se pudo revertir el cobro'), 'error');
  } finally {
    saving.value = false;
  }
};

const stopTime = async (order: Order) => {
  try {
    await ordersService.stopTime(order.id);
    showMessage('Tiempo detenido y agregado a la cuenta');
    await loadOrders();
  } catch (error: any) {
    showMessage(errorMessage(error, 'No fue posible detener el tiempo. Inténtalo de nuevo.'), 'error');
  }
};

// La lista pagina en el servidor: el refresco en vivo trae solo la página
// visible. Desde el plano del salón van completos los pedidos abiertos de la mesa.
const fetchOrders = async (query: PageQuery): Promise<PaginatedResponse<Order>> => {
  if (props.embedded) {
    const data = await ordersService.getAll({
      ...(props.tableId ? { dining_table_id: props.tableId } : {}),
      open: true,
    });
    return { data, meta: { current_page: 1, per_page: data.length, total: data.length, last_page: 1 } };
  }

  return ordersService.getPage({
    ...query,
    ...(dateFrom.value ? { from: dateFrom.value } : {}),
    ...(dateTo.value ? { to: dateTo.value } : {}),
    // Un pedido cancelado no está "por cobrar" aunque su pago siga en pendiente.
    ...(filterPago.value === 'pending' ? { open: true } : {}),
    ...(filterPago.value === 'paid' ? { payment_status: 'paid' } : {}),
  });
};

const {
  items: orders,
  total: ordersTotal,
  page,
  perPage,
  sortBy,
  search,
  loading,
  load,
} = useServerPage<Order>(fetchOrders, {
  filters: [dateFrom, dateTo, filterPago],
  onError: error =>
    showMessage(errorMessage(error, 'No fue posible cargar los pedidos. Inténtalo de nuevo.'), 'error'),
});

const localYesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA');
};

const loadOverdueCount = async () => {
  try {
    const result = await ordersService.getPage({ page: 1, per_page: 1, open: true, to: localYesterday() });
    overdueCount.value = result.meta.total;
  } catch {
    // Sin conexión la lista ya muestra el error; el aviso se actualiza en el siguiente refresco.
  }
};

const loadOrders = async (silent = false) => {
  await Promise.all([load({ silent }), props.embedded ? null : loadOverdueCount()]);

  if (props.embedded) {
    // Con una sola mesa, el detalle del pedido va abierto de entrada.
    expanded.value = orders.value.filter(isOpen).map(order => order.id);
    if (!silent) emit('changed');
  }
};

const getStatusColor = (status: string) => orderStatusColors[status] || 'secondary';

const getStatusText = (status: string) => label(orderStatusLabels, status) || status;

const getPagoColor = (estado: string) => paymentStatusColors[estado] || 'secondary';

const getPagoText = (estado: string) => label(paymentStatusLabels, estado) || estado;

// Hoy solo la hora; otro día, día y mes también.

// --- Cobro: método, cliente y propina (voluntaria) ---
const payDialog = ref(false);
const printing = ref(false);
const payMethod = ref<OrderPaymentMethod>('cash');
const payTip = ref(0);
const payCustomerId = ref<number | null>(null);
const customers = ref<Customer[]>([]);

const payMethodOptions = options(orderPaymentMethodLabels);

/**
 * Preferencias de caja, guardadas en este navegador: si el negocio sugiere
 * propina (y cuánto) y si imprime la factura al cobrar. Un local chico que
 * no maneja propina la apaga una vez y no vuelve a verla.
 */
const CASHIER_PREFS_KEY = 'pos.cashier_prefs';
const loadCashierPrefs = (): { tipEnabled: boolean; tipPercent: number; printOnPay: boolean } => {
  const defaults = { tipEnabled: false, tipPercent: 10, printOnPay: true };
  try {
    const raw = localStorage.getItem(CASHIER_PREFS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
};
const cashierPrefs = loadCashierPrefs();
const tipEnabled = ref(cashierPrefs.tipEnabled);
const tipPercent = ref(cashierPrefs.tipPercent);
const printOnPay = ref(cashierPrefs.printOnPay);

watch([tipEnabled, tipPercent, printOnPay], ([enabled, percent, print]) => {
  try {
    localStorage.setItem(
      CASHIER_PREFS_KEY,
      JSON.stringify({ tipEnabled: enabled, tipPercent: percent, printOnPay: print }),
    );
  } catch {
    // Sin almacenamiento (modo privado): las preferencias duran la sesión.
  }
});

/** Propina del pedido que todavía nadie ha pagado (venía en el pedido). */
const unpaidTip = (order: Order) => Math.max(0, Number(order.tip || 0) - Number(order.tip_paid || 0));

/**
 * Lo que aún se debe sin propina. Descuenta los abonos (personas que ya
 * pagaron lo suyo, con su propina) para que "todos juntos" cobre solo a
 * los que faltan.
 */
const consumptionOf = (order: Order) =>
  Math.max(0, Number(order.pending_balance ?? order.total) - unpaidTip(order));

const payBase = computed(() => (selectedOrder.value ? consumptionOf(selectedOrder.value) : 0));

// Cuentas separadas: la propina de cada persona es SOLO lo que el cajero
// escribe (0 por defecto). La sugerencia del % es una referencia; nunca se
// cobra sola para no meterle propina a nadie sin que lo pida.
const guestTips = ref<Record<number, number>>({});
const guestTip = (guest: OrderGuest) => guestTips.value[guest.number ?? 0] ?? 0;
/** Referencia: el % sugerido sobre lo que le falta a esa persona (no se cobra). */
const guestSuggestedTip = (guest: OrderGuest) =>
  tipEnabled.value
    ? Math.round((guest.pending_amount * Math.max(0, Number(tipPercent.value) || 0)) / 100)
    : 0;
const setGuestTip = (guest: OrderGuest, value: string) => {
  guestTips.value[guest.number ?? 0] = Math.max(0, Number(value) || 0);
};
/** Atajo: copia la sugerencia al campo editable; el cajero puede ajustarla o borrarla. */
const useGuestSuggested = (guest: OrderGuest) => {
  guestTips.value[guest.number ?? 0] = guestSuggestedTip(guest);
};

/** Se le ofrece propina al cliente: hay sugerencia y vale más de cero. */
const tipOffered = computed(() => tipEnabled.value && payTip.value > 0);

const suggestedTip = (order: Order) =>
  Math.round((consumptionOf(order) * Math.max(0, Number(tipPercent.value) || 0)) / 100);

// Cambiar el porcentaje o encender la propina recalcula la sugerencia.
watch([tipEnabled, tipPercent], () => {
  if (!selectedOrder.value) return;
  payTip.value = tipEnabled.value ? suggestedTip(selectedOrder.value) : 0;
});

// Cuentas separadas: juntos (un solo cobro) o cada persona lo suyo.
const payMode = ref<'together' | 'split'>('together');

const openPayDialog = async (order: Order) => {
  selectedOrder.value = order;
  payMethod.value = 'cash';
  payTip.value = tipEnabled.value ? suggestedTip(order) : 0;
  payCustomerId.value = null;
  payMode.value = hasGuests(order) ? 'split' : 'together';
  guestTips.value = {};
  payDialog.value = true;
  // El catálogo de clientes se carga una sola vez, al primer cobro.
  if (customers.value.length === 0) {
    try {
      customers.value = await billingService.getCustomers();
    } catch {
      // Sin permiso de clientes: el selector queda vacío y el cobro sigue.
    }
  }
};

/**
 * Registra el pago con o sin propina. El backend asigna aquí el consecutivo
 * de la resolución DIAN (si está configurada); por eso la factura se
 * imprime DESPUÉS y no antes.
 */
const confirmarCobro = async (withTip: boolean) => {
  if (!selectedOrder.value) return;
  const order = selectedOrder.value;
  // La ventana de la factura se abre ya, en el clic; si se abriera después
  // de esperar al servidor el navegador la bloquearía.
  const win = printOnPay.value ? openPrintWindow() : null;
  saving.value = true;
  try {
    const paid = await ordersService.markPaid(order.id, {
      payment_method: payMethod.value,
      // Sin propina se manda 0: si el pedido traía una, queda en cero.
      tip: withTip ? payTip.value : 0,
      customer_id: payCustomerId.value ?? undefined,
    });
    showMessage(withTip ? 'Pedido cobrado con propina' : 'Pedido cobrado');
    payDialog.value = false;
    loadOrders();
    if (win) {
      await printReceipt(paid, win);
    }
  } catch (error) {
    win?.close();
    showMessage(errorMessage(error, 'No fue posible cobrar el pedido. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

/**
 * Cobra lo que debe una persona: sus unidades sin pagar, con el cobro por
 * ítems del backend (que prorratea descuentos y cargos). Cuando paga la
 * última, el pedido queda pagado y sale la factura de toda la mesa.
 */
const cobrarPersona = async (guest: OrderGuest, withTip = false) => {
  const order = selectedOrder.value;
  if (!order) return;

  const items = order.items
    .filter(i => (i.guest_number ?? null) === (guest.number ?? null) && i.unpaid_quantity > 0)
    .map(i => ({ order_item_id: i.id, quantity: i.unpaid_quantity }));
  if (items.length === 0) return;

  // Solo se cobra propina si el cajero la escribió y confirmó "con propina".
  const tip = withTip && tipEnabled.value ? guestTip(guest) : 0;
  const win = printOnPay.value ? openPrintWindow() : null;
  saving.value = true;
  try {
    const updated = await ordersService.recordPartialPayment(order.id, {
      items,
      payment_method: payMethod.value,
      tip: tip > 0 ? tip : undefined,
    });
    selectedOrder.value = updated;
    loadOrders();

    if (updated.payment_status === 'paid') {
      showMessage('Cuenta saldada: todas las personas pagaron');
      payDialog.value = false;
      if (win) await printReceipt(updated, win);
    } else {
      showMessage(`${guest.label} pagó ${money(guest.pending_amount + tip)}`);
      if (win) {
        // Comprobante de lo que pagó esta persona (no es la factura).
        const r = await ordersService.receipt(order.id, guest.number);
        fillPrintWindow(win, `${guest.label} - pedido #${order.id}`, buildTicket(r, order.id, { preBill: true, paidNow: true }));
      }
    }
  } catch (error) {
    win?.close();
    showMessage(errorMessage(error, 'No se pudo cobrar a esta persona'), 'error');
  } finally {
    saving.value = false;
  }
};

// --- Impresión: cuenta (antes de cobrar) y factura (después) ---

const TICKET_WIDTH = 38;

const center = (text: string): string => {
  if (!text || text.length >= TICKET_WIDTH) return text;
  return ' '.repeat(Math.floor((TICKET_WIDTH - text.length) / 2)) + text;
};

/** `ETIQUETA                 $1.000` en el ancho de la tirilla. */
const amountLine = (labelText: string, value: number, sign = ''): string => {
  const left = labelText.padEnd(20);
  return left + (sign + money(value)).padStart(TICKET_WIDTH - left.length);
};

interface TicketOptions {
  /** Cuenta previa al cobro: sin número de factura ni resolución. */
  preBill?: boolean;
  /** Cuenta de una persona que acaba de pagar (comprobante, no factura). */
  paidNow?: boolean;
  /** Propina sugerida al cliente (solo en la cuenta; 0 = no se ofrece). */
  suggestedTip?: number;
  tipPercent?: number;
  /** Abonos previos del pedido (la cuenta muestra lo que falta). */
  amountPaid?: number;
}

/**
 * Tirilla POS (no la e-factura DIAN). Con resolución configurada, el
 * backend le asigna al pedido el consecutivo al cobrarlo y la tirilla sale
 * como FACTURA DE VENTA con los datos de la resolución. Sin número (sin
 * resolución, o cuenta previa) sale como comprobante o cuenta, sin
 * mencionar la resolución: un documento sin consecutivo no es factura.
 */
const buildTicket = (r: OrderReceipt, orderId: number, opts: TicketOptions = {}): string => {
  const line = '-'.repeat(TICKET_WIDTH);
  const isInvoice = !opts.preBill && !!r.invoice_number;

  const rows = r.items
    .map(i => `${String(i.quantity).padEnd(4)}${i.name.slice(0, 22).padEnd(24)}${money(i.total).padStart(10)}`);
  if (r.time_amount && r.time_amount > 0) {
    rows.push(`${'1'.padEnd(4)}${'Tiempo de mesa'.padEnd(24)}${money(r.time_amount).padStart(10)}`);
  }

  const totalWithoutTip = Number(r.total) - Number(r.tip || 0);
  const amountPaid = Number(opts.amountPaid || 0);
  const suggestedTip = Math.max(0, Number(opts.suggestedTip || 0));

  const header = opts.preBill
    ? [
        center(opts.paidNow ? 'COMPROBANTE DE PAGO' : 'CUENTA DE COBRO'),
        center(`Pedido #${orderId}`),
        r.guest ? center(r.guest.label.toUpperCase()) : '',
        center('(No es factura de venta)'),
      ]
    : isInvoice
      ? [
          r.resolution
            ? `Resol. DIAN ${r.resolution.number}${r.resolution.date ? ' de ' + r.resolution.date : ''}`
            : '',
          r.resolution?.range_from
            ? `Autoriza de ${r.resolution.prefix ?? ''}${r.resolution.range_from} a ${r.resolution.prefix ?? ''}${r.resolution.range_to}`
            : '',
          r.resolution?.valid_until
            ? `Vigencia${r.resolution.valid_from ? ' ' + r.resolution.valid_from : ''} hasta ${r.resolution.valid_until}`
            : '',
          `FACTURA DE VENTA No. ${r.invoice_number}`,
        ]
      : [
          center('COMPROBANTE DE VENTA'),
          center(`Pedido #${orderId}`),
        ];

  const totals = opts.preBill
    ? [
        amountLine(suggestedTip > 0 ? 'TOTAL SIN PROPINA' : 'TOTAL', totalWithoutTip),
        amountPaid > 0 ? amountLine('ABONADO', amountPaid, '-') : '',
        amountPaid > 0 ? amountLine('POR PAGAR', totalWithoutTip - amountPaid) : '',
        ...(suggestedTip > 0 && !opts.paidNow
          ? [
              line,
              amountLine(`PROPINA SUGERIDA${opts.tipPercent ? ' ' + opts.tipPercent + '%' : ''}`, suggestedTip),
              amountLine('TOTAL CON PROPINA', totalWithoutTip - amountPaid + suggestedTip),
              line,
              center('La propina es voluntaria.'),
              center('Puede pagar con o sin ella.'),
            ]
          : []),
        ...(opts.paidNow
          ? [line, center('PAGADO'), r.payment_methods.length ? center(r.payment_methods.map(m => label(orderPaymentMethodLabels, m)).join(' + ')) : '']
          : []),
      ]
    : [
        // Con propina, la factura desglosa los dos totales: lo consumido y
        // lo pagado con la propina voluntaria encima.
        r.tip > 0 ? amountLine('TOTAL SIN PROPINA', totalWithoutTip) : '',
        r.tip > 0 ? amountLine('PROPINA VOLUNTARIA', r.tip) : '',
        amountLine(r.tip > 0 ? 'TOTAL PAGADO' : 'TOTAL', r.total),
        r.payment_methods.length
          ? `FORMA DE PAGO: ${r.payment_methods.map(m => label(orderPaymentMethodLabels, m)).join(' + ')}`
          : '',
      ];

  return [
    center(r.business.name || ''),
    center(r.business.legal_name || ''),
    r.business.nit ? center(`NIT ${r.business.nit}`) : '',
    r.business.tax_regime ? center(label(taxRegimeLabels, r.business.tax_regime)) : '',
    center([r.business.address, r.business.city].filter(Boolean).join(' - ')),
    r.business.phone ? center(`Tel. ${r.business.phone}`) : '',
    line,
    ...header,
    line,
    `CLIENTE : ${r.customer.name || 'Consumidor final'}`,
    r.customer.document ? `CC/NIT  : ${r.customer.document}` : '',
    `FECHA   : ${new Date((!opts.preBill && r.paid_at) || r.created_at).toLocaleString('es-CO')}`,
    r.dining_table ? `MESA    : ${r.dining_table}` : '',
    r.waiter ? `ATENDIÓ: ${r.waiter}` : '',
    line,
    'CANT ARTICULO                    VALOR',
    line,
    ...rows,
    line,
    amountLine('SUBTOTAL', r.subtotal),
    r.discount > 0 ? amountLine('DESCUENTO', r.discount, '-') : '',
    r.included_vat > 0 ? amountLine('IVA INCL.', r.included_vat) : '',
    r.delivery_fee > 0 ? amountLine('DOMICILIO', r.delivery_fee) : '',
    ...totals,
    line,
    center(opts.preBill ? '** GRACIAS POR SU VISITA **' : '** GRACIAS POR SU COMPRA **'),
  ].filter(Boolean).join('\n');
};

/**
 * La ventana se abre en el mismo clic (los navegadores bloquean las que se
 * abren después de esperar al servidor) y se llena cuando llega la tirilla.
 */
const openPrintWindow = (): Window | null => {
  const win = window.open('', '_blank', 'width=420,height=650');
  if (!win) {
    showMessage('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error');
    return null;
  }
  win.document.write('<html><body style="font-family:monospace;padding:8px">Generando…</body></html>');
  return win;
};

const fillPrintWindow = (win: Window, title: string, body: string) => {
  win.document.open();
  win.document.write(
    `<html><head><title>${title.replace(/</g, '&lt;')}</title>` +
    '<style>body{font-family:monospace;font-size:12px;white-space:pre;width:80mm;margin:0 auto;padding:8px}</style>' +
    `</head><body>${body.replace(/</g, '&lt;')}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
};

/** Factura (o comprobante) de un pedido ya cobrado. */
const printReceipt = async (order: Order, win: Window | null = openPrintWindow()) => {
  if (!win) return;
  try {
    const r = await ordersService.receipt(order.id);
    fillPrintWindow(win, r.invoice_number || `Pedido #${order.id}`, buildTicket(r, order.id));
  } catch (error) {
    win.close();
    showMessage(errorMessage(error, 'No fue posible generar la factura. Inténtalo de nuevo.'), 'error');
  }
};

/** Cuenta de una sola persona (cuentas separadas), con su parte prorrateada. */
const printGuestBill = async (order: Order, guest: number | null) => {
  const win = openPrintWindow();
  if (!win) return;
  printing.value = true;
  try {
    const r = await ordersService.receipt(order.id, guest);
    // La sugerencia va sobre lo que le falta a ESA persona, no sobre otro total.
    const g = order.guests?.find(x => (x.number ?? null) === (guest ?? null));
    const tipBase = g ? g.pending_amount : Math.max(0, Number(r.total) - Number(r.tip || 0));
    const tip = tipEnabled.value
      ? Math.round((tipBase * Math.max(0, Number(tipPercent.value) || 0)) / 100)
      : 0;
    fillPrintWindow(win, `${r.guest?.label ?? 'Compartido'} - pedido #${order.id}`, buildTicket(r, order.id, {
      preBill: true,
      suggestedTip: tip,
      tipPercent: tipEnabled.value ? tipPercent.value : undefined,
    }));
  } catch (error) {
    win.close();
    showMessage(errorMessage(error, 'No fue posible generar la cuenta. Inténtalo de nuevo.'), 'error');
  } finally {
    printing.value = false;
  }
};

/**
 * Cuenta previa al cobro: el cliente ve cuánto debe, con y sin la propina
 * sugerida, y elige. No lleva número de factura porque todavía no hay venta.
 */
const printPreBill = async (order: Order) => {
  const win = openPrintWindow();
  if (!win) return;
  printing.value = true;
  try {
    const r = await ordersService.receipt(order.id);
    // Desde el diálogo se usa la propina que se esté editando; desde el
    // menú de la fila, la sugerencia configurada.
    const fromDialog = payDialog.value && selectedOrder.value?.id === order.id;
    const tip = tipEnabled.value ? (fromDialog ? payTip.value : suggestedTip(order)) : 0;
    // "Abonado/Por pagar" van SIN propina, igual que el diálogo: se resta solo
    // el consumo ya pagado (amount_paid menos la propina que ya entró), no el
    // dinero con propina, para que "POR PAGAR" cuadre con "Total sin propina".
    const consumptionPaid = Math.max(0, Number(order.amount_paid || 0) - Number(order.tip_paid || 0));
    fillPrintWindow(win, `Cuenta pedido #${order.id}`, buildTicket(r, order.id, {
      preBill: true,
      suggestedTip: tip,
      tipPercent: tipEnabled.value ? tipPercent.value : undefined,
      amountPaid: consumptionPaid,
    }));
  } catch (error) {
    win.close();
    showMessage(errorMessage(error, 'No fue posible generar la cuenta. Inténtalo de nuevo.'), 'error');
  } finally {
    printing.value = false;
  }
};

const openDiscountDialog = (order: Order) => {
  selectedOrder.value = order;
  discountType.value = 'percentage';
  discountValue.value = 0;
  discountReason.value = '';
  discountDialog.value = true;
};

const applyDiscount = async () => {
  if (!selectedOrder.value || discountValue.value <= 0) return;
  saving.value = true;
  try {
    await ordersService.applyDiscount(
      selectedOrder.value.id,
      discountType.value,
      discountValue.value,
      discountReason.value || undefined,
    );
    showMessage('Descuento aplicado');
    discountDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible aplicar el descuento. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

const openPagoDialog = (order: Order) => {
  selectedOrder.value = order;
  pagoDialog.value = true;
};

const cancelarPedido = async (order: Order) => {
  if (!confirm('¿Cancelar este pedido?')) return;
  try {
    await ordersService.cancel(order.id);
    showMessage('Pedido cancelado');
    loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible cancelar el pedido. Inténtalo de nuevo.'), 'error');
  }
};

const openEditItemDialog = (order: Order, item: OrderItem) => {
  selectedOrder.value = order;
  selectedItem.value = item;
  editItemData.value = {
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
    guest_number: item.guest_number ?? null,
  };
  editItemDialog.value = true;
};

const guardarItem = async () => {
  if (!selectedOrder.value || !selectedItem.value) return;
  saving.value = true;
  try {
    // Los empleados solo tocan cantidad y persona; el cobro es cosa del admin.
    const payload = isAdmin.value
      ? editItemData.value
      : { quantity: editItemData.value.quantity, guest_number: editItemData.value.guest_number };
    await ordersService.updateItem(
      selectedOrder.value.id,
      selectedItem.value.id,
      payload,
    );
    showMessage('Item actualizado');
    editItemDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible actualizar. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

const eliminarItem = async () => {
  if (!selectedOrder.value || !selectedItem.value) return;
  if (!confirm('¿Eliminar este producto del pedido?')) return;
  saving.value = true;
  try {
    await ordersService.removeItem(selectedOrder.value.id, selectedItem.value.id);
    showMessage('Item eliminado');
    editItemDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible eliminar. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

// El menú y las mesas se cargan al abrir un diálogo, no al entrar a la página.
const cargarCatalogo = async () => {
  loadingMenu.value = true;
  try {
    const [items, mesas] = await Promise.all([
      menuItemsService.getAll(),
      tablesService.getAvailable().catch(() => []),
    ]);
    menuItems.value = items;
    mesasDisponibles.value = mesas;
  } catch (error) {
    showMessage(errorMessage(error, 'No se pudo cargar el menú'), 'error');
  } finally {
    loadingMenu.value = false;
  }
};

const openNuevoPedidoDialog = () => {
  nuevoPedido.value = {
    dining_table_id: props.tableId ?? null,
    customer_name: '',
    notes: '',
    items: [],
    guest_names: {},
  };
  nuevoPedidoDialog.value = true;
  cargarCatalogo();
};

const agregarAlPedido = (item: any, guest: number | null) => addLine(nuevoPedido.value.items, item, guest);
const quitarDelPedido = (line: PickedLine) => removeLine(nuevoPedido.value.items, line.menu_item_id, line.guest_number);
const agregarASeleccion = (lines: PickedLine[], item: any, guest: number | null) => addLine(lines, item, guest);
const quitarDeSeleccion = (lines: PickedLine[], line: PickedLine) => removeLine(lines, line.menu_item_id, line.guest_number);

// Guarda (o borra si queda vacío) el nombre puesto a una persona.
const setGuestName = (target: Record<number, string>, n: number, name: string) => {
  if (name) {
    target[n] = name;
  } else {
    delete target[n];
  }
};
const renombrarPersonaNueva = (n: number, name: string) => setGuestName(nuevoPedido.value.guest_names, n, name);

const totalNuevoPedido = computed(() => linesTotal(nuevoPedido.value.items));
const totalParaAgregar = computed(() => linesTotal(itemsParaAgregar.value));

const crearPedido = async () => {
  if (nuevoPedido.value.items.length === 0) {
    showMessage('Agrega al menos un producto', 'error');
    return;
  }

  saving.value = true;
  try {
    await ordersService.create({
      dining_table_id: nuevoPedido.value.dining_table_id,
      customer_name: nuevoPedido.value.customer_name || undefined,
      notes: nuevoPedido.value.notes || undefined,
      items: nuevoPedido.value.items.map(line => ({
        menu_item_id: line.menu_item_id,
        quantity: line.quantity,
        guest_number: line.guest_number ?? undefined,
      })),
      guest_names: Object.keys(nuevoPedido.value.guest_names).length ? nuevoPedido.value.guest_names : undefined,
    });

    showMessage('Pedido creado');
    nuevoPedidoDialog.value = false;
    loadOrders();
  } catch (error: any) {
    // La mesa ya tiene un pedido abierto: el backend devuelve cuál es.
    const activo = error.response?.data?.active_order;

    if (activo) {
      showMessage(`La mesa ya tiene el pedido #${activo.id} abierto: agrégale los productos desde ahí.`, 'error');
    } else {
      showMessage(errorMessage(error, 'No fue posible crear el pedido. Inténtalo de nuevo.'), 'error');
    }
  } finally {
    saving.value = false;
  }
};

const openAgregarItemsDialog = (order: Order) => {
  selectedOrder.value = order;
  itemsParaAgregar.value = [];
  agregarGuestNames.value = { ...(order.guest_names ?? {}) };
  agregarItemsDialog.value = true;
  cargarCatalogo();
};

// En un pedido abierto el renombrado se guarda al momento (el pedido ya existe).
const renombrarPersonaExistente = async (n: number, name: string) => {
  if (!selectedOrder.value) return;
  setGuestName(agregarGuestNames.value, n, name);
  try {
    await ordersService.update(selectedOrder.value.id, { guest_names: agregarGuestNames.value });
    await loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No se pudo guardar el nombre'), 'error');
  }
};

const guardarItemsAgregados = async () => {
  if (!selectedOrder.value || itemsParaAgregar.value.length === 0) return;

  saving.value = true;
  try {
    for (const line of itemsParaAgregar.value) {
      await ordersService.addItem(selectedOrder.value.id, {
        menu_item_id: line.menu_item_id,
        quantity: line.quantity,
        guest_number: line.guest_number ?? undefined,
      });
    }

    showMessage('Productos agregados al pedido');
    agregarItemsDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible agregar los productos. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadOrders();
});

// --- En vivo: lo que hace el mesero desde el celular aparece aquí solo ---

/** Un "din" corto para que la caja se entere de un pedido nuevo sin mirar. */
const playNewOrderChime = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Sin audio (o sin interacción previa del usuario): el aviso visual basta.
  }
};

useLiveRefresh(({ latestId, previousLatestId }) => {
  // Recarga sin spinner: la tabla no parpadea mientras se está cobrando.
  loadOrders(true);
  // Desde el plano solo importa la mesa abierta: sin avisos de otros pedidos.
  if (!props.embedded && previousLatestId !== null && latestId > previousLatestId) {
    const count = latestId - previousLatestId;
    showMessage(count === 1 ? `Nuevo pedido #${latestId}` : `${count} pedidos nuevos`, 'info');
    playNewOrderChime();
  }
});
</script>


