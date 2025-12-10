<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { sessionManager, profileApi } from '../api'

const router = useRouter()
const route = useRoute()

const currentUser = ref<any>(null)
const userProfile = ref<{
  name: string
  email: string
  username?: string
} | null>(null)

// Load user profile
const loadUserProfile = async () => {
  const savedUser = sessionManager.getUser()
  if (savedUser) {
    currentUser.value = savedUser
    try {
      const profile = await profileApi.getProfile(savedUser)
      if (profile && profile.name) {
        userProfile.value = profile
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }
}

// Navigation items
const navItems = [
  { path: '/', name: 'Home', icon: 'home' },
  { path: '/view-all', name: 'My People', icon: 'users' },
  { path: '/occasions', name: 'Occasions', icon: 'calendar' },
]

// Check if route is active
const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

// Handle logout
const handleLogout = () => {
  sessionManager.clearUser()
  currentUser.value = null
  userProfile.value = null
  router.replace('/')
}

// Load profile on mount
loadUserProfile()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-content">
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="/momento-logo.png" alt="Momento" class="logo-image" />
        <span class="logo-text">Momento</span>
      </div>

      <!-- Main Navigation -->
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <svg
            v-if="item.icon === 'home'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <svg
            v-else-if="item.icon === 'users'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <svg
            v-else-if="item.icon === 'calendar'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Logout Button -->
      <div class="sidebar-footer">
        <button @click="handleLogout" class="logout-button">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  </aside>
</template>

