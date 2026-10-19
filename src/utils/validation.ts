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

/*
 * Número de documento: espejo de Customer::normalizeDocument() y
 * Customer::documentProblem() del backend, con los mismos mensajes.
 */
const DOCUMENT_TYPES = ['CC', 'NIT', 'CE', 'Pasaporte', 'TI', 'PEP', 'DIE', 'NUIP']
const NUMERIC_DOCUMENT_TYPES = ['CC', 'TI', 'NUIP']
const MOSTLY_NUMERIC_DOCUMENT_TYPES = ['CE', 'PEP']
const DOCUMENT_NAMES: Record<string, string> = {
  CC: 'La cédula',
  TI: 'La tarjeta de identidad',
  NUIP: 'El NUIP',
  NIT: 'El NIT',
  CE: 'La cédula de extranjería',
  PEP: 'El PEP',
}
const NIT_WITH_DV = /^([\d.,]+)-(\d)$/

const compactDocument = (value?: string | null): string =>
  (value ?? '').replace(/[ \t\n\v\f\r\u00A0\u2007\u202F\u200B\uFEFF]+/g, '').replace(/[‐‑‒–—−]/g, '-')

const documentKind = (compact: string, type?: string | null): 'nit' | 'numeric' | 'text' => {
  const known = (list: string[]) => !!type && list.includes(type)
  if (type === 'NIT') return 'nit'
  if (known(NUMERIC_DOCUMENT_TYPES)) return 'numeric'
  if (known(DOCUMENT_TYPES) && !known(MOSTLY_NUMERIC_DOCUMENT_TYPES)) return 'text'
  if (!known(MOSTLY_NUMERIC_DOCUMENT_TYPES) && NIT_WITH_DV.test(compact)) return 'nit'
  return /^\d+$/.test(compact.replace(/[.,-]/g, '')) ? 'numeric' : 'text'
}

/** Como se guarda el documento: "1.002.655.357" → "1002655357", "900.608.736 - 1" → "900608736-1". */
export const normalizeDocument = (value?: string | null, type?: string | null): string => {
  const compact = compactDocument(value)
  switch (documentKind(compact, type)) {
    case 'nit': {
      const parts = compact.match(NIT_WITH_DV)
      return parts ? `${parts[1]!.replace(/[.,]/g, '')}-${parts[2]}` : compact.replace(/[.,]/g, '')
    }
    case 'numeric':
      return compact.replace(/[.,-]/g, '')
    default:
      return compact.toUpperCase()
  }
}

/** Qué tiene mal el documento y qué escribir; null si está bien o vacío. */
export const documentProblem = (value?: string | null, type?: string | null): string | null => {
  const typed = (value ?? '').trim()
  const compact = compactDocument(value)
  if (compact === '') return null

  const document = normalizeDocument(value, type)
  const name = (type && DOCUMENT_NAMES[type]) || 'El documento'

  switch (documentKind(compact, type)) {
    case 'nit':
      return /^\d+(-\d)?$/.test(document)
        ? null
        : `El NIT «${typed}» no es válido: escribe solo los números y, si lo tienes, el dígito de verificación después de un guion, como 900123456-1.`
    case 'numeric':
      if (NIT_WITH_DV.test(compact)) {
        return `${name} «${typed}» parece un NIT con su dígito de verificación: si es un NIT, elige el tipo NIT; si no, escribe el número sin ese dígito.`
      }
      if (document === '') return `${name} «${typed}» no tiene números: escribe solo los números del documento.`
      if (!/^\d+$/.test(document)) return `${name} «${typed}» tiene letras o símbolos: escribe solo los números del documento.`
      return null
    default:
      return /[\p{L}\d]/u.test(document)
        ? null
        : `El documento «${typed}» no tiene letras ni números: escríbelo como aparece en el documento.`
  }
}

/** Regla de Vuetify para el número de documento del tipo elegido. */
export const documentRule = (type?: string | null) => (v: string) => documentProblem(v, type) ?? true
