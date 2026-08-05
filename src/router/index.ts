import type { RouteRecordRaw } from 'vue-router'
const Dashboard = () => import('../pages/Dashboard.vue')
const Login = () => import('../pages/Login.vue')
const Categorias = () => import('../pages/Categorias.vue')
const TiposProducto = () => import('../pages/TiposProducto.vue')
const ProductosBase = () => import('../pages/ProductosBase.vue')
const Recetas = () => import('../pages/Recetas.vue')
const Productos = () => import('../pages/Productos.vue')
const Pedidos = () => import('../pages/Pedidos.vue')
const Mesas = () => import('../pages/Mesas.vue')
const PlanoSalon = () => import('../pages/PlanoSalon.vue')
const Clientes = () => import('../pages/Clientes.vue')
const Gastos = () => import('../pages/Gastos.vue')

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
    meta: { requiresAuth: true }
  },
  {
    path: '/categorias',
    name: 'Categorias',
    component: Categorias,
    meta: { requiresAuth: true }
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
    meta: { requiresAuth: true }
  },
  {
    path: '/recetas',
    name: 'Recetas',
    component: Recetas,
    meta: { requiresAuth: true }
  },
  {
    path: '/productos',
    name: 'Productos',
    component: Productos,
    meta: { requiresAuth: true }
  },
  {
    path: '/pedidos',
    name: 'Pedidos',
    component: Pedidos,
    meta: { requiresAuth: true }
  },
  {
    path: '/mesas',
    name: 'Mesas',
    component: Mesas,
    meta: { requiresAuth: true }
  },
  {
    path: '/plano',
    name: 'PlanoSalon',
    component: PlanoSalon,
    meta: { requiresAuth: true }
  },
  {
    path: '/clientes',
    name: 'Clientes',
    component: Clientes,
    meta: { requiresAuth: true }
  },
  {
    path: '/gastos',
    name: 'Gastos',
    component: Gastos,
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

export const setupRouterGuards = (router: any) => {
  router.beforeEach((to: any, _from: any, next: any) => {
    const requiresAuth = to.meta.requiresAuth
    const requiresAdmin = to.meta.requiresAdmin
    
    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('user_data')
    const isAuthenticated = !!(token && userStr)
    
    let isAdmin = false
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        isAdmin = user.role === 'admin'
      } catch (error) {
      }
    }

    if (requiresAuth && !isAuthenticated) {
      next('/login')
    } else if (requiresAdmin && !isAdmin) {
      next('/dashboard')
    } else {
      next()
    }
  })
}

