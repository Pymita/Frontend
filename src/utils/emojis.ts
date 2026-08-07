/**
 * Set curado de emojis para categorías del menú.
 *
 * Es una lista propia y no una librería: para este uso (elegir un ícono de
 * categoría) un catálogo completo de miles de emojis estorba más de lo que
 * ayuda, y evitamos una dependencia de ~1 MB. Las palabras clave están en
 * español porque el buscador lo usan los dueños del negocio.
 */

export interface EmojiOption {
  emoji: string
  keywords: string[]
}

export interface EmojiGroup {
  name: string
  items: EmojiOption[]
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: 'Comidas',
    items: [
      { emoji: '🍕', keywords: ['pizza'] },
      { emoji: '🍔', keywords: ['hamburguesa', 'burger'] },
      { emoji: '🌭', keywords: ['perro caliente', 'hotdog', 'salchicha'] },
      { emoji: '🥪', keywords: ['sandwich', 'sánduche', 'emparedado'] },
      { emoji: '🌮', keywords: ['taco', 'mexicana'] },
      { emoji: '🌯', keywords: ['burrito', 'wrap'] },
      { emoji: '🥙', keywords: ['arepa', 'pita', 'shawarma'] },
      { emoji: '🍗', keywords: ['pollo', 'asado', 'alitas'] },
      { emoji: '🥩', keywords: ['carne', 'churrasco', 'res'] },
      { emoji: '🥓', keywords: ['tocino', 'cerdo'] },
      { emoji: '🍖', keywords: ['costilla', 'carne', 'asado'] },
      { emoji: '🐟', keywords: ['pescado', 'mojarra'] },
      { emoji: '🦐', keywords: ['camarones', 'mariscos'] },
      { emoji: '🍚', keywords: ['arroz', 'chino'] },
      { emoji: '🍝', keywords: ['pasta', 'espagueti', 'italiana'] },
      { emoji: '🥘', keywords: ['bandeja', 'cazuela', 'guiso', 'paella'] },
      { emoji: '🍲', keywords: ['sopa', 'sancocho', 'caldo'] },
      { emoji: '🥗', keywords: ['ensalada', 'verduras', 'saludable'] },
      { emoji: '🍳', keywords: ['huevos', 'desayuno'] },
      { emoji: '🥞', keywords: ['pancakes', 'desayuno'] },
    ],
  },
  {
    name: 'Panadería y postres',
    items: [
      { emoji: '🍞', keywords: ['pan', 'panadería'] },
      { emoji: '🥖', keywords: ['baguette', 'pan', 'panadería'] },
      { emoji: '🥐', keywords: ['croissant', 'hojaldre', 'panadería'] },
      { emoji: '🥨', keywords: ['pretzel', 'panadería'] },
      { emoji: '🧀', keywords: ['queso', 'pandebono'] },
      { emoji: '🎂', keywords: ['torta', 'pastel', 'cumpleaños'] },
      { emoji: '🍰', keywords: ['ponqué', 'torta', 'postre'] },
      { emoji: '🧁', keywords: ['cupcake', 'magdalena', 'postre'] },
      { emoji: '🍩', keywords: ['dona', 'postre'] },
      { emoji: '🍪', keywords: ['galleta', 'postre'] },
      { emoji: '🍫', keywords: ['chocolate', 'dulce'] },
      { emoji: '🍬', keywords: ['dulce', 'confites'] },
      { emoji: '🍦', keywords: ['helado', 'postre'] },
      { emoji: '🍨', keywords: ['helado', 'copa', 'postre'] },
      { emoji: '🥧', keywords: ['pie', 'tarta', 'postre'] },
      { emoji: '🍮', keywords: ['flan', 'postre'] },
    ],
  },
  {
    name: 'Bebidas',
    items: [
      { emoji: '🍺', keywords: ['cerveza', 'pola'] },
      { emoji: '🍻', keywords: ['cervezas', 'brindis'] },
      { emoji: '🍷', keywords: ['vino', 'copa'] },
      { emoji: '🥃', keywords: ['whisky', 'aguardiente', 'licor', 'ron'] },
      { emoji: '🍸', keywords: ['cóctel', 'coctel', 'trago'] },
      { emoji: '🍹', keywords: ['cóctel', 'tropical', 'jugo'] },
      { emoji: '🍾', keywords: ['botella', 'champaña', 'celebración'] },
      { emoji: '🥤', keywords: ['gaseosa', 'refresco', 'bebida'] },
      { emoji: '🧃', keywords: ['jugo', 'caja'] },
      { emoji: '☕', keywords: ['café', 'tinto', 'caliente'] },
      { emoji: '🍵', keywords: ['té', 'aromática', 'caliente'] },
      { emoji: '🥛', keywords: ['leche', 'malteada'] },
      { emoji: '🧉', keywords: ['mate', 'infusión'] },
      { emoji: '💧', keywords: ['agua', 'botella'] },
    ],
  },
  {
    name: 'Frutas e insumos',
    items: [
      { emoji: '🍎', keywords: ['manzana', 'fruta'] },
      { emoji: '🍌', keywords: ['banano', 'fruta'] },
      { emoji: '🍓', keywords: ['fresa', 'fruta'] },
      { emoji: '🍊', keywords: ['naranja', 'mandarina', 'fruta'] },
      { emoji: '🍋', keywords: ['limón', 'fruta'] },
      { emoji: '🍍', keywords: ['piña', 'fruta'] },
      { emoji: '🥑', keywords: ['aguacate'] },
      { emoji: '🍅', keywords: ['tomate'] },
      { emoji: '🥔', keywords: ['papa', 'patata'] },
      { emoji: '🌽', keywords: ['maíz', 'mazorca'] },
      { emoji: '🥕', keywords: ['zanahoria', 'verdura'] },
      { emoji: '🧅', keywords: ['cebolla'] },
      { emoji: '🧄', keywords: ['ajo'] },
      { emoji: '🌶️', keywords: ['ají', 'picante', 'chile'] },
      { emoji: '🧂', keywords: ['sal', 'condimento'] },
      { emoji: '🫘', keywords: ['frijol', 'granos'] },
    ],
  },
  {
    name: 'Snacks y otros',
    items: [
      { emoji: '🍟', keywords: ['papas fritas', 'snack'] },
      { emoji: '🍿', keywords: ['crispetas', 'palomitas', 'snack'] },
      { emoji: '🥜', keywords: ['maní', 'nueces', 'snack'] },
      { emoji: '🚬', keywords: ['cigarrillos', 'tabaco'] },
      { emoji: '🎱', keywords: ['billar', 'pool', 'mesa'] },
      { emoji: '🎯', keywords: ['dardos', 'juegos'] },
      { emoji: '🎲', keywords: ['juegos', 'dados'] },
      { emoji: '🎁', keywords: ['combo', 'promoción', 'regalo'] },
      { emoji: '🔥', keywords: ['especial', 'promoción', 'destacado'] },
      { emoji: '⭐', keywords: ['favoritos', 'destacado', 'especial'] },
      { emoji: '🛒', keywords: ['abarrotes', 'tienda', 'varios'] },
      { emoji: '📦', keywords: ['otros', 'varios', 'general'] },
    ],
  },
]
