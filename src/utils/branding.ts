/**
 * Nombre del producto (no de un cliente): esta pantalla la ven todas las
 * empresas, así que aquí no puede aparecer el nombre de una de ellas.
 * Configurable con VITE_APP_NAME para poder renombrarlo sin tocar código.
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Servify POS'

export const APP_TAGLINE = import.meta.env.VITE_APP_TAGLINE || 'Sistema de Gestión'

/** Ícono de la marca: el mismo en la barra, el login y la app móvil. */
export const APP_ICON = 'mdi-storefront'
