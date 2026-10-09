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
const Ventas = () => import('../pages/Ventas.vue')
const Mesas = () => import('../pages/Mesas.vue')
const PlanoSalon = () => import('../pages/PlanoSalon.vue')
const Clientes = () => import('../pages/Clientes.vue')
const Gastos = () => import('../pages/Gastos.vue')
const FacturacionAutomatica = () => import('../pages/FacturacionAutomatica.vue')
const Plataforma = () => import('../pages/Plataforma.vue')
const Empleados = () => import('../pages/Empleados.vue')
const Kardex = () => import('../pages/Kardex.vue')
const Finanzas = () => import('../pages/Finanzas.vue')
const Configuracion = () => import('../pages/Configuracion.vue')
const Privacidad = () => import('../pages/Privacidad.vue')

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
    // El enlace del correo de "¿Olvidaste tu contraseña?": misma pantalla
    // del login, en el paso de elegir la contraseña nueva.
    path: '/restablecer-contrasena',
    name: 'ResetPassword',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    // Public on purpose: Google Play and Ley 1581 require the policy at a URL
    // anyone can open, signed in or not.
    path: '/privacidad',
    name: 'Privacidad',
    component: Privacidad,
    meta: { requiresAuth: false },
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
    meta: { requiresAuth: true, requiresAdmin: true, feature: 'menu' }
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
    meta: { requiresAuth: true, feature: 'recipes' }
  },
  {
    path: '/pedidos',
    name: 'Pedidos',
    component: Pedidos,
    meta: { requiresAuth: true, feature: 'orders' }
  },
  {
    path: '/ventas',
    name: 'Ventas',
    component: Ventas,
    meta: { requiresAuth: true, feature: 'reports' }
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
    path: '/facturacion-automatica',
    name: 'FacturacionAutomatica',
    component: FacturacionAutomatica,
    meta: { requiresAuth: true, feature: 'recurring_billing' }
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
  // Las secciones de plataforma viven en la barra lateral (el super admin
  // no tiene otras páginas): misma vista, sección según la ruta.
  {
    path: '/plataforma',
    name: 'Plataforma',
    component: Plataforma,
    meta: { requiresAuth: true, requiresSuperAdmin: true, section: 'companies' }
  },
  {
    path: '/plataforma/vendedores',
    name: 'PlataformaVendedores',
    component: Plataforma,
    meta: { requiresAuth: true, requiresSuperAdmin: true, section: 'sellers' }
  },
  {
    path: '/plataforma/ventas',
    name: 'PlataformaVentas',
    component: Plataforma,
    meta: { requiresAuth: true, requiresSuperAdmin: true, section: 'stats' }
  },
  {
    path: '/plataforma/seguridad',
    name: 'PlataformaSeguridad',
    component: Plataforma,
    meta: { requiresAuth: true, requiresSuperAdmin: true, section: 'security' }
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
    let mustSetUpTwoFactor = false
    let features: string[] = []
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        isAdmin = user.role === 'admin'
        isSuperAdmin = user.role === 'super_admin'
        mustSetUpTwoFactor = !!user.two_factor?.setup_required
        features = effectiveFeatures(user)
      } catch (error) {
      }
    }

    if (requiresAuth && !isAuthenticated) {
      next('/login')
    } else if (requiresAuth && isAuthenticated && mustSetUpTwoFactor && to.path !== '/plataforma/seguridad') {
      // La cuenta de plataforma sin segundo factor solo puede configurarlo.
      next('/plataforma/seguridad')
    } else if (requiresSuperAdmin && !isSuperAdmin) {
      next('/dashboard')
    } else if (requiresAdmin && !isAdmin) {
      next('/dashboard')
    } else if (isSuperAdmin && requiresAuth && !requiresSuperAdmin) {
      // Platform staff has no company: tenant pages make no sense for them.
      next('/plataforma')
    } else if (feature && !features.includes(feature)) {
      // Aplica también al admin: sus funciones ya están limitadas a los
      // módulos de su empresa.
      // Employee without this feature: send them to their first allowed page.
      const featureHome: Record<string, string> = {
        orders: '/pedidos',
        reports: '/dashboard',
        menu: '/categorias',
        inventory: '/productos-base',
        recipes: '/recetas',
        customers: '/clientes',
        expenses: '/gastos',
        recurring_billing: '/facturacion-automatica',
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

