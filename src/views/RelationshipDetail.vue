<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { sessionManager, relationshipApi, profileApi, notesApi } from '../api'
import { nameToSlug } from '../utils'

const router = useRouter()
const route = useRoute()

// App state
const currentUser = ref<any>(null)
const userProfile = ref<{ name: string; email: string } | null>(null)
const relationship = ref<any>(null)
const isLoading = ref(true)
const relationshipName = ref('')
const relationshipType = ref('')
const showUserMenu = ref(false)

// Notes state
const notes = ref<Array<{ note: any; title: string; content: string }>>([])
const showNoteModal = ref(false)
const showAllNotesModal = ref(false)
const noteTitle = ref('')
const noteContent = ref('')
const isCreatingNote = ref(false)
const isUpdatingNote = ref(false)
const viewingNote = ref<{ note: any; title: string; content: string } | null>(null)
const openedFromViewAll = ref(false)

// Display only first 8 notes on board, rest will be in "view all" modal
const displayedNotes = computed(() => notes.value.slice(0, 8))
const hasMoreNotes = computed(() => notes.value.length > 8)
const remainingNotesCount = computed(() => notes.value.length - 8)

// Photos state (placeholder for future implementation)
const photos = ref<Array<{ id: string; url: string; caption?: string }>>([])
const showPhotoForm = ref(false)

// Get user's first name from profile
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return firstName || userProfile.value.name || 'User'
  }
  return 'User'
})

// Post-it colors for variety
const postItColors = [
  '#FFE066', // Yellow
  '#FFB3BA', // Pink
  '#BAFFC9', // Green
  '#BAE1FF', // Blue
  '#FFFFBA', // Light Yellow
  '#FFDFBA', // Peach
]

const getPostItColor = (index: number) => {
  return postItColors[index % postItColors.length]
}

// Load relationship data
const loadRelationshipData = async () => {
  if (!currentUser.value) return

  try {
    const slug = route.params.id as string
    
    // Fetch all relationships and match by slug
    const allRelationships = await relationshipApi.getRelationships(currentUser.value)
    
    const matchingRelationship = allRelationships.find(r => {
      const relationshipSlug = nameToSlug(r.name)
      return relationshipSlug === slug
    })
    
    if (matchingRelationship) {
      relationshipName.value = matchingRelationship.name
      relationshipType.value = matchingRelationship.relationshipType
      relationship.value = matchingRelationship.relationship
      
      // Load notes for this relationship
      try {
        const notesData = await notesApi.getNotesByRelationship(
          currentUser.value,
          matchingRelationship.relationship
        )
        notes.value = notesData
      } catch (error) {
        console.error('Error loading notes:', error)
        notes.value = []
      }
    } else {
      console.error('Relationship not found for slug:', slug)
      relationshipName.value = slug.replace(/-/g, ' ')
      relationshipType.value = 'Friend'
    }
    
    isLoading.value = false
  } catch (error) {
    console.error('Error loading relationship:', error)
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

// Note management
const handleCreateNote = async () => {
  if (!noteTitle.value.trim() || !currentUser.value || !relationship.value) return

  isCreatingNote.value = true
  try {
    await notesApi.createNote(
      currentUser.value,
      relationship.value,
      noteTitle.value.trim(),
      noteContent.value.trim()
    )
    
    // Reload notes
    const notesData = await notesApi.getNotesByRelationship(
      currentUser.value,
      relationship.value
    )
    notes.value = notesData
    
    // Reset form and close modal
    noteTitle.value = ''
    noteContent.value = ''
    showNoteModal.value = false
  } catch (error) {
    console.error('Error creating note:', error)
    alert('Failed to create note. Please try again.')
  } finally {
    isCreatingNote.value = false
  }
}

const handleUpdateNote = async () => {
  if (!viewingNote.value || !noteTitle.value.trim() || !currentUser.value) return

  isUpdatingNote.value = true
  try {
    await notesApi.updateNote(
      viewingNote.value.note,
      noteTitle.value.trim(),
      noteContent.value
    )
    
    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      )
      notes.value = notesData
      
      // Update viewing note with new data
      const updatedNote = notesData.find((n: any) => n.note?.id === viewingNote.value?.note?.id)
      if (updatedNote) {
        viewingNote.value = updatedNote
      }
    }
  } catch (error) {
    console.error('Error updating note:', error)
    alert('Failed to update note. Please try again.')
  } finally {
    isUpdatingNote.value = false
  }
}

const handleDeleteNote = async (note: any) => {
  if (!confirm('Are you sure you want to delete this note?')) return

  try {
    await notesApi.deleteNote(note)
    
    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      )
      notes.value = notesData
    }
    
    // Close modal if viewing the deleted note
    if (viewingNote.value?.note === note) {
      showNoteModal.value = false
      viewingNote.value = null
      noteTitle.value = ''
      noteContent.value = ''
      
      // If opened from "View All Notes", return to that modal
      if (openedFromViewAll.value) {
        openedFromViewAll.value = false
        showAllNotesModal.value = true
      }
    }
  } catch (error) {
    console.error('Error deleting note:', error)
    alert('Failed to delete note. Please try again.')
  }
}

const openNoteModal = (note?: { note: any; title: string; content: string }, fromViewAll = false) => {
  openedFromViewAll.value = fromViewAll
  if (note) {
    viewingNote.value = note
    noteTitle.value = note.title
    noteContent.value = note.content
  } else {
    viewingNote.value = null
    noteTitle.value = ''
    noteContent.value = ''
  }
  showNoteModal.value = true
}

const closeNoteModal = () => {
  showNoteModal.value = false
  viewingNote.value = null
  noteTitle.value = ''
  noteContent.value = ''
  
  // If opened from "View All Notes", return to that modal
  if (openedFromViewAll.value) {
    openedFromViewAll.value = false
    showAllNotesModal.value = true
  }
}

const openNoteFromList = (note: { note: any; title: string; content: string }) => {
  showAllNotesModal.value = false
  openNoteModal(note, true)
}

const handleDeleteNoteFromList = async (note: any) => {
  if (!confirm('Are you sure you want to delete this note?')) return

  try {
    await notesApi.deleteNote(note)
    
    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      )
      notes.value = notesData
    }
  } catch (error) {
    console.error('Error deleting note:', error)
    alert('Failed to delete note. Please try again.')
  }
}

// Close user menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
}

// Close modal when clicking outside
const handleModalClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.classList.contains('modal-overlay')) {
    closeNoteModal()
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
  await loadRelationshipData()
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="relationship-detail-page">
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
    <main class="relationship-detail-main">
      <div v-if="isLoading" class="loading-state-full">
        <div class="spinner-large"></div>
        <p>Loading relationship...</p>
      </div>

      <div v-else class="relationship-detail-container">
        <!-- Relationship Info Section -->
        <section class="relationship-info-section">
          <div class="relationship-info-card">
            <div class="relationship-avatar-large">
              <span class="avatar-large-circle">
                {{ relationshipName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="relationship-info-text">
              <h1 class="relationship-name-large">{{ relationshipName }}</h1>
              <p class="relationship-type-badge">{{ relationshipType }}</p>
            </div>
          </div>
        </section>

        <!-- Two Column Layout -->
        <div class="relationship-content-grid">
          <!-- Left: Bulletin Board -->
          <section class="bulletin-board-section">
            <div class="bulletin-board-header">
              <h2 class="section-title-board">Bulletin Board</h2>
              <button
                @click="openNoteModal()"
                class="add-button"
                aria-label="Add note"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Note
              </button>
            </div>

            <!-- Bulletin Board -->
            <div class="bulletin-board">
              <div v-if="notes.length === 0" class="empty-notes">
                <p>No notes yet. Add your first note!</p>
              </div>
              <div
                v-for="(note, index) in displayedNotes"
                :key="note.note?.id || index"
                class="post-it-note"
                :style="{ backgroundColor: getPostItColor(index) }"
                @click="openNoteModal(note)"
              >
                <button
                  @click.stop="handleDeleteNote(note.note)"
                  class="post-it-delete"
                  aria-label="Delete note"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <h3 class="post-it-title">{{ note.title }}</h3>
                <p class="post-it-content">{{ note.content }}</p>
              </div>
              <!-- Special "View All Notes" post-it -->
              <div
                v-if="hasMoreNotes"
                class="post-it-note post-it-view-all"
                @click="showAllNotesModal = true"
              >
                <div class="view-all-content">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <h3 class="post-it-title">View All</h3>
                  <p class="post-it-content">{{ remainingNotesCount }} more note{{ remainingNotesCount > 1 ? 's' : '' }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Right: Photo Board -->
          <section class="photo-board-section">
            <div class="photo-board-header">
              <h2 class="section-title-board">Photo Board</h2>
              <button
                @click="showPhotoForm = !showPhotoForm"
                class="add-button"
                aria-label="Add photo"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Photo
              </button>
            </div>

            <!-- Photo Form (Placeholder) -->
            <div v-if="showPhotoForm" class="photo-form-container">
              <div class="photo-form">
                <p class="photo-form-placeholder">Photo upload coming soon!</p>
                <button @click="showPhotoForm = false" class="photo-form-close">
                  Close
                </button>
              </div>
            </div>

            <!-- Photo Board -->
            <div class="photo-board">
              <div v-if="photos.length === 0" class="empty-photos">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <p>No photos yet. Add your first memory!</p>
              </div>
              <div class="photo-grid">
                <div
                  v-for="photo in photos"
                  :key="photo.id"
                  class="photo-item"
                >
                  <img :src="photo.url" :alt="photo.caption || 'Photo'" />
                  <div v-if="photo.caption" class="photo-caption">
                    {{ photo.caption }}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>

    <!-- View All Notes Modal -->
    <transition name="modal">
      <div
        v-if="showAllNotesModal"
        class="modal-overlay"
        @click="showAllNotesModal = false"
      >
        <div class="modal-container modal-container-large" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">All Notes</h2>
            <button
              @click="showAllNotesModal = false"
              class="modal-close"
              aria-label="Close modal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-content modal-content-scrollable">
            <div v-if="notes.length === 0" class="empty-notes-list">
              <p>No notes yet. Add your first note!</p>
            </div>
            <div v-else class="all-notes-list">
              <div
                v-for="(note, index) in notes"
                :key="note.note?.id || index"
                class="note-list-item"
                @click="openNoteFromList(note)"
              >
                <div class="note-list-item-color" :style="{ backgroundColor: getPostItColor(index) }"></div>
                <div class="note-list-item-content">
                  <h3 class="note-list-item-title">{{ note.title }}</h3>
                  <p class="note-list-item-text">{{ note.content }}</p>
                </div>
                <button
                  @click.stop="handleDeleteNoteFromList(note.note)"
                  class="note-list-item-delete"
                  aria-label="Delete note"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Note Modal -->
    <transition name="modal">
      <div
        v-if="showNoteModal"
        class="modal-overlay"
        @click="handleModalClick"
      >
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">{{ viewingNote ? 'Edit Note' : 'New Note' }}</h2>
            <button
              @click="closeNoteModal"
              class="modal-close"
              aria-label="Close modal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-content">
            <div class="modal-form">
              <div class="modal-field">
                <label class="modal-label">Title</label>
                <input
                  v-model="noteTitle"
                  type="text"
                  placeholder="Note title..."
                  class="modal-input"
                />
              </div>
              <div class="modal-field">
                <label class="modal-label">Content</label>
                <textarea
                  v-model="noteContent"
                  placeholder="Write your note here..."
                  class="modal-textarea"
                  rows="8"
                ></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              v-if="viewingNote"
              @click="handleDeleteNote(viewingNote.note)"
              class="modal-button modal-button-danger"
              :disabled="isUpdatingNote"
            >
              Delete Note
            </button>
            <div class="modal-footer-actions">
              <button
                v-if="!viewingNote"
                @click="handleCreateNote"
                :disabled="!noteTitle.trim() || isCreatingNote"
                class="modal-button modal-button-primary"
              >
                {{ isCreatingNote ? 'Creating...' : 'Create Note' }}
              </button>
              <button
                v-if="viewingNote"
                @click="handleUpdateNote"
                :disabled="!noteTitle.trim() || isUpdatingNote"
                class="modal-button modal-button-primary"
              >
                {{ isUpdatingNote ? 'Updating...' : 'Update Note' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
