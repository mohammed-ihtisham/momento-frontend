<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { sessionManager, relationshipApi } from '../api'

const router = useRouter()
const route = useRoute()

const relationship = ref<any>(null)
const isLoading = ref(true)
const relationshipName = ref('')
const relationshipType = ref('')

// Handle back navigation
const handleBack = () => {
  router.push('/')
}

onMounted(async () => {
  const currentUser = sessionManager.getUser()
  if (!currentUser) {
    router.push('/')
    return
  }

  try {
    const relationshipId = route.params.id as string
    
    // Try to fetch relationship by name
    try {
      const relationshipData = await relationshipApi.getRelationshipByName(
        currentUser,
        relationshipId
      )
      relationshipName.value = relationshipData.name
      relationshipType.value = relationshipData.relationshipType
      relationship.value = relationshipData.relationship
    } catch (error) {
      // If fetch fails, use the ID as the name (fallback)
      console.warn('Could not fetch relationship, using ID as name:', error)
      relationshipName.value = relationshipId
      relationshipType.value = 'Friend'
    }
    
    isLoading.value = false
  } catch (error) {
    console.error('Error loading relationship:', error)
    isLoading.value = false
  }
})
</script>

<template>
  <div class="relationship-detail-page">
    <!-- Header Bar -->
    <header class="relationship-detail-header">
      <div class="relationship-detail-header-content">
        <div class="relationship-detail-logo">
          <img src="/momento-logo.png" alt="Momento" class="logo-image" />
          <span class="logo-text">Momento</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="relationship-detail-main">
      <div class="relationship-detail-container">
        <div class="relationship-detail-card">
          <!-- Back Button -->
          <button @click="handleBack" class="back-button" aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div v-if="isLoading" class="loading-state">
            <div class="spinner-large"></div>
            <p>Loading relationship...</p>
          </div>

          <div v-else class="relationship-detail-content">
            <!-- Relationship Avatar -->
            <div class="relationship-detail-avatar">
              <span class="avatar-large">
                {{ relationshipName.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Relationship Info -->
            <div class="relationship-detail-info">
              <h1 class="relationship-detail-name">{{ relationshipName }}</h1>
              <p class="relationship-detail-type">{{ relationshipType }}</p>
            </div>

            <!-- Placeholder for future content -->
            <div class="relationship-detail-placeholder">
              <p>More details about {{ relationshipName }} will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

