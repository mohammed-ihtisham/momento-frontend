<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { userAuthApi, profileApi, sessionManager } from './api'
import Layout from './components/Layout.vue'

const router = useRouter()
const route = useRoute()

// App state
const isLoggedIn = ref(false)
const currentUser = ref<any>(null)

// Form state (must be declared before functions that use them)
const email = ref('')
const name = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const isLoginMode = ref(true) // Toggle between login and register

// Function to check and update login state
const checkAuthState = () => {
  const savedUser = sessionManager.getUser()
  if (savedUser) {
    currentUser.value = savedUser
    isLoggedIn.value = true
  } else {
    currentUser.value = null
    isLoggedIn.value = false
    // Reset to sign in mode when showing login page
    isLoginMode.value = true
    // Clear form fields
    email.value = ''
    password.value = ''
    name.value = ''
    errorMessage.value = ''
  }
}

// Watch for route changes to sync auth state
watch(() => route.path, () => {
  checkAuthState()
}, { immediate: true })

// Also check auth state after navigation completes
router.afterEach(() => {
  checkAuthState()
})

// Watch isLoggedIn to reset login mode when showing login page
watch(isLoggedIn, (newValue) => {
  if (!newValue) {
    // User is logged out, reset to sign in mode
    isLoginMode.value = true
    email.value = ''
    password.value = ''
    name.value = ''
    errorMessage.value = ''
  }
})

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
      router.push('/')
      
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
      router.push('/')
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

onMounted(async () => {
  // Check if user is already logged in
  checkAuthState()
  
  if (pandaVideo.value) {
    // Set playback rate to 0.75 (25% slower)
    pandaVideo.value.playbackRate = 0.75
  }
})
</script>

<template>
  <!-- Router View for authenticated pages -->
  <Layout v-if="isLoggedIn">
    <router-view />
  </Layout>
  
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
