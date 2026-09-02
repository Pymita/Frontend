import api from './api'

/** Resolución de facturación DIAN de la empresa (rango autorizado). */
export interface InvoicingResolution {
  invoicing_resolution: string | null
  resolution_date: string | null
  invoice_prefix: string | null
  range_from: number | null
  range_to: number | null
  current_sequence: number | null
  valid_from: string | null
  valid_until: string | null
}

export interface ResolutionPayload {
  invoicing_resolution: string
  resolution_date?: string | null
  invoice_prefix?: string | null
  range_from: number
  range_to: number
  valid_from?: string | null
  valid_until?: string | null
}

/**
 * Estado del rango: la alerta se calcula en el backend según el ritmo de
 * ventas del local (umbral chico para un local chico, grande para uno grande).
 */
export interface ResolutionStatus {
  configured: boolean
  remaining?: number
  threshold?: number
  daily_average?: number
  expires_in_days?: number | null
  warning: boolean
  blocking?: boolean
  message?: string | null
}

interface ApiEnvelope<T> {
  data: T
  message?: string
}

class InvoicingService {
  async resolution(): Promise<InvoicingResolution> {
    const response = await api.get<ApiEnvelope<InvoicingResolution>>('/invoicing/resolution')
    return response.data.data
  }

  async saveResolution(payload: ResolutionPayload): Promise<InvoicingResolution> {
    const response = await api.put<ApiEnvelope<InvoicingResolution>>('/invoicing/resolution', payload)
    return response.data.data
  }

  async status(): Promise<ResolutionStatus> {
    const response = await api.get<ApiEnvelope<ResolutionStatus>>('/invoicing/resolution-status')
    return response.data.data
  }
}

export default new InvoicingService()
