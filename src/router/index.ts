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
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },

]

