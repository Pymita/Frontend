/**
 * Líneas de pedido mientras se arman en pantalla, antes de mandarlas a la API.
 * Lo comparten el diálogo de nuevo pedido y el de agregar productos.
 */
export interface PickedLine {
  menu_item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
}

/** El precio que se cobra es el final: puede venir de una variante o un ajuste. */
export const priceOf = (item: any): number =>
  Number(item.final_price ?? item.custom_price ?? item.base_price ?? 0);

/** Suma una unidad del producto, o crea la línea si aún no está. */
export const addLine = (lines: PickedLine[], item: any): void => {
  const existing = lines.find(line => line.menu_item_id === item.id);

  if (existing) {
    existing.quantity += 1;
    return;
  }

  lines.push({
    menu_item_id: item.id,
    name: item.name,
    unit_price: priceOf(item),
    quantity: 1,
  });
};

/** Quita una unidad; al llegar a cero la línea desaparece. */
export const removeLine = (lines: PickedLine[], menuItemId: number): void => {
  const index = lines.findIndex(line => line.menu_item_id === menuItemId);
  const line = lines[index];
  if (!line) return;

  line.quantity -= 1;

  if (line.quantity <= 0) {
    lines.splice(index, 1);
  }
};

export const linesTotal = (lines: PickedLine[]): number =>
  lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
