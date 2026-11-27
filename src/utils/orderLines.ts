import { QUANTITY_DECIMALS, quantityStep } from './money';

/**
 * Líneas de pedido mientras se arman en pantalla, antes de mandarlas a la API.
 * Lo comparten el diálogo de nuevo pedido y el de agregar productos.
 */
export interface PickedLine {
  menu_item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  /** Se vende por fracción en esta unidad ("kg"): la cantidad lleva decimales. Null = unidades enteras. */
  unit: string | null;
  /** Cuentas separadas: persona de la mesa (null = compartido) */
  guest_number: number | null;
  /** Typed by someone with "Cambiar precio en pedidos": sent as `unit_price`, kept when the customer changes. */
  price_changed?: boolean;
}

/**
 * El precio que se cobra es el final: puede venir de una variante o un ajuste.
 * El menú lo manda como `price`; `base_price` no lleva el precio propio ni la variante.
 */
export const priceOf = (item: any): number =>
  Number(item.price ?? item.final_price ?? item.custom_price ?? item.base_price ?? 0);

/** A quantity without JavaScript's float noise (0,1 + 0,2), to the gram. */
const toGrams = (value: number): number => Number(value.toFixed(QUANTITY_DECIMALS));

const isWhole = (value: number): boolean => Number.isInteger(toGrams(value));

/**
 * Lo que cobra una línea: la misma regla que `OrderItem::lineTotal()` del
 * backend (y `lineTotal()` de la app de meseros), así lo que se ve es lo que
 * se cobra. Lo pesado se redondea a pesos (0,375 kg × $5.980 = $2.243); las
 * unidades enteras siguen siendo precio × unidades.
 */
export const lineTotal = (unitPrice: number | string, quantity: number | string): number => {
  const units = Number(quantity) || 0;
  const total = Number(((Number(unitPrice) || 0) * units).toFixed(6));
  return isWhole(units) ? Math.round(total * 100) / 100 : Math.round(total);
};

/** La unidad en que se vende un producto del menú por fracción, o null si va por unidades. */
export const fractionUnitOf = (item: any): string | null =>
  item?.sold_by_fraction ? (item.unit || 'kg') : null;

const sameLine = (line: PickedLine, menuItemId: number, guest: number | null) =>
  line.menu_item_id === menuItemId && (line.guest_number ?? null) === (guest ?? null);

/** Suma una unidad del producto para esa persona, o crea la línea si aún no está. */
export const addLine = (lines: PickedLine[], item: any, guest: number | null = null): void => {
  const existing = lines.find(line => sameLine(line, item.id, guest));

  if (existing) {
    existing.quantity = toGrams(existing.quantity + quantityStep(existing.unit));
    return;
  }

  // Lo pesado arranca en 1 kg (o 1 litro): luego se escribe lo que marcó la balanza.
  lines.push({
    menu_item_id: item.id,
    name: item.name,
    unit_price: priceOf(item),
    quantity: 1,
    unit: fractionUnitOf(item),
    guest_number: guest ?? null,
  });
};

/** Quita una unidad (o un paso de lo pesado); al llegar a cero la línea desaparece. */
export const removeLine = (lines: PickedLine[], menuItemId: number, guest: number | null = null): void => {
  const index = lines.findIndex(line => sameLine(line, menuItemId, guest));
  const line = lines[index];
  if (!line) return;

  line.quantity = toGrams(line.quantity - quantityStep(line.unit));

  if (line.quantity <= 0) {
    lines.splice(index, 1);
  }
};

export const linesTotal = (lines: PickedLine[]): number =>
  lines.reduce((sum, line) => sum + lineTotal(line.unit_price, line.quantity), 0);

/** Cuántas personas hay en la selección (la mayor numerada). */
export const guestsIn = (lines: PickedLine[]): number =>
  lines.reduce((max, line) => Math.max(max, line.guest_number ?? 0), 0);

/** The name given to the person, else "Persona N": the same rule as the API's `Order::guestLabel()`. */
export const guestLabel = (guest: number | null | undefined, names?: Record<number, string> | null): string =>
  guest ? names?.[guest]?.trim() || `Persona ${guest}` : 'Compartido';

/** A price typed for the line ("Cambiar precio en pedidos"); the API checks the permission again. */
export const setLinePrice = (line: PickedLine, price: number): void => {
  line.unit_price = price;
  line.price_changed = true;
};

/**
 * The menu came back priced for another customer (its price list): every
 * line nobody typed a price for takes the new one, as the API will charge it.
 */
export const repriceLines = (lines: PickedLine[], menuItems: any[]): void => {
  for (const line of lines) {
    if (line.price_changed) continue;
    const item = menuItems.find(candidate => candidate.id === line.menu_item_id);
    if (item) line.unit_price = priceOf(item);
  }
};

/** What `POST /orders` and `/orders/{id}/items` take for a line: the price only when it was typed. */
export const linePayload = (line: PickedLine) => ({
  menu_item_id: line.menu_item_id,
  quantity: line.quantity,
  guest_number: line.guest_number ?? undefined,
  ...(line.price_changed ? { unit_price: line.unit_price } : {}),
});
