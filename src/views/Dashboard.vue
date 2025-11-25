<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { profileApi, sessionManager, relationshipApi } from '../api'

const router = useRouter()

// App state
const currentUser = ref<any>(null)
const userProfile = ref<{ name: string; email: string } | null>(null)
const relationships = ref<any[]>([])
const occasions = ref<any[]>([])
const showUserMenu = ref(false)
const isLoadingRelationships = ref(false)

// Get user's first name from profile
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return firstName || userProfile.value.name || 'User'
  }
  return 'User'
})

// Load dashboard data
const loadDashboardData = async () => {
  if (!currentUser.value) return

  try {
    // Load user profile
    try {
      const profile = await profileApi.getProfile(currentUser.value)
      if (profile && profile.name) {
        userProfile.value = profile
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }

    // Load relationships
    isLoadingRelationships.value = true
    try {
      const relationshipsData = await relationshipApi.getRelationships(
        currentUser.value
      )
      relationships.value = relationshipsData.map((r) => ({
        id: r.relationship?.id || Math.random().toString(),
        name: r.name,
        relationshipType: r.relationshipType,
        avatar: null,
      }))
    } catch (error) {
      console.error('Error loading relationships:', error)
      relationships.value = []
    } finally {
      isLoadingRelationships.value = false
    }

    // Load occasions (mock data for now)
    occasions.value = [
      {
        id: '1',
        name: 'Birthday',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        relationshipName: 'Sarah',
        relationshipType: 'Friend',
        isPriority: true,
      },
      {
        id: '2',
        name: 'Anniversary',
        date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        relationshipName: 'Mom',
        relationshipType: 'Family',
        isPriority: false,
      },
    ]
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  }
}

// Logout function
const handleLogout = async () => {
  sessionManager.clearUser()
  currentUser.value = null
  userProfile.value = null
  relationships.value = []
  occasions.value = []
  showUserMenu.value = false
  // Use replace to ensure navigation and redirect to login page
  router.replace('/')
}

// Toggle priority for occasion
const toggleOccasionPriority = (occasion: any) => {
  occasion.isPriority = !occasion.isPriority
}

// Format time until event
const getTimeUntilEvent = (date: Date): string => {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days < 0) return 'Past'
  if (days === 0) return 'Today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}

// Format date
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Handle add profile
const handleAddProfile = () => {
  router.push('/add-profile')
}

// Handle view all relationships
const handleViewAllRelationships = () => {
  console.log('View all relationships clicked')
}

// Handle view all occasions
const handleViewAllOccasions = () => {
  console.log('View all occasions clicked')
}

// Handle relationship card click
const handleRelationshipClick = (relationship: any) => {
  router.push(`/relationship/${relationship.id}`)
}

// Handle occasion card click
const handleOccasionClick = (occasion: any) => {
  console.log('Occasion clicked:', occasion)
}

// Close user menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
}

onMounted(async () => {
  const savedUser = sessionManager.getUser()
  if (savedUser) {
    currentUser.value = savedUser
    await loadDashboardData()
  } else {
    router.push('/')
  }
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-container">
      <!-- Header Bar -->
      <header class="dashboard-header">
        <div class="dashboard-header-content">
          <div class="dashboard-logo">
            <img src="/momento-logo.png" alt="Momento" class="logo-image" />
            <span class="logo-text">Momento</span>
          </div>
          <div class="user-menu-wrapper">
            <button
              @click.stop="showUserMenu = !showUserMenu"
              class="user-menu-trigger"
              :aria-expanded="showUserMenu"
              aria-label="User menu"
            >
              <span class="user-greeting">Hi {{ getUserFirstName }}!</span>
              <div class="user-avatar">
                <span class="avatar-initial">
                  {{ getUserFirstName.charAt(0).toUpperCase() }}
                </span>
              </div>
            </button>
            <div v-if="showUserMenu" class="user-menu-dropdown" @click.stop>
              <button class="menu-item" @click="showUserMenu = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                View Profile
              </button>
              <button class="menu-item" @click="showUserMenu = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
                </svg>
                Settings
              </button>
              <button class="menu-item menu-item-danger" @click="handleLogout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="dashboard-main">
        <div class="dashboard-content">
          <!-- Your People Section -->
          <section class="dashboard-section">
            <div class="section-header">
              <div class="section-header-content">
                <h2 class="section-title">Your People</h2>
                <p
                  v-if="relationships.length === 0 && !isLoadingRelationships"
                  class="section-subtitle"
                >
                  No relationships yet. Add your first person!
                </p>
              </div>
              <button
                @click="handleViewAllRelationships"
                class="section-action"
              >
                View All →
              </button>
            </div>
            <div class="relationships-carousel">
              <div class="relationships-scroll">
                <div
                  v-for="relationship in relationships"
                  :key="relationship.id"
                  @click="handleRelationshipClick(relationship)"
                  class="relationship-card"
                >
                  <div class="relationship-avatar">
                    <span v-if="!relationship.avatar" class="avatar-placeholder">
                      {{ relationship.name.charAt(0).toUpperCase() }}
                    </span>
                    <img
                      v-else
                      :src="relationship.avatar"
                      :alt="relationship.name"
                    />
                  </div>
                  <div class="relationship-name">{{ relationship.name }}</div>
                  <div class="relationship-type">{{ relationship.relationshipType }}</div>
                </div>
                <div
                  @click="handleAddProfile"
                  class="relationship-card add-card"
                >
                  <div class="add-card-content">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add Profile</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Upcoming Section -->
          <section class="dashboard-section">
            <div class="section-header">
              <h2 class="section-title">Upcoming Occasions</h2>
              <button @click="handleViewAllOccasions" class="section-action">
                View All →
              </button>
            </div>
            <div class="occasions-list">
              <div
                v-for="occasion in occasions"
                :key="occasion.id"
                @click="handleOccasionClick(occasion)"
                class="occasion-card"
              >
                <div class="occasion-main">
                  <div class="occasion-info">
                    <div class="occasion-header-row">
                      <h3 class="occasion-name">{{ occasion.name }}</h3>
                      <button
                        @click.stop="toggleOccasionPriority(occasion)"
                        class="priority-star"
                        :class="{ active: occasion.isPriority }"
                        aria-label="Toggle priority"
                      >
                        <svg
                          v-if="occasion.isPriority"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        <svg
                          v-else
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      </button>
                    </div>
                    <div class="occasion-meta">
                      <span class="occasion-time">{{ getTimeUntilEvent(occasion.date) }}</span>
                      <span class="occasion-date">{{ formatDate(occasion.date) }}</span>
                    </div>
                    <div class="occasion-relationship">
                      <div class="relationship-mini-avatar">
                        {{ occasion.relationshipName.charAt(0).toUpperCase() }}
                      </div>
                      <span>{{ occasion.relationshipName }}</span>
                    </div>
                  </div>
                  <div class="occasion-chevron">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <div v-if="occasions.length === 0" class="empty-state">
                <p>No upcoming occasions. Add one to stay on top of important dates!</p>
                <button class="empty-state-button" @click="handleAddProfile">
                  Add Occasion
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

