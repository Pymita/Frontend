import { onBeforeUnmount, ref, watch, type Ref, type WatchSource } from 'vue'
import type { PageQuery, PaginatedResponse } from '@/types/api'

interface SortItem {
  key: string
  order?: boolean | 'asc' | 'desc'
}

/** Tamaños que ofrece el pie de la tabla; el backend no entrega más de 100. */
export const PAGE_SIZE_OPTIONS = [
  { value: 10, title: '10' },
  { value: 25, title: '25' },
  { value: 50, title: '50' },
  { value: 100, title: '100' },
]

/**
 * Tabla paginada en el servidor (v-data-table-server): trae solo la página
 * visible. Cambiar la búsqueda o un filtro vuelve a la página 1; escribir en
 * el buscador espera un momento para no consultar por cada tecla.
 */
export function useServerPage<T>(
  fetchPage: (query: PageQuery) => Promise<PaginatedResponse<T>>,
  options: { perPage?: number; filters?: WatchSource[]; onError?: (error: unknown) => void } = {},
) {
  const items = ref([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(options.perPage ?? 25)
  const sortBy = ref<SortItem[]>([])
  const search = ref<string | null>('')
  const loading = ref(false)
  let latestRequest = 0

  const query = (): PageQuery => {
    const sort = sortBy.value[0]
    const term = search.value?.trim()
    return {
      page: page.value,
      per_page: perPage.value,
      ...(term ? { q: term } : {}),
      ...(sort ? { sort_by: sort.key, sort_dir: sort.order === 'desc' ? 'desc' : 'asc' } : {}),
    }
  }

  /** `silent`: recarga sin spinner (refresco en vivo mientras se trabaja). */
  const load = async ({ silent = false } = {}) => {
    const request = ++latestRequest
    if (!silent) loading.value = true
    try {
      const result = await fetchPage(query())
      if (request !== latestRequest) return
      // Se borró lo último de la última página: mostrar la anterior, no una vacía.
      if (!result.data.length && page.value > result.meta.last_page) {
        page.value = result.meta.last_page
        return
      }
      items.value = result.data
      total.value = result.meta.total
    } catch (error) {
      if (request === latestRequest) options.onError?.(error)
    } finally {
      if (request === latestRequest) loading.value = false
    }
  }

  const restart = () => {
    if (page.value === 1) load()
    else page.value = 1
  }

  watch([page, perPage, sortBy], () => load(), { deep: true })

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(restart, 300)
  })
  onBeforeUnmount(() => clearTimeout(searchTimer))

  if (options.filters?.length) watch(options.filters, restart, { deep: true })

  return { items, total, page, perPage, sortBy, search, loading, load }
}
