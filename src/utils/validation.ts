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

/** "Confirmar contraseña" must repeat the new password: a typo hides behind the dots. */
export const confirmPasswordRules = (password: () => string) => [
  (v: string) => (v ?? '') === (password() ?? '') || 'Las contraseñas no coinciden.',
]

/** The one the platform dictated is known by someone else (AuthController::changePassword, same message). */
export const differentFromTemporaryRules = (temporary: () => string) => [
  (v: string) => !v || v !== temporary() || 'Elige una contraseña distinta de la temporal que te dieron.',
]

/*
 * Número de documento: espejo de Customer::normalizeDocument(),
 * Customer::documentProblem(), Customer::verificationDigit() y
 * Customer::documentBase() del backend, con los mismos mensajes.
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
/** A dash and one letter at the end tell apart customers with the same document ("123-A"); a NIT's "-7" is its DV. */
const SUFFIX = /^(.*[\p{L}\d])-([A-Za-z])$/u
const DV_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
/** Their number has a verification digit: a natural person with RUT uses the cédula as NIT. */
export const VERIFICATION_DIGIT_TYPES = ['NIT', 'CC']

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

/**
 * Como se guarda el documento: "1.002.655.357" → "1002655357"; un NIT sin
 * su dígito de verificación, que se calcula ("900.608.736 - 8" →
 * "900608736"); un guion y una letra al final se quedan ("123-a" → "123-A").
 * Sin tipo (proveedores, una búsqueda) el NIT conserva su dígito.
 */
export const normalizeDocument = (value?: string | null, type?: string | null): string => {
  const compact = compactDocument(value)
  const suffix = compact.match(SUFFIX)
  if (suffix && documentKind(suffix[1]!, type) !== 'text') {
    return `${normalizeDocument(suffix[1], type)}-${suffix[2]!.toUpperCase()}`
  }
  switch (documentKind(compact, type)) {
    case 'nit': {
      const parts = compact.match(NIT_WITH_DV)
      if (!parts) return compact.replace(/[.,]/g, '')
      const number = parts[1]!.replace(/[.,]/g, '')
      return type === 'NIT' ? number : `${number}-${parts[2]}`
    }
    case 'numeric':
      return compact.replace(/[.,-]/g, '')
    default:
      return compact.toUpperCase()
  }
}

/**
 * The DIAN verification digit of a NIT: each digit, from the right, times
 * its weight; r = the sum mod 11; r when 0 or 1, else 11 − r. Null unless
 * the number is 1 to 15 digits.
 */
export const verificationDigit = (number?: string | null): string | null => {
  if (!number || !/^\d{1,15}$/.test(number)) return null
  const sum = [...number].reverse().reduce((total, digit, position) => total + Number(digit) * DV_WEIGHTS[position]!, 0)
  const remainder = sum % 11
  return String(remainder < 2 ? remainder : 11 - remainder)
}

/** The number documents print, without the letter that tells customers apart: "123-A" → "123". */
export const documentBase = (document?: string | null): string => {
  const value = document ?? ''
  return value.match(SUFFIX)?.[1] ?? value
}

/** The DV of a stored document of that type: NIT and CC have one, from the number without its letter. */
export const customerVerificationDigit = (type?: string | null, document?: string | null): string | null =>
  type && VERIFICATION_DIGIT_TYPES.includes(type) ? verificationDigit(documentBase(document)) : null

/** Qué tiene mal el documento y qué escribir; null si está bien o vacío. */
export const documentProblem = (value?: string | null, type?: string | null): string | null => {
  const typed = (value ?? '').trim()
  const compact = compactDocument(value)
  if (compact === '') return null

  const document = normalizeDocument(value, type)
  const name = (type && DOCUMENT_NAMES[type]) || 'El documento'
  const kind = documentKind(compact, type)
  // The letter that tells two customers apart is checked apart from the number.
  const suffix = compact.match(SUFFIX)
  const withoutLetter = suffix && kind !== 'text' ? suffix[1]! : compact
  const invalidNit = `El NIT «${typed}» no es válido: escribe solo los números y, si lo tienes, el dígito de verificación después de un guion, como 900123456-8.`

  switch (kind) {
    case 'nit': {
      if (type !== 'NIT') return /^\d+(-\d)?$/.test(document) ? null : invalidNit
      const digits = document.match(/^(\d+)(?:-[A-Z])?$/)
      if (!digits) return invalidNit
      const typedDigit = withoutLetter.match(NIT_WITH_DV)
      if (!typedDigit) return null
      const computed = verificationDigit(digits[1])
      if (computed === null) return `El NIT «${typed}» tiene más de 15 dígitos: revisa el número.`
      return computed === typedDigit[2]
        ? null
        : `El dígito de verificación del NIT ${digits[1]} es ${computed}, no ${typedDigit[2]}: revisa el número o escríbelo sin el dígito, que lo calcula el sistema.`
    }
    case 'numeric':
      if (NIT_WITH_DV.test(withoutLetter)) {
        return `${name} «${typed}» parece un NIT con su dígito de verificación: si es un NIT, elige el tipo NIT; si no, escribe el número sin ese dígito.`
      }
      if (document === '') return `${name} «${typed}» no tiene números: escribe solo los números del documento.`
      if (!/^\d+$/.test(documentBase(document))) return `${name} «${typed}» tiene letras o símbolos: escribe solo los números del documento.`
      return null
    default:
      return /[\p{L}\d]/u.test(document)
        ? null
        : `El documento «${typed}» no tiene letras ni números: escríbelo como aparece en el documento.`
  }
}

/** Regla de Vuetify para el número de documento del tipo elegido. */
export const documentRule = (type?: string | null) => (v: string) => documentProblem(v, type) ?? true

/** An accounting account (PUC): blank, or 1 to 20 digits (PUT /accounting/settings, same message). */
export const ACCOUNT_MAX_LENGTH = 20

export const accountProblem = (value: string | null | undefined, name: string): string | null => {
  const account = (value ?? '').trim()
  return account === '' || /^\d{1,20}$/.test(account) ? null : `La cuenta de ${name} debe tener solo números (p. ej., 110505).`
}

export const accountRule = (name: string) => (v: string | null) => accountProblem(v, name) ?? true

/** A payment method of the company (PaymentMethodController, same messages): name 1–40, bank account up to 100, one document at least. */
export const PAYMENT_METHOD_NAME_MAX_LENGTH = 40
export const BANK_ACCOUNT_MAX_LENGTH = 100
export const PAYMENT_METHOD_DOCUMENTS_MESSAGE =
  'Elige al menos un documento donde se use la forma de pago: ventas, recibos de caja, abonos a pedidos o movimientos financieros.'

export const paymentMethodNameRules = [
  (v: string | null) => !!(v ?? '').trim() || 'Escribe el nombre de la forma de pago.',
  (v: string | null) =>
    (v ?? '').trim().length <= PAYMENT_METHOD_NAME_MAX_LENGTH || 'El nombre de la forma de pago puede tener máximo 40 caracteres.',
]

export const bankAccountRule = (v: string | null) =>
  (v ?? '').trim().length <= BANK_ACCOUNT_MAX_LENGTH || 'La cuenta bancaria puede tener máximo 100 caracteres.'
