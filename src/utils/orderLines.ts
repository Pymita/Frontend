/**
 * Líneas de pedido mientras se arman en pantalla, antes de mandarlas a la API.
 * Lo comparten el diálogo de nuevo pedido y el de agregar productos.
 */
export interface PickedLine {
  menu_item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  /** Cuentas separadas: persona de la mesa (null = compartido) */
  guest_number: number | null;
}

/** El precio que se cobra es el final: puede venir de una variante o un ajuste. */
export const priceOf = (item: any): number =>
  Number(item.final_price ?? item.custom_price ?? item.base_price ?? 0);

const sameLine = (line: PickedLine, menuItemId: number, guest: number | null) =>
  line.menu_item_id === menuItemId && (line.guest_number ?? null) === (guest ?? null);

/** Suma una unidad del producto para esa persona, o crea la línea si aún no está. */
export const addLine = (lines: PickedLine[], item: any, guest: number | null = null): void => {
  const existing = lines.find(line => sameLine(line, item.id, guest));

  if (existing) {
    existing.quantity += 1;
    return;
  }

  lines.push({
    menu_item_id: item.id,
    name: item.name,
    unit_price: priceOf(item),
    quantity: 1,
    guest_number: guest ?? null,
  });
};

/** Quita una unidad; al llegar a cero la línea desaparece. */
export const removeLine = (lines: PickedLine[], menuItemId: number, guest: number | null = null): void => {
  const index = lines.findIndex(line => sameLine(line, menuItemId, guest));
  const line = lines[index];
  if (!line) return;

  line.quantity -= 1;

  if (line.quantity <= 0) {
    lines.splice(index, 1);
  }
};

export const linesTotal = (lines: PickedLine[]): number =>
  lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

/** Cuántas personas hay en la selección (la mayor numerada). */
export const guestsIn = (lines: PickedLine[]): number =>
  lines.reduce((max, line) => Math.max(max, line.guest_number ?? 0), 0);

/** Etiqueta corta de la persona, para chips. */
export const guestLabel = (guest: number | null | undefined): string =>
  guest ? `Persona ${guest}` : 'Compartido';
