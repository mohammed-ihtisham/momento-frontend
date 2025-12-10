<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { relationshipApi, sessionManager } from '../api'
import { nameToSlug } from '../utils'

const router = useRouter()

// Form state
const name = ref('')
const relationshipType = ref('')
const customRelationshipType = ref('')
const showCustomInput = ref(false)
const isLoading = ref(false)
const isCreating = ref(false)
const errorMessage = ref('')
const nameError = ref('')
const relationshipError = ref('')

// Relationship options
const relationshipOptions = [
  { value: 'Family', label: 'Family' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Colleague', label: 'Colleague' },
  { value: 'Other', label: 'Other' },
]

// Form validation
const isFormValid = computed(() => {
  return name.value.trim().length > 0 && 
         relationshipType.value !== '' &&
         (relationshipType.value !== 'Other' || customRelationshipType.value.trim().length > 0)
})

// Handle relationship type change
const handleRelationshipTypeChange = (value: string) => {
  relationshipType.value = value
  relationshipError.value = ''
  if (value === 'Other') {
    showCustomInput.value = true
  } else {
    showCustomInput.value = false
    customRelationshipType.value = ''
  }
}

// Handle form submission
const handleSubmit = async () => {
  // Reset errors
  nameError.value = ''
  relationshipError.value = ''
  errorMessage.value = ''

  // Validation
  if (!name.value.trim()) {
    nameError.value = 'Please enter a name'
    return
  }

  if (!relationshipType.value) {
    relationshipError.value = 'Please select a relationship'
    return
  }

  if (relationshipType.value === 'Other' && !customRelationshipType.value.trim()) {
    relationshipError.value = 'Please enter a relationship type'
    return
  }

  isLoading.value = true

  try {
    const currentUser = sessionManager.getUser()
    if (!currentUser) {
      router.push('/')
      return
    }

    // Use custom relationship type if "Other" is selected
    const finalRelationshipType = relationshipType.value === 'Other' 
      ? customRelationshipType.value.trim() 
      : relationshipType.value

    // Create relationship
    const newRelationship = await relationshipApi.createRelationship(
      currentUser,
      name.value.trim(),
      finalRelationshipType
    )

    // Auto-pin the new relationship if there are less than 7 pinned
    const MAX_PINNED = 7
    const pinnedKey = `momento_pinned_${currentUser.id || currentUser.username}`
    const savedPinned = localStorage.getItem(pinnedKey)
    
    let pinnedIds: string[] = []
    if (savedPinned) {
      try {
        pinnedIds = JSON.parse(savedPinned) as string[]
      } catch (error) {
        console.error('Error parsing pinned relationships:', error)
        pinnedIds = []
      }
    }
    
    // Get the relationship ID (matching the format used in Dashboard/ViewAll: relationship.id || name)
    // The createRelationship returns the relationship object, so we use its id or name as fallback
    const relationshipId = newRelationship?.id || name.value.trim()
    
    // Add to pinned if less than 7
    if (pinnedIds.length < MAX_PINNED && !pinnedIds.includes(relationshipId)) {
      pinnedIds.push(relationshipId)
      localStorage.setItem(pinnedKey, JSON.stringify(pinnedIds))
    }

    // Show success loading animation
    isLoading.value = false
    isCreating.value = true

    // Navigate to relationship detail page after animation
    // Use replace instead of push so that AddProfile is removed from history
    // This way, clicking back from RelationshipDetail will go to Dashboard, not AddProfile
    const slug = nameToSlug(name.value.trim())
    setTimeout(() => {
      router.replace(`/relationship/${slug}`)
    }, 2000)

  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'An error occurred. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

// Handle back navigation
const handleBack = () => {
  router.back()
}

onMounted(() => {
  const currentUser = sessionManager.getUser()
  if (!currentUser) {
    router.push('/')
  }
  // Prevent body scrolling on this page
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  // Restore body scrolling when leaving the page
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="add-profile-page">
    <!-- Main Content -->
    <main class="add-profile-main">
      <div class="add-profile-container">
        <div class="add-profile-card">
          <!-- Back Button -->
          <button @click="handleBack" class="back-button" aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <!-- Page Title -->
          <div class="add-profile-header-section">
            <h1 class="add-profile-title">Add New Profile</h1>
            <p class="add-profile-subtitle">Let's get to know someone special ❤</p>
          </div>

          <!-- Optional Profile Silhouette Placeholder -->
          <div class="profile-silhouette">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
            </svg>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="add-profile-form">
            <!-- Name Input -->
            <div class="form-field">
              <label for="name">Name</label>
              <input
                id="name"
                v-model="name"
                type="text"
                placeholder="Enter their name"
                class="form-input"
                :class="{ 'has-error': nameError }"
                @blur="nameError = name.trim() ? '' : 'Please enter a name'"
              />
              <span v-if="nameError" class="field-error">{{ nameError }}</span>
            </div>

            <!-- Relationship Dropdown -->
            <div class="form-field">
              <label for="relationship">Relationship</label>
              <div class="select-wrapper">
                <select
                  id="relationship"
                  v-model="relationshipType"
                  @change="handleRelationshipTypeChange(relationshipType)"
                  class="form-select"
                  :class="{ 'has-error': relationshipError }"
                >
                  <option value="" disabled>Select a relationship</option>
                  <option
                    v-for="option in relationshipOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <svg
                  class="select-chevron"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <span v-if="relationshipError" class="field-error">{{ relationshipError }}</span>
            </div>

            <!-- Custom Relationship Input (shown when "Other" is selected) -->
            <div v-if="showCustomInput" class="form-field">
              <label for="customRelationship">Relationship Type</label>
              <input
                id="customRelationship"
                v-model="customRelationshipType"
                type="text"
                placeholder="Enter relationship type"
                class="form-input"
                :class="{ 'has-error': relationshipError && !customRelationshipType.trim() }"
              />
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
                Creating...
              </span>
              <span v-else>Create Profile</span>
            </button>
          </form>
        </div>
      </div>
    </main>

    <!-- Success Loading Overlay -->
    <transition name="loading-overlay">
      <div v-if="isCreating" class="loading-overlay">
        <div class="loading-content">
          <div class="success-animation">
            <div class="checkmark-circle">
              <svg class="checkmark" width="80" height="80" viewBox="0 0 80 80">
                <circle class="checkmark-circle-bg" cx="40" cy="40" r="38" fill="none" stroke="#C08497" stroke-width="3"/>
                <path class="checkmark-check" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M 25 40 L 35 50 L 55 30"/>
              </svg>
            </div>
          </div>
          <h2 class="loading-title">Profile Created!</h2>
          <p class="loading-message">Let's make great memories together ❤</p>
        </div>
      </div>
    </transition>
  </div>
</template>

