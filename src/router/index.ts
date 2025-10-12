import type { RouteRecordRaw } from 'vue-router'
const Dashboard = () => import('../pages/Dashboard.vue')
const Login = () => import('../pages/Login.vue')

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
    beforeEnter: (to, from, next) => {
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
  }
]

export const setupRouterGuards = (router: any) => {
  router.beforeEach((to: any, from: any, next: any) => {
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

