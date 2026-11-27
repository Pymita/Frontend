/**
 * The tax math of one line on the web, mirror of the backend's
 * `App\Support\TaxMath` (one helper per layer). A tax is a percentage of the
 * value before taxes or a fixed amount in pesos per unit; percentages never
 * compound (IVA and impoconsumo share one base) and a per-unit tax is not
 * part of their base. A purchase cost is typed before taxes (`onCost`).
 */
import type { Tax } from '@/services/kardexService'
import { money } from './money'

type TaxLike = Pick<Tax, 'calculation' | 'rate' | 'amount'>

/** What one tax charges on a purchase line of `base` (before taxes) and `quantity` units. */
export const taxOnCost = (tax: TaxLike, base: number, quantity: number): number =>
  Math.round((tax.calculation === 'per_unit' ? tax.amount * quantity : base * tax.rate / 100) * 100) / 100

/** "19%" or "$68 c/u", as the documents print it. */
export const taxRateLabel = (tax: TaxLike): string =>
  tax.calculation === 'per_unit' ? `${money(tax.amount)} c/u` : `${Number(tax.rate).toLocaleString('es-CO', { maximumFractionDigits: 2 })}%`

/** A tax as a select lists it: its name, and its figure when the name does not say it. */
export const taxOptionTitle = (tax: Tax): string => {
  const figure = taxRateLabel(tax)
  return tax.name.includes(figure.replace(' c/u', '')) ? tax.name : `${tax.name} (${figure})`
}

/**
 * Whether what is paid for a tax when buying is inventory cost: the tax says
 * so, or it is an IVA and the company is not responsable de IVA (backend
 * `Tax::addsToCost()`).
 */
export const taxAddsToCost = (tax: Pick<Tax, 'in_cost' | 'kind'>, companyChargesIva: boolean): boolean =>
  tax.in_cost || (tax.kind === 'iva' && !companyChargesIva)

/**
 * A price that includes its taxes, split as a sale splits it (backend
 * `TaxMath::split()`): the fixed taxes first, then base = rest / (1 + Σ%/100).
 */
export const splitPrice = (taxes: TaxLike[], price: number, quantity = 1): { base: number; amounts: number[] } => {
  const fixed = taxes.reduce((sum, tax) => sum + (tax.calculation === 'per_unit' ? tax.amount * quantity : 0), 0)
  const factor = fixed > price && fixed > 0 ? price / fixed : 1
  const rate = taxes.reduce((sum, tax) => sum + (tax.calculation === 'per_unit' ? 0 : Number(tax.rate)), 0)
  const base = (price - fixed * factor) / (1 + rate / 100)
  return {
    base,
    amounts: taxes.map(tax => (tax.calculation === 'per_unit' ? tax.amount * quantity * factor : base * tax.rate / 100)),
  }
}
