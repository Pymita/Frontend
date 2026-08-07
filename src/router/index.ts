import type { RouteRecordRaw } from 'vue-router'
import { effectiveFeatures } from '../types/auth'
const Dashboard = () => import('../pages/Dashboard.vue')
const Login = () => import('../pages/Login.vue')
const Categorias = () => import('../pages/Categorias.vue')
const Menu = () => import('../pages/Menu.vue')
const TiposProducto = () => import('../pages/TiposProducto.vue')
const ProductosBase = () => import('../pages/ProductosBase.vue')
const Recetas = () => import('../pages/Recetas.vue')
const Pedidos = () => import('../pages/Pedidos.vue')
const Mesas = () => import('../pages/Mesas.vue')
const PlanoSalon = () => import('../pages/PlanoSalon.vue')
const Clientes = () => import('../pages/Clientes.vue')
const Gastos = () => import('../pages/Gastos.vue')
const Plataforma = () => import('../pages/Plataforma.vue')
const Empleados = () => import('../pages/Empleados.vue')
const Kardex = () => import('../pages/Kardex.vue')
const Finanzas = () => import('../pages/Finanzas.vue')
const Configuracion = () => import('../pages/Configuracion.vue')

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
    beforeEnter: (_to, _from, next) => {
      // Si ya está autenticado, redirigir al dashboard
      const token = localStorage.getItem('auth_token')
      if (token) {
        next('/dashboard')
      } else {
        next()
      }
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, feature: 'reports' }
  },
  {
    path: '/menu',
    name: 'Menu',
    component: Menu,
    meta: { requiresAuth: true, feature: 'menu' }
  },
  {
    path: '/categorias',
    name: 'Categorias',
    component: Categorias,
    meta: { requiresAuth: true, feature: 'menu' }
  },
  {
    path: '/tipos-producto',
    name: 'TiposProducto',
    component: TiposProducto,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/productos-base',
    name: 'ProductosBase',
    component: ProductosBase,
    meta: { requiresAuth: true, feature: 'inventory' }
  },
  {
    path: '/recetas',
    name: 'Recetas',
    component: Recetas,
    meta: { requiresAuth: true, feature: 'inventory' }
  },
  {
    path: '/pedidos',
    name: 'Pedidos',
    component: Pedidos,
    meta: { requiresAuth: true, feature: 'orders' }
  },
  {
    path: '/mesas',
    name: 'Mesas',
    component: Mesas,
    meta: { requiresAuth: true, feature: 'orders' }
  },
  {
    path: '/plano',
    name: 'PlanoSalon',
    component: PlanoSalon,
    meta: { requiresAuth: true, feature: 'orders' }
  },
  {
    path: '/clientes',
    name: 'Clientes',
    component: Clientes,
    meta: { requiresAuth: true, feature: 'customers' }
  },
  {
    path: '/gastos',
    name: 'Gastos',
    component: Gastos,
    meta: { requiresAuth: true, feature: 'expenses' }
  },
  {
    path: '/kardex',
    name: 'Kardex',
    component: Kardex,
    meta: { requiresAuth: true, feature: 'inventory' }
  },
  {
    path: '/finanzas',
    name: 'Finanzas',
    component: Finanzas,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/configuracion',
    name: 'Configuracion',
    component: Configuracion,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/empleados',
    name: 'Empleados',
    component: Empleados,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/plataforma',
    name: 'Plataforma',
    component: Plataforma,
    meta: { requiresAuth: true, requiresSuperAdmin: true }
  }
]

export const setupRouterGuards = (router: any) => {
  router.beforeEach((to: any, _from: any, next: any) => {
    const requiresAuth = to.meta.requiresAuth
    const requiresAdmin = to.meta.requiresAdmin
    const requiresSuperAdmin = to.meta.requiresSuperAdmin
    const feature = to.meta.feature as string | undefined

    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('user_data')
    const isAuthenticated = !!(token && userStr)

    let isAdmin = false
    let isSuperAdmin = false
    let features: string[] = []
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        isAdmin = user.role === 'admin'
        isSuperAdmin = user.role === 'super_admin'
        features = effectiveFeatures(user)
      } catch (error) {
      }
    }

    if (requiresAuth && !isAuthenticated) {
      next('/login')
    } else if (requiresSuperAdmin && !isSuperAdmin) {
      next('/dashboard')
    } else if (requiresAdmin && !isAdmin) {
      next('/dashboard')
    } else if (isSuperAdmin && requiresAuth && !requiresSuperAdmin) {
      // Platform staff has no company: tenant pages make no sense for them.
      next('/plataforma')
    } else if (feature && !isAdmin && !features.includes(feature)) {
      // Employee without this feature: send them to their first allowed page.
      const featureHome: Record<string, string> = {
        orders: '/pedidos',
        reports: '/dashboard',
        menu: '/categorias',
        inventory: '/productos-base',
        customers: '/clientes',
        expenses: '/gastos',
      }
      const fallback = features.map(f => featureHome[f]).find(Boolean)
      // No allowed page or already there: let it pass (the backend still enforces 403).
      if (!fallback || fallback === to.path) {
        next()
      } else {
        next(fallback)
      }
    } else {
      next()
    }
  })
}

