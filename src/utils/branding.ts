/**
 * Nombre del producto (no de un cliente): esta pantalla la ven todas las
 * empresas, así que aquí no puede aparecer el nombre de una de ellas.
 * Configurable con VITE_APP_NAME para poder renombrarlo sin tocar código.
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Servify POS'

export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE || 'Sistema de gestión'

/**
 * Product mark (rounded icon, 192 px): sidebar, login and the waiter app. It
 * never stands in for a company's own logo, which is that tenant's data.
 * Resolved against BASE_URL because staging is served under /Frontend/.
 */
export const APP_ICON = `${import.meta.env.BASE_URL}servify-pos-icon.png`
