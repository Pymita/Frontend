import type { ThemeDefinition, VuetifyOptions } from 'vuetify'

/**
 * Brand parameters: the only colors to edit to rebrand the app. Every other
 * brand color (containers, the sidebar, the text drawn on top of them) is
 * derived below, so the whole UI follows and stays readable (WCAG AA).
 * Mirrored in mobile/src/theme.ts.
 */
export const brand = {
  primary: '#1D66B0',
  secondary: '#475669',
  accent: '#0ECABD',
}

/** Font stacks. The files are bundled by the @fontsource-variable imports in main.ts. */
export const fonts = {
  heading: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
}

const INK = '#111A24'
const WHITE = '#FFFFFF'

// States do not follow the brand ("paid" stays green whatever the brand is),
// and the neutrals keep text readable on top of any brand color.
const fixedColors = {
  background: '#F1F4F8',
  'on-background': INK,
  surface: WHITE,
  'on-surface': INK,
  'surface-bright': WHITE,
  'surface-light': '#F1F4F8',
  // Vuetify paints tooltips with surface-variant.
  'surface-variant': '#1F2A37',
  'on-surface-variant': '#F1F4F8',
}

const stateColors = {
  success: '#1A7347',
  warning: '#935600',
  error: '#B3261E',
  info: '#0B6780',
}

type Rgb = [number, number, number]

const toRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const toHex = (rgb: Rgb) =>
  '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

/** `weight` parts of `a`, the rest of `b`. */
const mix = (a: string, b: string, weight: number) => {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  const blend = (x: number, y: number) => x * weight + y * (1 - weight)
  return toHex([blend(ar, br), blend(ag, bg), blend(ab, bb)])
}

const tint = (color: string, amount: number) => mix(color, WHITE, 1 - amount)
const shade = (color: string, amount: number) => mix(color, '#000000', 1 - amount)

const linear = (channel: number) => {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

const contrast = (a: string, b: string) => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Moves `color` toward black (or white) in 5 % steps until it reads on `background`. */
const readableOn = (color: string, background: string, minRatio: number, toward: 'black' | 'white' = 'black') => {
  let result = color
  for (let step = 1; step <= 20 && contrast(result, background) < minRatio; step++) {
    result = toward === 'black' ? shade(color, step * 0.05) : tint(color, step * 0.05)
  }
  return result
}

const textOn = (background: string) => (contrast(WHITE, background) >= 4.5 ? WHITE : INK)

/** A color plus its soft container and the text that goes on each. */
function role(name: string, base: string): Record<string, string> {
  const container = tint(base, 0.86)
  return {
    [name]: base,
    [`on-${name}`]: textOn(base),
    [`${name}-container`]: container,
    [`on-${name}-container`]: readableOn(shade(base, 0.5), container, 7),
  }
}

/** The app frame (sidebar here, screen headers on mobile): the primary, darkened. */
function chrome(primary: string): Record<string, string> {
  const background = shade(primary, 0.62)
  return {
    chrome: background,
    'on-chrome': WHITE,
    'chrome-text': readableOn(tint(primary, 0.7), background, 7, 'white'),
    'chrome-overline': readableOn(tint(primary, 0.45), background, 4.5, 'white'),
    'chrome-active': mix(primary, background, 0.35),
    'on-chrome-active': WHITE,
    'chrome-indicator': readableOn(tint(primary, 0.25), background, 3, 'white'),
  }
}

if (import.meta.env.DEV && contrast(brand.primary, WHITE) < 4.5) {
  console.warn(
    `brand.primary ${brand.primary} reaches ${contrast(brand.primary, WHITE).toFixed(2)}:1 on white; ` +
      'links and text buttons need 4.5:1. Pick a darker primary.',
  )
}

export const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    ...fixedColors,
    ...role('primary', brand.primary),
    ...role('secondary', brand.secondary),
    ...role('accent', brand.accent),
    ...chrome(brand.primary),
    ...Object.entries(stateColors).reduce((all, [name, base]) => ({ ...all, ...role(name, base) }), {}),
  },
  variables: {
    'font-heading': fonts.heading,
    'font-body': fonts.body,
    'border-color': INK,
    'border-opacity': 0.12,
    // text-medium-emphasis at 0.68 keeps 6:1 on white (the default 0.6 is borderline).
    'medium-emphasis-opacity': 0.68,
  },
}

/** Global component props: flat bordered cards; dialogs keep their elevation. */
export const componentDefaults: VuetifyOptions['defaults'] = {
  VCard: { elevation: 0, border: true, rounded: 'lg' },
  VDialog: { VCard: { elevation: 8, border: false } },
}
