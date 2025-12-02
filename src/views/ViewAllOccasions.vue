<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { sessionManager, relationshipApi, profileApi, occasionsApi } from '../api'

const router = useRouter()

// App state
const currentUser = ref<any>(null)
const userProfile = ref<{ name: string; email: string } | null>(null)
const allRelationships = ref<any[]>([])
// Frontend shape: map backend fields (person, occasionType) into
// name (occasion label) and relationshipName (person name) so the UI
// can stay focused on \"occasion\" and \"person\"
const occasions = ref<Array<{
  occasion: any
  name: string // maps to backend occasionType
  date: string
  person: string
  description?: string
  relationshipName?: string // person name, mirrors person
  relationshipType?: string
}>>([])
const isLoading = ref(true)
const showUserMenu = ref(false)

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingOccasion = ref<any>(null)
const deletingOccasion = ref<any>(null)

// Form state
const formName = ref('')
const formDate = ref('')
const formDescription = ref('')
const formRelationship = ref<any>(null)
const isSubmitting = ref(false)

// Filter and sort state
const selectedPersonFilter = ref<string | null>(null)
const sortBy = ref<'date-asc' | 'date-desc' | 'name-asc' | 'name-desc'>('date-asc')
const searchQuery = ref('')

// Get user's first name from profile
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return firstName || userProfile.value.name || 'User'
  }
  return 'User'
})

// Get unique person names for filter
const relationshipNames = computed(() => {
  const names = new Set<string>()
  occasions.value.forEach(occ => {
    if (occ.relationshipName || occ.person) {
      names.add(occ.relationshipName || occ.person)
    }
  })
  return Array.from(names).sort()
})

// Filtered and sorted occasions
const filteredOccasions = computed(() => {
  let filtered = [...occasions.value]

  // Filter by person
  if (selectedPersonFilter.value) {
    filtered = filtered.filter(
      occ =>
        occ.relationshipName === selectedPersonFilter.value ||
        occ.person === selectedPersonFilter.value
    )
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(occ => 
      occ.name.toLowerCase().includes(query) ||
      occ.relationshipName?.toLowerCase().includes(query) ||
      occ.person.toLowerCase().includes(query) ||
      occ.description?.toLowerCase().includes(query)
    )
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortBy.value === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    } else if (sortBy.value === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    } else if (sortBy.value === 'name-asc') {
      return a.name.localeCompare(b.name)
    } else {
      return b.name.localeCompare(a.name)
    }
  })

  return filtered
})

// Group occasions by person (for organized view)
const occasionsByPerson = computed(() => {
  const grouped: Record<string, typeof occasions.value> = {}
  filteredOccasions.value.forEach(occ => {
    const personName = occ.relationshipName || occ.person || 'Unknown'
    if (!grouped[personName]) {
      grouped[personName] = []
    }
    grouped[personName].push(occ)
  })
  return grouped
})

// View mode: 'list' or 'grouped'
const viewMode = ref<'list' | 'grouped'>('list')

// Load relationships
const loadRelationships = async () => {
  if (!currentUser.value) return

  try {
    const relationshipsData = await relationshipApi.getRelationships(currentUser.value)
    allRelationships.value = relationshipsData.map((r) => ({
      id: r.relationship?.id || r.name,
      name: r.name,
      relationshipType: r.relationshipType,
      relationship: r.relationship,
    }))
  } catch (error) {
    console.error('Error loading relationships:', error)
    allRelationships.value = []
  }
}

// Load occasions
const loadOccasions = async () => {
  if (!currentUser.value) return

  try {
    isLoading.value = true
    const occasionsData = await occasionsApi.getOccasions(currentUser.value)
    
    // Enrich with relationship/relationshipType info using Relationships concept.
    // Backend returns: { occasion, person, occasionType, date }
    const enriched = occasionsData.map(occ => {
      const relationship = allRelationships.value.find(
        r => r.name === occ.person
      )

      return {
        ...occ,
        name: occ.occasionType,
        person: occ.person,
        relationshipName: occ.person,
        relationshipType: relationship?.relationshipType || 'Unknown',
      }
    })
    
    occasions.value = enriched
  } catch (error) {
    console.error('Error loading occasions:', error)
    occasions.value = []
  } finally {
    isLoading.value = false
  }
}

// Load user profile
const loadUserProfile = async () => {
  if (!currentUser.value) return
  
  try {
    const profile = await profileApi.getProfile(currentUser.value)
    if (profile && profile.name) {
      userProfile.value = profile
    }
  } catch (error) {
    console.error('Error loading profile:', error)
  }
}

// Handle back navigation
const handleBack = () => {
  router.push('/')
}

// Logout function
const handleLogout = async () => {
  sessionManager.clearUser()
  currentUser.value = null
  userProfile.value = null
  showUserMenu.value = false
  router.replace('/')
}

// Open create modal
const openCreateModal = () => {
  formName.value = ''
  formDate.value = ''
  formDescription.value = ''
  formRelationship.value = null
  showCreateModal.value = true
}

// Close create modal
const closeCreateModal = () => {
  showCreateModal.value = false
  formName.value = ''
  formDate.value = ''
  formDescription.value = ''
  formRelationship.value = null
}

// Open edit modal
const openEditModal = (occasion: any) => {
  editingOccasion.value = occasion
  formName.value = occasion.name
  formDate.value = formatDateForInput(occasion.date)
  formDescription.value = occasion.description || ''
  // Store the person name so we can send it directly to the Occasion API
  formRelationship.value = occasion.person || occasion.relationshipName || null
  showEditModal.value = true
}

// Close edit modal
const closeEditModal = () => {
  showEditModal.value = false
  editingOccasion.value = null
  formName.value = ''
  formDate.value = ''
  formDescription.value = ''
  formRelationship.value = null
}

// Helper function to parse date string in local timezone (avoids timezone shift)
const parseLocalDate = (dateString: string): Date => {
  const parts = dateString.split('-').map(Number)
  const year = parts[0] || new Date().getFullYear()
  const month = parts[1] || 1
  const day = parts[2] || 1
  return new Date(year, month - 1, day)
}

// Helper function to format date for date input (local timezone)
const formatDateForInput = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Create occasion
const handleCreateOccasion = async () => {
  if (!formName.value.trim() || !formDate.value || !formRelationship.value) {
    alert('Please fill in all required fields')
    return
  }

  try {
    isSubmitting.value = true
    await occasionsApi.createOccasion(
      currentUser.value,
      // person name
      formRelationship.value,
      // occasionType
      formName.value.trim(),
      parseLocalDate(formDate.value)
    )
    closeCreateModal()
    await loadOccasions()
  } catch (error: any) {
    console.error('Error creating occasion:', error)
    alert(error.message || 'Failed to create occasion')
  } finally {
    isSubmitting.value = false
  }
}

// Update occasion
const handleUpdateOccasion = async () => {
  if (!formName.value.trim() || !formDate.value || !formRelationship.value) {
    alert('Please fill in all required fields')
    return
  }

  try {
    isSubmitting.value = true
    await occasionsApi.updateOccasion(
      editingOccasion.value.occasion,
      // person
      formRelationship.value,
      // occasionType
      formName.value.trim(),
      parseLocalDate(formDate.value)
    )
    closeEditModal()
    await loadOccasions()
  } catch (error: any) {
    console.error('Error updating occasion:', error)
    alert(error.message || 'Failed to update occasion')
  } finally {
    isSubmitting.value = false
  }
}

// Open delete confirmation modal
const openDeleteModal = (occasion: any) => {
  deletingOccasion.value = occasion
  showDeleteModal.value = true
}

// Close delete modal
const closeDeleteModal = () => {
  showDeleteModal.value = false
  deletingOccasion.value = null
}

// Delete occasion (after confirmation)
const handleDeleteOccasion = async () => {
  if (!deletingOccasion.value) return

  try {
    await occasionsApi.deleteOccasion(deletingOccasion.value.occasion)
    closeDeleteModal()
    await loadOccasions()
  } catch (error: any) {
    console.error('Error deleting occasion:', error)
    alert(error.message || 'Failed to delete occasion')
  }
}

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Helper function to normalize date to start of day (midnight) for comparison
const normalizeToDay = (date: Date): Date => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

// Format time until event
const getTimeUntilEvent = (dateString: string): string => {
  const date = normalizeToDay(new Date(dateString))
  const now = normalizeToDay(new Date())
  const diff = date.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days < 0) return 'Past'
  if (days === 0) return 'Today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}

// Get date status class
const getDateStatus = (dateString: string): 'past' | 'today' | 'upcoming' | 'soon' => {
  const date = normalizeToDay(new Date(dateString))
  const now = normalizeToDay(new Date())
  const diff = date.getTime() - now.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days <= 7) return 'soon'
  return 'upcoming'
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
  if (!savedUser) {
    router.push('/')
    return
  }
  
  currentUser.value = savedUser
  await loadUserProfile()
  await loadRelationships()
  await loadOccasions()
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="view-all-occasions-page">
    <!-- Header Bar -->
    <header class="relationship-detail-header">
      <div class="relationship-detail-header-content">
        <div class="relationship-detail-logo">
          <button @click="handleBack" class="back-button-inline" aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
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
    <main class="occasions-main">
      <div v-if="isLoading" class="loading-state-full">
        <div class="spinner-large"></div>
        <p>Loading occasions...</p>
      </div>

      <div v-else class="occasions-container">
        <!-- Header Section -->
        <div class="occasions-header">
          <div class="occasions-header-content">
            <h1 class="occasions-title">All Occasions</h1>
            <p class="occasions-subtitle">
              {{ filteredOccasions.length }} {{ filteredOccasions.length === 1 ? 'occasion' : 'occasions' }}
            </p>
          </div>
          <button @click="openCreateModal" class="create-occasion-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Occasion
          </button>
        </div>

        <!-- Filters and Controls -->
        <div class="occasions-controls">
          <!-- Search -->
          <div class="search-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search occasions..."
              class="search-input"
            />
          </div>

          <!-- Person Filter -->
          <select v-model="selectedPersonFilter" class="filter-select">
            <option :value="null">All People</option>
            <option v-for="name in relationshipNames" :key="name" :value="name">
              {{ name }}
            </option>
          </select>

          <!-- Sort -->
          <select v-model="sortBy" class="filter-select">
            <option value="date-asc">Date (Earliest First)</option>
            <option value="date-desc">Date (Latest First)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>

          <!-- View Mode Toggle -->
          <div class="view-mode-toggle">
            <button
              @click="viewMode = 'list'"
              :class="['view-mode-button', { active: viewMode === 'list' }]"
              aria-label="List view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button
              @click="viewMode = 'grouped'"
              :class="['view-mode-button', { active: viewMode === 'grouped' }]"
              aria-label="Grouped view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
          </div>
        </div>

        <!-- Occasions List -->
        <div v-if="viewMode === 'list'" class="occasions-list-view">
          <div v-if="filteredOccasions.length === 0" class="empty-state-occasions">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <p class="empty-title">No occasions found</p>
            <p class="empty-text">
              {{ searchQuery || selectedPersonFilter ? 'Try adjusting your filters' : 'Create your first occasion to get started!' }}
            </p>
            <button v-if="!searchQuery && !selectedPersonFilter" @click="openCreateModal" class="empty-state-button">
              Create Occasion
            </button>
          </div>

          <div v-else class="occasions-grid">
            <div
              v-for="occasion in filteredOccasions"
              :key="occasion.occasion?.id || occasion.name"
              class="occasion-card-detailed"
              :class="`status-${getDateStatus(occasion.date)}`"
            >
              <div class="occasion-card-header">
                <div class="occasion-card-title-row">
                  <h3 class="occasion-card-name">{{ occasion.name }}</h3>
                  <div class="occasion-card-actions">
                    <button
                      @click.stop="openEditModal(occasion)"
                      class="action-button edit-button"
                      aria-label="Edit occasion"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      @click.stop="openDeleteModal(occasion)"
                      class="action-button delete-button"
                      aria-label="Delete occasion"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="occasion-card-date-badge" :class="`badge-${getDateStatus(occasion.date)}`">
                  <span class="badge-time">{{ getTimeUntilEvent(occasion.date) }}</span>
                  <span class="badge-date">{{ formatDate(occasion.date) }}</span>
                </div>
              </div>

              <div class="occasion-card-body">
                <div class="occasion-card-person">
                  <div class="person-avatar">
                    {{ occasion.relationshipName?.charAt(0).toUpperCase() || '?' }}
                  </div>
                  <div class="person-info">
                    <span class="person-name">{{ occasion.relationshipName || 'Unknown' }}</span>
                    <span class="person-type">{{ occasion.relationshipType || '' }}</span>
                  </div>
                </div>
                <p v-if="occasion.description" class="occasion-card-description">
                  {{ occasion.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Grouped View -->
        <div v-else class="occasions-grouped-view">
          <div v-if="Object.keys(occasionsByPerson).length === 0" class="empty-state-occasions">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <p class="empty-title">No occasions found</p>
            <p class="empty-text">
              {{ searchQuery || selectedPersonFilter ? 'Try adjusting your filters' : 'Create your first occasion to get started!' }}
            </p>
            <button v-if="!searchQuery && !selectedPersonFilter" @click="openCreateModal" class="empty-state-button">
              Create Occasion
            </button>
          </div>

          <div v-else class="grouped-sections">
            <div
              v-for="(personOccasions, personName) in occasionsByPerson"
              :key="personName"
              class="person-group"
            >
              <div class="person-group-header">
                <div class="person-group-avatar">
                  {{ personName.charAt(0).toUpperCase() }}
                </div>
                <div class="person-group-info">
                  <h2 class="person-group-name">{{ personName }}</h2>
                  <span class="person-group-count">{{ personOccasions.length }} {{ personOccasions.length === 1 ? 'occasion' : 'occasions' }}</span>
                </div>
              </div>
              <div class="person-group-occasions">
                <div
                  v-for="occasion in personOccasions"
                  :key="occasion.occasion?.id || occasion.name"
                  class="occasion-card-compact"
                  :class="`status-${getDateStatus(occasion.date)}`"
                >
                  <div class="occasion-compact-header">
                    <h4 class="occasion-compact-name">{{ occasion.name }}</h4>
                    <div class="occasion-compact-actions">
                      <button
                        @click.stop="openEditModal(occasion)"
                        class="action-button-small edit-button"
                        aria-label="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        @click.stop="openDeleteModal(occasion)"
                        class="action-button-small delete-button"
                        aria-label="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="occasion-compact-date" :class="`badge-${getDateStatus(occasion.date)}`">
                    <span>{{ formatDate(occasion.date) }}</span>
                    <span class="occasion-compact-time">{{ getTimeUntilEvent(occasion.date) }}</span>
                  </div>
                  <p v-if="occasion.description" class="occasion-compact-description">
                    {{ occasion.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Create New Occasion</h2>
          <button @click="closeCreateModal" class="modal-close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Occasion Name *</label>
              <input
                v-model="formName"
                type="text"
                placeholder="e.g., Birthday, Anniversary"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input
                v-model="formDate"
                type="date"
                class="form-input"
                required
              />
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Person *</label>
              <select v-model="formRelationship" class="form-input" required>
                <option :value="null">Select a person</option>
                <option
                  v-for="relationship in allRelationships"
                  :key="relationship.id"
                  :value="relationship.name"
                >
                  {{ relationship.name }} ({{ relationship.relationshipType }})
                </option>
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Description (Optional)</label>
              <textarea
                v-model="formDescription"
                placeholder="Add any notes or details..."
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCreateModal" class="button-secondary">Cancel</button>
          <button @click="handleCreateOccasion" class="button-primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Creating...' : 'Create Occasion' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Occasion</h2>
          <button @click="closeEditModal" class="modal-close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Occasion Name *</label>
              <input
                v-model="formName"
                type="text"
                placeholder="e.g., Birthday, Anniversary"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input
                v-model="formDate"
                type="date"
                class="form-input"
                required
              />
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Person *</label>
              <select v-model="formRelationship" class="form-input" required>
                <option :value="null">Select a person</option>
                <option
                  v-for="relationship in allRelationships"
                  :key="relationship.id"
                  :value="relationship.name"
                >
                  {{ relationship.name }} ({{ relationship.relationshipType }})
                </option>
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Description (Optional)</label>
              <textarea
                v-model="formDescription"
                placeholder="Add any notes or details..."
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeEditModal" class="button-secondary">Cancel</button>
          <button @click="handleUpdateOccasion" class="button-primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Updating...' : 'Update Occasion' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content delete-modal-content">
        <div class="modal-header delete-modal-header-simple">
          <h2 class="modal-title">Delete Occasion</h2>
          <button @click="closeDeleteModal" class="modal-close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body delete-modal-body">
          <div class="delete-modal-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h3 class="delete-modal-title">Are you sure?</h3>
          <p class="delete-modal-message">
            This will permanently delete <strong>"{{ deletingOccasion?.name }}"</strong>. This action cannot be undone.
          </p>
        </div>
        <div class="modal-footer delete-modal-footer">
          <button @click="handleDeleteOccasion" class="button-danger">
            Delete Occasion
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

