import { createRouter, createWebHistory } from 'vue-router'
import { sessionManager } from './api'
import Dashboard from './views/Dashboard.vue'
import AddProfile from './views/AddProfile.vue'
import RelationshipDetail from './views/RelationshipDetail.vue'
import ViewAll from './views/ViewAll.vue'
import ViewAllOccasions from './views/ViewAllOccasions.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/add-profile',
      name: 'add-profile',
      component: AddProfile,
      meta: { requiresAuth: true },
    },
    {
      path: '/relationship/:id',
      name: 'relationship-detail',
      component: RelationshipDetail,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/view-all',
      name: 'view-all',
      component: ViewAll,
      meta: { requiresAuth: true },
    },
    {
      path: '/occasions',
      name: 'view-all-occasions',
      component: ViewAllOccasions,
      meta: { requiresAuth: true },
    },
  ],
})

// Route guard to protect authenticated routes
router.beforeEach((to, _from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = sessionManager.isLoggedIn()

  if (requiresAuth && !isAuthenticated) {
    // User is not authenticated, but we'll let App.vue handle showing the login form
    // by not navigating to protected routes
    if (to.path === '/') {
      // Allow root route, App.vue will show login form
      next()
    } else {
      // Redirect other protected routes to root (which will show login)
      next('/')
    }
  } else {
    next()
  }
})

export default router

