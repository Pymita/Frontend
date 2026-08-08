/**
 * Mensaje de error listo para mostrarle al usuario.
 *
 * El backend explica en `message` qué pasó y qué hacer ("Tu plan permite
 * hasta 10 mesas..."). Mostrar un genérico en su lugar deja al usuario
 * sin saber por qué falló y obliga a abrir la consola del navegador.
 */
export const errorMessage = (error: any, fallback = 'Ocurrió un error inesperado'): string => {
  const data = error?.response?.data

  if (data?.message) {
    return data.message
  }

  // Errores de validación por campo: se muestra el primero.
  const firstField = data?.errors ? Object.values(data.errors)[0] : null
  if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
    return firstField[0]
  }

  // Sin respuesta del servidor: se cayó la red o el backend no responde.
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
  }

  return fallback
}
