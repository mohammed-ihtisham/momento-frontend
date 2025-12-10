<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { sessionManager } from '../api'

const router = useRouter()
const route = useRoute()

// Navigation items
const navItems = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/view-all', label: 'All People', icon: 'people' },
  { path: '/occasions', label: 'Occasions', icon: 'calendar' },
]

// Check if item is active
const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

// Handle logout
const handleLogout = () => {
  sessionManager.clearUser()
  router.replace('/')
}
</script>

<template>
  <aside class="sidebar-nav">
    <!-- Logo -->
    <div class="sidebar-logo">
      <img src="/momento-logo.png" alt="Momento" class="logo-image" />
      <span class="logo-text">Momento</span>
    </div>

    <!-- Main Navigation -->
    <nav class="sidebar-main-nav">
      <div class="nav-section">
        <button
          v-for="item in navItems"
          :key="item.path"
          @click="router.push(item.path)"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :aria-label="item.label"
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
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <svg
            v-else-if="item.icon === 'people'"
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
          <span>{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Other Section -->
    <div class="sidebar-other">
      <div class="nav-section">
        <button
          @click="router.push('/add-profile')"
          class="nav-item"
          :class="{ active: route.path === '/add-profile' }"
          aria-label="Add Profile"
        >
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Profile</span>
        </button>
      </div>
    </div>

    <!-- Logout -->
    <div class="sidebar-footer">
      <button @click="handleLogout" class="nav-item logout-item" aria-label="Logout">
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
  </aside>
</template>

<style scoped>
.sidebar-nav {
  width: 260px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-logo {
  padding: 1.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.logo-image {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.logo-text {
  font-size: 1.375rem;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.02em;
}

.sidebar-main-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  overflow-y: auto;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: #6b7280;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: #f9fafb;
  color: #111827;
}

.nav-item.active {
  background: #eff6ff;
  color: #2563eb;
}

.nav-item svg {
  flex-shrink: 0;
  stroke: currentColor;
}

.sidebar-other {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.logout-item {
  color: #ef4444;
}

.logout-item:hover {
  background: #fef2f2;
  color: #dc2626;
}

/* Scrollbar styling */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>

