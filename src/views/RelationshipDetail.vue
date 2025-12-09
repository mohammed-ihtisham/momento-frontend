<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  sessionManager,
  relationshipApi,
  profileApi,
  notesApi,
  memoryGalleryApi,
  // collaboratorsApi,
} from "../api";
import { nameToSlug } from "../utils";

const router = useRouter();
const route = useRoute();

// App state
const currentUser = ref<any>(null);
const userProfile = ref<{
  name: string;
  email: string;
  username?: string;
} | null>(null);
const relationship = ref<any>(null);
const isLoading = ref(true);
const relationshipName = ref("");
const relationshipType = ref("");
const showUserMenu = ref(false);

// Invitations dropdown (inbox)
const showInvitesMenu = ref(false);
const invitations = ref<
  Array<{
    id: string;
    invitePayload: any;
    toUsername: string;
    createdAt: string;
    status: "pending" | "accepted" | "error";
    errorMessage?: string;
  }>
>([]);

// const pendingInvitationsCount = computed(
//   () => invitations.value.filter((i) => i.status === "pending").length
// );

// Notes state
const notes = ref<Array<{ note: any; title: string; content: string }>>([]);
const showNoteModal = ref(false);
const showAllNotesModal = ref(false);
const noteTitle = ref("");
const noteContent = ref("");
const isCreatingNote = ref(false);
const isUpdatingNote = ref(false);
const isDeletingNote = ref(false);
const deletingNoteId = ref<string | null>(null);
const viewingNote = ref<{ note: any; title: string; content: string } | null>(
  null
);
const openedFromViewAll = ref(false);
const noteFeedback = ref<{ type: "success" | "error"; message: string } | null>(
  null
);
let noteFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

// Display only first 8 notes on board, rest will be in "view all" modal
const displayedNotes = computed(() => notes.value.slice(0, 8));
const hasMoreNotes = computed(() => notes.value.length > 8);
const remainingNotesCount = computed(() => notes.value.length - 8);

// Photos state
const photos = ref<Array<{ imageUrl: string; uploadDate: string }>>([]);
const showPhotoForm = ref(false);
const selectedFile = ref<File | null>(null);
const isUploadingPhoto = ref(false);
const photoFileInput = ref<HTMLInputElement | null>(null);

// New: drag state + preview for photo upload
const isDraggingFile = ref(false);
const previewUrl = ref<string | null>(null);

// Photo gallery / lightbox state
const isGalleryOpen = ref(false);
const activePhotoIndex = ref(0);
const currentPhoto = computed(
  () =>
    photos.value &&
    photos.value.length &&
    photos.value[activePhotoIndex.value]
      ? photos.value[activePhotoIndex.value]
      : null
);

const cleanupPreviewUrl = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
};

const openGallery = (index: number) => {
  if (!photos.value || photos.value.length === 0) return;
  activePhotoIndex.value = index;
  if (activePhotoIndex.value < 0) activePhotoIndex.value = 0;
  if (activePhotoIndex.value >= photos.value.length) {
    activePhotoIndex.value = photos.value.length - 1;
  }
  isGalleryOpen.value = true;
  // Lock background scroll while gallery is open
  document.body.style.overflow = "hidden";
};

const closeGallery = () => {
  isGalleryOpen.value = false;
  document.body.style.overflow = "";
};

const setActivePhoto = (index: number) => {
  if (!photos.value || photos.value.length === 0) return;
  if (index < 0 || index >= photos.value.length) return;
  activePhotoIndex.value = index;
};

const showNextPhoto = () => {
  if (!photos.value || photos.value.length === 0) return;
  activePhotoIndex.value =
    (activePhotoIndex.value + 1) % photos.value.length;
};

const showPrevPhoto = () => {
  if (!photos.value || photos.value.length === 0) return;
  activePhotoIndex.value =
    (activePhotoIndex.value - 1 + photos.value.length) %
    photos.value.length;
};

const handleGalleryKeydown = (event: KeyboardEvent) => {
  if (!isGalleryOpen.value) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeGallery();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    showNextPhoto();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    showPrevPhoto();
  }
};

// Get user's first name from profile
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(" ")[0];
    return (
      firstName ||
      userProfile.value.name ||
      userProfile.value.username ||
      "User"
    );
  }
  return userProfile.value?.username || currentUser.value?.username || "User";
});

// Load incoming invitations for the current user from backend
const loadInvitations = async () => {
  try {
    // const backendInvites = await collaboratorsApi.getIncomingInvites();
    // invitations.value = (backendInvites || [])
    //   .filter((inv: any) => inv.status === "pending")
    //   .map((inv: any) => {
    //     const rawInvite = inv.invite;
    //     const sender = inv.sender;
    //     const username =
    //       typeof sender === "string"
    //         ? sender
    //         : sender?.username || sender?.name || "someone";
    //     return {
    //       id: String(rawInvite?.id ?? rawInvite ?? inv.id ?? ""),
    //       invitePayload: rawInvite,
    //       toUsername: username,
    //       createdAt: inv.createdAt,
    //       status: "pending" as const,
    //     };
    //   });
  } catch (error) {
    console.error("Failed to load collaborator invitations:", error);
    invitations.value = [];
  }
};

// Post-it colors for variety
const postItColors = [
  "#FFE066", // Yellow
  "#FFB3BA", // Pink
  "#BAFFC9", // Green
  "#BAE1FF", // Blue
  "#FFFFBA", // Light Yellow
  "#FFDFBA", // Peach
];

const getPostItColor = (index: number) => {
  return postItColors[index % postItColors.length];
};

// Load relationship data
const loadRelationshipData = async () => {
  if (!currentUser.value) return;

  try {
    const slug = route.params.id as string;

    // Fetch all relationships and match by slug
    const allRelationships = await relationshipApi.getRelationships(
      currentUser.value
    );

    const matchingRelationship = allRelationships.find((r) => {
      const relationshipSlug = nameToSlug(r.name);
      return relationshipSlug === slug;
    });

    if (matchingRelationship) {
      relationshipName.value = matchingRelationship.name;
      relationshipType.value = matchingRelationship.relationshipType;
      relationship.value = matchingRelationship.relationship;

      // Load notes for this relationship
      try {
        const notesData = await notesApi.getNotesByRelationship(
          currentUser.value,
          matchingRelationship.relationship
        );
        notes.value = notesData;
      } catch (error) {
        console.error("Error loading notes:", error);
        notes.value = [];
      }

      // Load photos for this relationship
      try {
        const photosData = await memoryGalleryApi.getImagesByRelationship(
          currentUser.value,
          matchingRelationship.relationship
        );
        console.log("Loaded photos:", photosData);
        photos.value = photosData || [];
      } catch (error) {
        console.error("Error loading photos:", error);
        photos.value = [];
      }
    } else {
      console.error("Relationship not found for slug:", slug);
      relationshipName.value = slug.replace(/-/g, " ");
      relationshipType.value = "Friend";
    }

    isLoading.value = false;
  } catch (error) {
    console.error("Error loading relationship:", error);
    isLoading.value = false;
  }
};

// Load user profile
const loadUserProfile = async () => {
  if (!currentUser.value) return;

  try {
    const profile = await profileApi.getProfile(currentUser.value);
    if (profile && profile.name) {
      userProfile.value = profile;
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
};

// Handle back navigation (return to previous page when possible)
const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
};

// Logout function
const handleLogout = async () => {
  sessionManager.clearUser();
  currentUser.value = null;
  userProfile.value = null;
  showUserMenu.value = false;
  router.replace("/");
};

// Note management
const handleCreateNote = async () => {
  if (!noteTitle.value.trim() || !currentUser.value || !relationship.value)
    return;

  isCreatingNote.value = true;
  try {
    await notesApi.createNote(
      currentUser.value,
      relationship.value,
      noteTitle.value.trim(),
      noteContent.value.trim()
    );

    // Reload notes
    const notesData = await notesApi.getNotesByRelationship(
      currentUser.value,
      relationship.value
    );
    notes.value = notesData;

    // Reset form and close modal
    noteTitle.value = "";
    noteContent.value = "";
    showNoteModal.value = false;
  } catch (error) {
    console.error("Error creating note:", error);
    alert("Failed to create note. Please try again.");
  } finally {
    isCreatingNote.value = false;
  }
};

const clearNoteFeedback = () => {
  if (noteFeedbackTimeout) {
    clearTimeout(noteFeedbackTimeout);
    noteFeedbackTimeout = null;
  }
  noteFeedback.value = null;
};

const showNoteFeedback = (
  message: string,
  type: "success" | "error" = "success"
) => {
  noteFeedback.value = { message, type };
  if (noteFeedbackTimeout) {
    clearTimeout(noteFeedbackTimeout);
  }
  noteFeedbackTimeout = setTimeout(() => {
    noteFeedback.value = null;
    noteFeedbackTimeout = null;
  }, 3500);
};

const handleUpdateNote = async () => {
  if (!viewingNote.value || !noteTitle.value.trim() || !currentUser.value)
    return;

  isUpdatingNote.value = true;
  try {
    await notesApi.updateNote(
      viewingNote.value.note,
      noteTitle.value.trim(),
      noteContent.value
    );

    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      );
      notes.value = notesData;

      // Update viewing note with new data
      const updatedNote = notesData.find(
        (n: any) => n.note?.id === viewingNote.value?.note?.id
      );
      if (updatedNote) {
        viewingNote.value = updatedNote;
      }
    }

    showNoteFeedback("Note updated successfully.");
    closeNoteModal();
  } catch (error) {
    console.error("Error updating note:", error);
    alert("Failed to update note. Please try again.");
  } finally {
    isUpdatingNote.value = false;
  }
};

const handleDeleteNote = async (note: any) => {
  isDeletingNote.value = true;
  deletingNoteId.value = note?.id || null;
  try {
    await notesApi.deleteNote(note);

    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      );
      notes.value = notesData;
    }

    // Close modal if viewing the deleted note
    if (viewingNote.value?.note === note) {
      showNoteModal.value = false;
      viewingNote.value = null;
      noteTitle.value = "";
      noteContent.value = "";

      // If opened from "View All Notes", return to that modal
      if (openedFromViewAll.value) {
        openedFromViewAll.value = false;
        showAllNotesModal.value = true;
      }
    }

    showNoteFeedback("Note deleted successfully.");
  } catch (error) {
    console.error("Error deleting note:", error);
    showNoteFeedback("Failed to delete note. Please try again.", "error");
  } finally {
    isDeletingNote.value = false;
    deletingNoteId.value = null;
  }
};

const openNoteModal = (
  note?: { note: any; title: string; content: string },
  fromViewAll = false
) => {
  openedFromViewAll.value = fromViewAll;
  if (note) {
    viewingNote.value = note;
    noteTitle.value = note.title;
    noteContent.value = note.content;
  } else {
    viewingNote.value = null;
    noteTitle.value = "";
    noteContent.value = "";
  }
  showNoteModal.value = true;
};

const closeNoteModal = () => {
  showNoteModal.value = false;
  viewingNote.value = null;
  noteTitle.value = "";
  noteContent.value = "";

  // If opened from "View All Notes", return to that modal
  if (openedFromViewAll.value) {
    openedFromViewAll.value = false;
    showAllNotesModal.value = true;
  }
};

const openNoteFromList = (note: {
  note: any;
  title: string;
  content: string;
}) => {
  showAllNotesModal.value = false;
  openNoteModal(note, true);
};

const handleDeleteNoteFromList = async (note: any) => {
  isDeletingNote.value = true;
  deletingNoteId.value = note?.id || null;
  try {
    await notesApi.deleteNote(note);

    // Reload notes
    if (currentUser.value && relationship.value) {
      const notesData = await notesApi.getNotesByRelationship(
        currentUser.value,
        relationship.value
      );
      notes.value = notesData;
    }

    showNoteFeedback("Note deleted successfully.");
  } catch (error) {
    console.error("Error deleting note:", error);
    showNoteFeedback("Failed to delete note. Please try again.", "error");
  } finally {
    isDeletingNote.value = false;
    deletingNoteId.value = null;
  }
};

// Photo management
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0 && target.files[0]) {
    const file = target.files[0];
    selectedFile.value = file;
    cleanupPreviewUrl();
    previewUrl.value = URL.createObjectURL(file);
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  isDraggingFile.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  isDraggingFile.value = false;
};

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault();
  isDraggingFile.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0 && files[0]) {
    const file = files[0];
    selectedFile.value = file;
    cleanupPreviewUrl();
    previewUrl.value = URL.createObjectURL(file);
    if (photoFileInput.value) {
      // keep input in sync for accessibility
      const dt = new DataTransfer();
      dt.items.add(file);
      photoFileInput.value.files = dt.files;
    }
  }
};

const handleUploadPhoto = async () => {
  if (!selectedFile.value || !currentUser.value || !relationship.value) return;

  isUploadingPhoto.value = true;
  try {
    await memoryGalleryApi.uploadImage(
      selectedFile.value,
      currentUser.value,
      relationship.value
    );

    // Reload photos
    const photosData = await memoryGalleryApi.getImagesByRelationship(
      currentUser.value,
      relationship.value
    );
    photos.value = photosData || [];

    // Reset form
    selectedFile.value = null;
    cleanupPreviewUrl();
    if (photoFileInput.value) {
      photoFileInput.value.value = "";
    }
    showPhotoForm.value = false;
  } catch (error) {
    console.error("Error uploading photo:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to upload photo. Please try again.";
    alert(errorMessage);
  } finally {
    isUploadingPhoto.value = false;
  }
};

const handleCancelPhotoUpload = () => {
  selectedFile.value = null;
  cleanupPreviewUrl();
  if (photoFileInput.value) {
    photoFileInput.value.value = "";
  }
  showPhotoForm.value = false;
};

// Image loading handlers
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  console.error("Failed to load image:", img.src);
  // Optionally set a placeholder image
  img.style.display = "none";
};

const handleImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement;
  console.log("Image loaded successfully:", img.src);
};

// Close user menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".user-menu-wrapper")) {
    showUserMenu.value = false;
  }
  if (!target.closest(".navbar-mail-wrapper")) {
    showInvitesMenu.value = false;
  }
};

// Close modal when clicking outside
const handleModalClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("modal-overlay")) {
    closeNoteModal();
  }
};

onMounted(async () => {
  const savedUser = sessionManager.getUser();
  if (!savedUser) {
    router.push("/");
    return;
  }

  currentUser.value = savedUser;
  await loadUserProfile();
  await loadRelationshipData();
  await loadInvitations();

  document.addEventListener("click", handleClickOutside);
  window.addEventListener("keydown", handleGalleryKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  window.removeEventListener("keydown", handleGalleryKeydown);
  clearNoteFeedback();
  cleanupPreviewUrl();
});
</script>

<template>
  <div class="relationship-detail-page">
    <!-- Everything except the lightbox goes inside page-content so we can blur it -->
    <div
      class="page-content"
      :class="{ 'page-content-blurred': isGalleryOpen }"
    >
      <div
        v-if="noteFeedback"
        class="note-toast"
        :class="{
          'note-toast-success': noteFeedback.type === 'success',
          'note-toast-error': noteFeedback.type === 'error',
        }"
        role="status"
        aria-live="polite"
      >
        <div class="note-toast-icon">
          <svg
            v-if="noteFeedback.type === 'success'"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
        <div class="note-toast-message">{{ noteFeedback.message }}</div>
        <button
          class="note-toast-close"
          @click="clearNoteFeedback"
          aria-label="Dismiss notification"
        >
          &times;
        </button>
      </div>

      <!-- Header Bar -->
      <header class="relationship-detail-header">
        <div class="relationship-detail-header-content">
          <div class="relationship-detail-logo">
            <button
              @click="handleBack"
              class="back-button-inline"
              aria-label="Go back"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <img src="/momento-logo.png" alt="Momento" class="logo-image" />
            <span class="logo-text">Momento</span>
          </div>
          <div class="navbar-right">
            <!-- invitations dropdown omitted -->
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
                <button class="menu-item menu-item-danger" @click="handleLogout">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Log Out
                </button>
              </div>
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
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
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
                    :disabled="isDeletingNote && deletingNoteId === note.note?.id"
                    aria-label="Delete note"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
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
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <h3 class="post-it-title">View All</h3>
                    <p class="post-it-content">
                      {{ remainingNotesCount }} more note{{
                        remainingNotesCount > 1 ? "s" : ""
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Right: Photo Board -->
            <section class="photo-board-section">
              <div class="photo-board-header">
                <h2 class="section-title-board">Photo Board</h2>
                <button
                  @click="showPhotoForm = true"
                  class="add-button"
                  aria-label="Add photo"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Photo
                </button>
              </div>

              <!-- Photo Board -->
              <div class="photo-board">
                <div v-if="photos.length === 0" class="empty-photos">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-opacity="0.3"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <p>No photos yet. Add your first memory!</p>
                </div>
                <div v-else class="photo-grid">
                  <button
                    v-for="(photo, index) in photos"
                    :key="photo.imageUrl || index"
                    class="photo-item"
                    type="button"
                    @click="openGallery(index)"
                    @keydown.enter.prevent="openGallery(index)"
                    @keydown.space.prevent="openGallery(index)"
                  >
                    <img
                      :src="photo.imageUrl"
                      :alt="
                        'Photo uploaded on ' +
                        new Date(photo.uploadDate).toLocaleDateString()
                      "
                      class="photo-item-image"
                      @error="handleImageError"
                      @load="handleImageLoad"
                    />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <!-- Add Photo Modal -->
      <transition name="modal">
        <div
          v-if="showPhotoForm"
          class="modal-overlay photo-upload-modal"
          @click.self="handleCancelPhotoUpload"
        >
          <div class="modal-container photo-upload-container" @click.stop>
            <!-- Header -->
            <div class="photo-upload-header">
              <div class="photo-upload-title-row">
                <div class="photo-upload-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
                    <circle cx="9" cy="9" r="2"></circle>
                    <path d="M21 15l-4-4-5 6-3-3-5 7" />
                  </svg>
                </div>
                <div>
                  <h2 class="modal-title photo-upload-title">Add a memory</h2>
                  <p class="photo-upload-subtitle">
                    Upload a special photo for {{ relationshipName }}&rsquo;s memory
                    board.
                  </p>
                </div>
              </div>
              <button
                @click="handleCancelPhotoUpload"
                class="modal-close"
                aria-label="Close modal"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Card body -->
            <div class="photo-upload-card">
              <!-- Drag & drop zone -->
              <label
                class="photo-dropzone"
                :class="{ 'photo-dropzone-active': isDraggingFile }"
                @dragover.prevent="handleDragOver"
                @dragleave.prevent="handleDragLeave"
                @drop.prevent="handleFileDrop"
                for="photo-input"
              >
                <div class="photo-dropzone-top-row">
                  <span class="photo-dropzone-badge">JPG Â· PNG Â· HEIC</span>
                </div>
                <div class="photo-dropzone-main">
                  <p class="photo-dropzone-title">
                    Drag &amp; drop a photo here
                  </p>
                  <p class="photo-dropzone-text">
                    or <span class="photo-dropzone-cta">click to browse</span>
                  </p>
                </div>
              </label>

              <!-- Visually hidden real input (removes ugly native 'No file chosen') -->
              <input
                id="photo-input"
                ref="photoFileInput"
                type="file"
                accept="image/*"
                class="photo-input-hidden"
                @change="handleFileSelect"
              />

              <!-- Selected file row -->
              <div
                v-if="selectedFile"
                class="photo-selected-row"
                @click="photoFileInput && photoFileInput.click()"
              >
                <div class="photo-file-chip">
                  <div class="photo-file-thumb" v-if="previewUrl">
                    <img :src="previewUrl" alt="Selected photo preview" />
                  </div>
                  <div class="photo-file-meta">
                    <span class="photo-file-name">{{ selectedFile.name }}</span>
                    <span class="photo-file-size">
                      {{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB
                    </span>
                  </div>
                </div>
              </div>

              <!-- Tip -->
              <p class="photo-upload-hint">
                Tip: choose a photo that captures a favorite moment you never want to
                forget.
              </p>

              <!-- Footer inside card -->
              <div class="photo-upload-footer">
                <span class="photo-footer-meta">Max size 10 MB</span>
                <div class="photo-footer-actions">
                  <button
                    @click="handleUploadPhoto"
                    class="modal-button modal-button-primary photo-upload-primary"
                    :disabled="!selectedFile || isUploadingPhoto"
                  >
                    {{ isUploadingPhoto ? "Uploading..." : "Save to board" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

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
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
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
                  <div
                    class="note-list-item-color"
                    :style="{ backgroundColor: getPostItColor(index) }"
                  ></div>
                  <div class="note-list-item-content">
                    <h3 class="note-list-item-title">{{ note.title }}</h3>
                    <p class="note-list-item-text">{{ note.content }}</p>
                  </div>
                  <button
                    @click.stop="handleDeleteNoteFromList(note.note)"
                    class="note-list-item-delete"
                    :disabled="isDeletingNote && deletingNoteId === note.note?.id"
                    aria-label="Delete note"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
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
        <div v-if="showNoteModal" class="modal-overlay" @click="handleModalClick">
          <div class="modal-container" @click.stop>
            <div class="modal-header">
              <h2 class="modal-title">
                {{ viewingNote ? "Edit Note" : "New Note" }}
              </h2>
              <button
                @click="closeNoteModal"
                class="modal-close"
                aria-label="Close modal"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-content">
              <p v-if="!viewingNote" class="modal-helper-text">
                Add notes you'd like to remember about {{ relationshipName }}
              </p>
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
                :disabled="
                  isUpdatingNote ||
                  (isDeletingNote && deletingNoteId === viewingNote.note?.id)
                "
              >
                {{
                  isDeletingNote && deletingNoteId === viewingNote.note?.id
                    ? "Deleting..."
                    : "Delete Note"
                }}
              </button>
              <div class="modal-footer-actions">
                <button
                  v-if="!viewingNote"
                  @click="handleCreateNote"
                  :disabled="!noteTitle.trim() || isCreatingNote"
                  class="modal-button modal-button-primary"
                >
                  {{ isCreatingNote ? "Creating..." : "Create Note" }}
                </button>
                <button
                  v-if="viewingNote"
                  @click="handleUpdateNote"
                  :disabled="!noteTitle.trim() || isUpdatingNote"
                  class="modal-button modal-button-primary"
                >
                  {{ isUpdatingNote ? "Updating..." : "Update Note" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Photo Gallery / Lightbox (kept outside page-content for clean blur) -->
    <transition name="photo-lightbox">
      <div
        v-if="isGalleryOpen && currentPhoto"
        class="photo-lightbox-overlay"
        @click.self="closeGallery"
        aria-modal="true"
        role="dialog"
      >
        <div class="photo-lightbox-dialog">
          <div class="photo-lightbox-topbar">
            <div class="photo-lightbox-meta">
              <span class="photo-lightbox-label">Memory Gallery</span>
              <span class="photo-lightbox-counter">
                {{ activePhotoIndex + 1 }} / {{ photos.length }}
              </span>
            </div>
            <button
              class="photo-lightbox-close"
              type="button"
              @click="closeGallery"
              aria-label="Close gallery"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="photo-lightbox-main">
            <button
              class="photo-lightbox-nav photo-lightbox-nav-prev"
              type="button"
              @click.stop="showPrevPhoto"
              aria-label="Previous photo"
            >
              <span>&larr;</span>
            </button>

            <figure class="photo-lightbox-figure">
              <img
                :src="currentPhoto.imageUrl"
                :alt="
                  'Photo ' +
                  (activePhotoIndex + 1) +
                  ' of ' +
                  photos.length +
                  ' in memory gallery'
                "
              />
              <figcaption class="photo-lightbox-caption">
                <span class="photo-lightbox-date">
                  {{
                    new Date(
                      currentPhoto.uploadDate
                    ).toLocaleDateString()
                  }}
                </span>
              </figcaption>
            </figure>

            <button
              class="photo-lightbox-nav photo-lightbox-nav-next"
              type="button"
              @click.stop="showNextPhoto"
              aria-label="Next photo"
            >
              <span>&rarr;</span>
            </button>
          </div>

          <div class="photo-lightbox-thumbs" v-if="photos.length > 1">
            <button
              v-for="(photo, index) in photos"
              :key="photo.imageUrl || index"
              type="button"
              class="photo-lightbox-thumb"
              :class="{
                'photo-lightbox-thumb-active': index === activePhotoIndex
              }"
              @click.stop="setActivePhoto(index)"
            >
              <img
                :src="photo.imageUrl"
                :alt="
                  'Thumbnail ' +
                  (index + 1) +
                  ' of ' +
                  photos.length +
                  ' in memory gallery'
                "
              />
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Page blur when lightbox is open */
.page-content {
  transition:
    filter 0.22s ease,
    transform 0.22s ease,
    opacity 0.22s ease;
}

.page-content-blurred {
  filter: blur(6px) brightness(0.92);
  transform: scale(0.985);
  opacity: 0.92;
}

/* Modern Add Photo modal layout & hierarchy */

.photo-upload-modal {
  backdrop-filter: blur(22px);
}

.photo-upload-container {
  max-width: 540px;
  width: 100%;
  border-radius: 24px;
  padding: 26px 28px;
  background: radial-gradient(circle at top left, #fff7fb 0, #ffffff 55%, #f8f4ff 100%);
  box-shadow:
    0 22px 60px rgba(15, 23, 42, 0.26),
    0 0 0 1px rgba(148, 163, 184, 0.08);
}

.photo-upload-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.photo-upload-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.photo-upload-icon {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 0, #fee2e2, #fecaca);
  color: #be123c;
  box-shadow: 0 8px 20px rgba(248, 113, 113, 0.35);
}

.photo-upload-title {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #0f172a;
}

.photo-upload-subtitle {
  margin: 4px 0 0;
  font-size: 0.87rem;
  color: #6b7280;
}

/* Main card */
.photo-upload-card {
  background: rgba(248, 250, 252, 0.92);
  border-radius: 20px;
  padding: 22px 22px 18px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}

/* Dropzone */
.photo-dropzone {
  display: block;
  position: relative;
  border-radius: 16px;
  padding: 20px 20px 24px;
  border: 1px dashed rgba(236, 72, 153, 0.35);
  background: rgba(255, 247, 254, 0.9);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.12s ease,
    background 0.16s ease;
}

.photo-dropzone:hover {
  border-color: #ec4899;
  box-shadow: 0 14px 34px rgba(236, 72, 153, 0.18);
  transform: translateY(-1px);
}

.photo-dropzone-active {
  border-color: #ec4899;
  background: rgba(255, 228, 242, 0.95);
}

.photo-dropzone-top-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}

.photo-dropzone-badge {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.9);
  color: #6b7280;
}

.photo-dropzone-main {
  text-align: center;
}

.photo-dropzone-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.photo-dropzone-text {
  font-size: 0.84rem;
  color: #6b7280;
}

.photo-dropzone-cta {
  color: #ec4899;
  font-weight: 600;
}

/* Hide real input */
.photo-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Selected file row */
.photo-selected-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  cursor: pointer;
}

.photo-file-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  flex: 1;
  min-width: 0;
}

.photo-file-thumb {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(209, 213, 219, 0.8);
}

.photo-file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-file-meta {
  display: flex;
  flex-direction: column;
}

.photo-file-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-file-size {
  font-size: 0.74rem;
  color: #9ca3af;
}

.photo-change-button {
  border: none;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 500;
  color: #ec4899;
  text-decoration: underline;
  cursor: pointer;
}

/* Tip */
.photo-upload-hint {
  margin-top: 10px;
  font-size: 0.78rem;
  color: #9ca3af;
}

/* Footer inside card */
.photo-upload-footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.photo-footer-meta {
  font-size: 0.76rem;
  color: #9ca3af;
}

.photo-footer-actions {
  display: flex;
  gap: 0;
}

.photo-upload-primary {
  background: linear-gradient(135deg, #ec4899, #f97316);
  border: none;
  box-shadow: none;
}

.photo-upload-primary:disabled {
  background: linear-gradient(135deg, #f9a8d4, #fed7aa);
  box-shadow: none;
  cursor: not-allowed;
}

/* Photo Board clickable items */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.photo-item {
  position: relative;
  border: none;
  padding: 0;
  margin: 0;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.04);
  transition:
    transform 0.12s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.photo-item:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow:
    0 10px 25px rgba(15, 23, 42, 0.28),
    0 0 0 1px rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.08);
}

.photo-item:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

.photo-item-image {
  display: block;
  width: 100%;
  height: 110px;
  object-fit: cover;
}

/* Photo Lightbox / Gallery */
.photo-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Let underlying page show through with a light, frosted veil */
  background: radial-gradient(
      circle at top center,
      rgba(148, 163, 184, 0.45),
      rgba(15, 23, 42, 0.75)
    );
  backdrop-filter: blur(22px);
}

.photo-lightbox-dialog {
  width: 100%;
  max-width: 1120px;
  max-height: 90vh;
  border-radius: 26px;
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;

  /* light glass card to fit app theme */
  background: linear-gradient(
    135deg,
    rgba(249, 250, 251, 0.98),
    rgba(243, 244, 246, 0.98),
    rgba(229, 231, 235, 0.98)
  );
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow:
    0 26px 60px rgba(15, 23, 42, 0.4),
    0 0 0 1px rgba(148, 163, 184, 0.55);
  backdrop-filter: blur(16px) saturate(140%);
}

.photo-lightbox-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #111827;
}

.photo-lightbox-meta {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.photo-lightbox-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #6b7280;
}

.photo-lightbox-counter {
  font-size: 0.9rem;
  font-weight: 500;
  color: #111827;
}

.photo-lightbox-close {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(15, 23, 42, 0.7);
  color: #e5e7eb;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.16s ease,
    transform 0.12s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.photo-lightbox-close:hover {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(249, 250, 251, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.6);
}

.photo-lightbox-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 0;
  margin-top: 8px;
}

.photo-lightbox-figure {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  max-width: 980px;
  width: 100%;
  max-height: min(64vh, 620px);
  box-shadow:
    0 22px 45px rgba(15, 23, 42, 0.6),
    0 0 0 1px rgba(148, 163, 184, 0.7);
  background: radial-gradient(
    circle at top center,
    rgba(15, 23, 42, 0.98),
    rgba(3, 7, 18, 1)
  );
}

.photo-lightbox-figure img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: radial-gradient(
    circle at center,
    rgba(15, 23, 42, 0.9),
    rgba(3, 7, 18, 1)
  );
  animation: lightbox-zoom-in 0.25s ease-out;
}

@keyframes lightbox-zoom-in {
  from {
    transform: scale(0.97);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.photo-lightbox-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(
    to top,
    rgba(15, 23, 42, 0.9),
    rgba(15, 23, 42, 0.4),
    transparent
  );
  color: #e5e7eb;
  font-size: 0.82rem;
}

.photo-lightbox-date {
  font-weight: 500;
}

.photo-lightbox-nav {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.95rem;
  transition:
    background 0.16s ease,
    transform 0.12s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}

.photo-lightbox-nav span {
  transform: translateY(-1px);
}

.photo-lightbox-nav:hover {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 1),
    rgba(249, 250, 251, 1)
  );
  border-color: rgba(249, 115, 22, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.35);
}

.photo-lightbox-nav-prev {
  margin-right: -4px;
}

.photo-lightbox-nav-next {
  margin-left: -4px;
}

.photo-lightbox-thumbs {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  justify-content: center;
}

.photo-lightbox-thumb {
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 0;
  background: transparent;
  width: 60px;
  height: 56px;
  overflow: hidden;
  cursor: pointer;
  flex: 0 0 auto;
  transform: translateY(4px);
  opacity: 0;
  animation: thumb-fade-up 0.25s ease-out forwards;
  transition:
    opacity 0.16s ease,
    transform 0.12s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.photo-lightbox-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-lightbox-thumb:nth-child(1) {
  animation-delay: 0.05s;
}

.photo-lightbox-thumb:nth-child(2) {
  animation-delay: 0.09s;
}

.photo-lightbox-thumb:nth-child(3) {
  animation-delay: 0.13s;
}

@keyframes thumb-fade-up {
  from {
    transform: translateY(8px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.photo-lightbox-thumb:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.photo-lightbox-thumb-active {
  opacity: 1;
  border-color: rgba(249, 250, 251, 0.95);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.9);
}

/* Lightbox transition */
.photo-lightbox-enter-active,
.photo-lightbox-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.photo-lightbox-enter-from,
.photo-lightbox-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@media (max-width: 768px) {
  .photo-lightbox-overlay {
    padding: 12px 10px 18px;
  }

  .photo-lightbox-main {
    gap: 8px;
  }

  .photo-lightbox-nav {
    display: none;
  }

  .photo-lightbox-figure {
    max-height: 60vh;
    border-radius: 18px;
  }

  .photo-lightbox-thumbs {
    margin-top: 10px;
  }
}
</style>