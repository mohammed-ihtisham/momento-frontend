<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { userAuthApi, profileApi, sessionManager, relationshipApi } from './api'

// App state
const isLoggedIn = ref(false)
const currentUser = ref<any>(null)
const userProfile = ref<{ name: string; email: string } | null>(null)
const relationships = ref<any[]>([])
const occasions = ref<any[]>([])
const showUserMenu = ref(false)
const isLoadingRelationships = ref(false)

// Form state
const email = ref('')
const name = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const isLoginMode = ref(true) // Toggle between login and register

// Form validation
const isFormValid = computed(() => {
  if (!email.value || !password.value) return false
  if (!isLoginMode.value && !name.value) return false
  return true
})

// Toggle password visibility
const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

// Handle form submission
const handleSubmit = async () => {
  errorMessage.value = ''
  
  // Client-side validation
  if (!email.value || !password.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }
  
  if (!isLoginMode.value && !name.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }
  
  isLoading.value = true
  
  try {
    if (isLoginMode.value) {
      // Login flow
      const user = await userAuthApi.login(email.value, password.value)
      
      // Store user session
      sessionManager.setUser(user)
      currentUser.value = user
      isLoggedIn.value = true
      await loadDashboardData()
      
    } else {
      // Registration flow
      // Step 1: Register the user
      const user = await userAuthApi.register(email.value, password.value)
      
      // Step 2: Create profile with name
      await profileApi.createProfile(user, name.value)
      
      // Store user session
      sessionManager.setUser(user)
      currentUser.value = user
      isLoggedIn.value = true
      await loadDashboardData()
    }
    
  } catch (error) {
    // Handle API errors
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'An error occurred. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

// Toggle between login and register
const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  errorMessage.value = ''
  email.value = ''
  name.value = ''
  password.value = ''
  rememberMe.value = false
}

// Video reference and playback rate
const pandaVideo = ref<HTMLVideoElement | null>(null)

// Logout function
const handleLogout = async () => {
  try {
    // Call Sessioning.delete if available
    // await sessioningApi.delete()
  } catch (error) {
    console.error('Error during logout:', error)
  }
  sessionManager.clearUser()
  currentUser.value = null
  userProfile.value = null
  relationships.value = []
  occasions.value = []
  isLoggedIn.value = false
  email.value = ''
  password.value = ''
  name.value = ''
  showUserMenu.value = false
}

// Get user's first name from profile
const getUserFirstName = computed(() => {
  // Return the name from profile if available
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return firstName || userProfile.value.name || 'User'
  }
  // Fallback to 'User' if profile not loaded yet
  return 'User'
})

// Load dashboard data
const loadDashboardData = async () => {
  if (!currentUser.value) return

  try {
    // Load user profile - this is required for displaying the user's name
    try {
      const profile = await profileApi.getProfile(currentUser.value)
      console.log('Profile loaded:', profile)
      if (profile && profile.name) {
        userProfile.value = profile
        console.log('User profile set:', userProfile.value)
      } else {
        console.warn('Profile loaded but name is missing:', profile)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      // Profile load failed - keep userProfile as null so it defaults to 'User'
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
        avatar: null, // Placeholder for future avatar support
      }))
    } catch (error) {
      console.error('Error loading relationships:', error)
      // Use mock data for demo
      relationships.value = []
    } finally {
      isLoadingRelationships.value = false
    }

    // Load occasions (mock data for now - frontend concept)
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

// Toggle priority for occasion
const toggleOccasionPriority = (occasion: any) => {
  occasion.isPriority = !occasion.isPriority
  // TODO: Send update to backend
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
  // TODO: Open Profile.createProfile flow
  console.log('Add profile clicked')
}

// Handle view all relationships
const handleViewAllRelationships = () => {
  // TODO: Navigate to full relationships view
  console.log('View all relationships clicked')
}

// Handle view all occasions
const handleViewAllOccasions = () => {
  // TODO: Navigate to full agenda/timeline
  console.log('View all occasions clicked')
}

// Handle relationship card click
const handleRelationshipClick = (relationship: any) => {
  // TODO: Navigate to relationship detail page
  console.log('Relationship clicked:', relationship)
}

// Handle occasion card click
const handleOccasionClick = (occasion: any) => {
  // TODO: Navigate to occasion detail view
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
  // Check if user is already logged in
  const savedUser = sessionManager.getUser()
  if (savedUser) {
    currentUser.value = savedUser
    isLoggedIn.value = true
    await loadDashboardData()
  }
  
  if (pandaVideo.value) {
    // Set playback rate to 0.75 (25% slower)
    pandaVideo.value.playbackRate = 0.75
  }
  
  // Add click outside listener for user menu
  document.addEventListener('click', handleClickOutside)
})

// Cleanup listener on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <!-- Dashboard View -->
  <div v-if="isLoggedIn" class="dashboard-page">
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

  <!-- Login/Register View -->
  <div v-else class="login-page">
    <div class="login-card">
      <!-- Left Panel: Illustration -->
      <div class="illustration-panel">
        <div class="illustration-container">
          <video
            ref="pandaVideo"
            class="panda-video"
            autoplay
            loop
            muted
            playsinline
          >
            <source src="/panda-login.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>

      <!-- Right Panel: Login Form -->
      <div class="form-panel">
        <div class="form-container">
          <!-- Logo -->
          <div class="logo">
            <img src="/momento-logo.png" alt="Momento" class="logo-image" />
            <span class="logo-text">Momento</span>
          </div>

          <!-- Greeting -->
          <h1 class="greeting">{{ isLoginMode ? 'Welcome back!' : 'Create an account' }}</h1>
          <p class="subtitle">
            {{ isLoginMode ? 'Please enter your details' : 'Please fill in your information' }}
          </p>

          <!-- Error Message -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="login-form">
            <!-- Username Field -->
            <div class="form-field">
              <label for="username">Username</label>
              <input
                id="username"
                v-model="email"
                type="text"
                placeholder="Enter your username"
                class="form-input"
                :class="{ 'has-error': errorMessage && !email }"
              />
            </div>

            <!-- Name Field (only for register) -->
            <div v-if="!isLoginMode" class="form-field">
              <label for="name">Name</label>
              <input
                id="name"
                v-model="name"
                type="text"
                placeholder="Enter your name"
                class="form-input"
                :class="{ 'has-error': errorMessage && !name }"
              />
            </div>

            <!-- Password Field -->
            <div class="form-field">
              <label for="password">Password</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  class="form-input password-input"
                  :class="{ 'has-error': errorMessage && !password }"
                />
                <button
                  type="button"
                  class="eye-icon"
                  @click="togglePasswordVisibility"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <svg
                    v-if="showPassword"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg
                    v-else
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="submit-button"
              :disabled="!isFormValid || isLoading"
            >
              <span v-if="isLoading" class="button-content">
                <svg
                  class="spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke-opacity="0.25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke-linecap="round"
                  />
                </svg>
                Logging in...
              </span>
              <span v-else>{{ isLoginMode ? 'Log In' : 'Sign Up' }}</span>
            </button>
          </form>

          <!-- Sign Up / Log In Link -->
          <div class="signup-link">
            <span v-if="isLoginMode">
              Don't have an account?
              <button type="button" @click="toggleMode" class="link-button">
                Sign Up
              </button>
            </span>
            <span v-else>
              Already have an account?
              <button type="button" @click="toggleMode" class="link-button">
                Log In
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
