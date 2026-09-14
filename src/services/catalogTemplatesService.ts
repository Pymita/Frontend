import api from './api'

/**
 * Catálogos base (solo plataforma): empresas plantilla cuyo catálogo se copia
 * a un cliente nuevo para que no arranque con la app vacía.
 */

export interface CatalogTemplate {
  id: number
  name: string
  business_type: string
  categories_count: number
  products_count: number
}

export interface TemplateCategory {
  id: number
  name: string
  parent_id: number | null
  icon: string | null
}

export interface TemplateProduct {
  id: number
  name: string
  category_id: number | null
  unit: string
  sale_price: number | null
  type: string
}

export interface TemplateCatalog {
  company: { id: number; name: string; business_type: string; is_template: boolean }
  categories: TemplateCategory[]
  products: TemplateProduct[]
}

export interface CopyResult {
  categories: number
  products: number
  menu_items: number
}

interface ApiEnvelope<T> {
  data: T
  message?: string
}

export const catalogTemplatesService = {
  async list(): Promise<CatalogTemplate[]> {
    const response = await api.get<ApiEnvelope<CatalogTemplate[]>>('/platform/catalog-templates')
    return response.data.data
  },

  async catalog(templateId: number): Promise<TemplateCatalog> {
    const response = await api.get<ApiEnvelope<TemplateCatalog>>(
      `/platform/catalog-templates/${templateId}`,
    )
    return response.data.data
  },

  /** Copia lo elegido a la empresa destino. */
  async copy(
    companyId: number,
    payload: { source_company_id: number; category_ids: number[]; product_ids: number[] },
  ): Promise<CopyResult> {
    const response = await api.post<ApiEnvelope<CopyResult>>(
      `/platform/companies/${companyId}/copy-catalog`,
      payload,
    )
    return response.data.data
  },
}
