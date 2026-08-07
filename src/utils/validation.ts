/**
 * Reglas de contraseña compartidas por los formularios (espejo de las
 * reglas del backend): 8-64 caracteres, con al menos una letra y un número.
 */

export const PASSWORD_HINT = 'Entre 8 y 64 caracteres, con al menos una letra y un número'

export const passwordRules = [
  (v: string) => !!v || 'Contraseña requerida',
  (v: string) => (v?.length ?? 0) >= 8 || 'Debe tener al menos 8 caracteres',
  (v: string) => (v?.length ?? 0) <= 64 || 'No puede superar los 64 caracteres',
  (v: string) => /[A-Za-z]/.test(v || '') || 'Debe incluir al menos una letra',
  (v: string) => /[0-9]/.test(v || '') || 'Debe incluir al menos un número',
]

/** Igual que passwordRules pero permite dejar el campo vacío (edición) */
export const optionalPasswordRules = [
  (v: string) => !v || v.length >= 8 || 'Debe tener al menos 8 caracteres',
  (v: string) => !v || v.length <= 64 || 'No puede superar los 64 caracteres',
  (v: string) => !v || /[A-Za-z]/.test(v) || 'Debe incluir al menos una letra',
  (v: string) => !v || /[0-9]/.test(v) || 'Debe incluir al menos un número',
]
