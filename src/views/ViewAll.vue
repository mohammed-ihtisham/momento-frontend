<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  sessionManager,
  relationshipApi,
  profileApi,
  // collaboratorsApi,
} from "../api";
import { nameToSlug } from "../utils";

const router = useRouter();

// App state
const currentUser = ref<any>(null);
const userProfile = ref<{
  name: string;
  email: string;
  username?: string;
} | null>(null);
const allRelationships = ref<any[]>([]);
const pinnedRelationships = ref<any[]>([]);
const isLoading = ref(true);

// Drag and drop state
const draggedItem = ref<{
  item: any;
  source: "pinned" | "all";
  index: number;
} | null>(null);
const dragOverIndex = ref<number | null>(null);
const dragOverContainer = ref<"pinned" | "all" | null>(null);
const isDragging = ref(false);
const justDropped = ref(false);

const MAX_PINNED = 7;


// const handleAcceptInvite = async (
//   invite: (typeof invitations.value)[number]
// ) => {
//   try {
//     await collaboratorsApi.acceptInvite(invite.invitePayload ?? invite.id);
//     invitations.value = invitations.value.filter((i) => i.id !== invite.id);
//   } catch (error: any) {
//     console.error("Error accepting invitation:", error);
//     alert(
//       error instanceof Error
//         ? error.message
//         : "Failed to accept invitation. Please try again."
//     );
//   }
// };

// const handleDeclineInvite = async (
//   invite: (typeof invitations.value)[number]
// ) => {
//   try {
//     await collaboratorsApi.declineInvite(invite.id);
//     invitations.value = invitations.value.filter((i) => i.id !== invite.id);
//   } catch (error: any) {
//     console.error("Error declining invitation:", error);
//     alert(
//       error instanceof Error
//         ? error.message
//         : "Failed to decline invitation. Please try again."
//     );
//   }
// };

// Get all relationships that are not pinned
const unpinnedRelationships = computed(() => {
  const pinnedIds = new Set(pinnedRelationships.value.map((r) => r.id));
  return allRelationships.value.filter((r) => !pinnedIds.has(r.id));
});

// Check if can add to pinned
const canAddToPinned = computed(() => {
  return pinnedRelationships.value.length < MAX_PINNED;
});

// Load relationships
const loadRelationships = async () => {
  if (!currentUser.value) return;

  try {
    const relationshipsData = await relationshipApi.getRelationships(
      currentUser.value
    );
    const mapped = relationshipsData.map((r) => ({
      id: r.relationship?.id || r.name,
      name: r.name,
      relationshipType: r.relationshipType,
      relationship: r.relationship,
      avatar: null,
    }));

    allRelationships.value = mapped;

    // Load pinned relationships from localStorage
    loadPinnedRelationships(mapped);

    isLoading.value = false;
  } catch (error) {
    console.error("Error loading relationships:", error);
    allRelationships.value = [];
    isLoading.value = false;
  }
};

// Load pinned relationships from localStorage
const loadPinnedRelationships = (relationships: any[]) => {
  if (!currentUser.value) return;

  const pinnedKey = `momento_pinned_${
    currentUser.value.id || currentUser.value.username
  }`;
  const savedPinned = localStorage.getItem(pinnedKey);

  if (!savedPinned) {
    pinnedRelationships.value = [];
    return;
  }

  try {
    const pinnedIds = JSON.parse(savedPinned) as string[];
    const relationshipMap = new Map(relationships.map((r) => [r.id, r]));
    pinnedRelationships.value = pinnedIds
      .map((id) => relationshipMap.get(id))
      .filter(Boolean)
      .slice(0, MAX_PINNED); // Ensure max 7
  } catch (error) {
    console.error("Error loading pinned relationships:", error);
    pinnedRelationships.value = [];
  }
};

// Save pinned relationships to localStorage
const savePinnedRelationships = () => {
  if (!currentUser.value) return;

  const pinnedKey = `momento_pinned_${
    currentUser.value.id || currentUser.value.username
  }`;
  const pinnedIds = pinnedRelationships.value.map((r) => r.id);
  localStorage.setItem(pinnedKey, JSON.stringify(pinnedIds));
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

// Drag and drop handlers
const handleDragStart = (
  item: any,
  source: "pinned" | "all",
  index: number,
  event: DragEvent
) => {
  draggedItem.value = { item, source, index };
  isDragging.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "");
  }
  if (event.target) {
    (event.target as HTMLElement).style.opacity = "0.5";
  }
};

const handleDragEnd = (event: DragEvent) => {
  if (event.target) {
    (event.target as HTMLElement).style.opacity = "1";
  }
  setTimeout(() => {
    draggedItem.value = null;
    dragOverIndex.value = null;
    dragOverContainer.value = null;
    isDragging.value = false;
  }, 0);
};

const handleDragOver = (
  container: "pinned" | "all",
  index: number,
  event: DragEvent
) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOverContainer.value = container;
  dragOverIndex.value = index;
};

const handleDragLeave = () => {
  dragOverIndex.value = null;
  dragOverContainer.value = null;
};

const handleDrop = (
  targetContainer: "pinned" | "all",
  targetIndex: number,
  event: DragEvent
) => {
  event.preventDefault();
  event.stopPropagation();

  if (!draggedItem.value) {
    dragOverIndex.value = null;
    dragOverContainer.value = null;
    isDragging.value = false;
    return;
  }

  const { item, source, index: sourceIndex } = draggedItem.value;

  // If dropping in the same position, do nothing
  if (source === targetContainer && sourceIndex === targetIndex) {
    dragOverIndex.value = null;
    dragOverContainer.value = null;
    isDragging.value = false;
    return;
  }

  // Handle moving within pinned
  if (source === "pinned" && targetContainer === "pinned") {
    const newPinned = [...pinnedRelationships.value];
    newPinned.splice(sourceIndex, 1);
    newPinned.splice(targetIndex, 0, item);
    pinnedRelationships.value = newPinned;
    savePinnedRelationships();
  }
  // Handle moving within all relationships
  else if (source === "all" && targetContainer === "all") {
    const newAll = [...unpinnedRelationships.value];
    newAll.splice(sourceIndex, 1);
    newAll.splice(targetIndex, 0, item);
    // Update allRelationships to reflect new order
    allRelationships.value = [...pinnedRelationships.value, ...newAll];
  }
  // Handle moving from pinned to all (drop at end of all relationships)
  else if (source === "pinned" && targetContainer === "all") {
    const newPinned = [...pinnedRelationships.value];
    newPinned.splice(sourceIndex, 1);
    pinnedRelationships.value = newPinned;
    savePinnedRelationships();
    // Item is automatically removed from pinned and will appear in all relationships
  }
  // Handle moving from all to pinned
  else if (source === "all" && targetContainer === "pinned") {
    if (canAddToPinned.value) {
      const newPinned = [...pinnedRelationships.value];
      // Clamp targetIndex to valid range
      const clampedIndex = Math.min(targetIndex, newPinned.length);
      newPinned.splice(clampedIndex, 0, item);
      pinnedRelationships.value = newPinned;
      savePinnedRelationships();
    }
  }

  justDropped.value = true;
  setTimeout(() => {
    justDropped.value = false;
  }, 100);

  draggedItem.value = null;
  dragOverIndex.value = null;
  dragOverContainer.value = null;
  isDragging.value = false;
};

const handleCardClick = (relationship: any) => {
  if (!isDragging.value && !justDropped.value) {
    const slug = nameToSlug(relationship.name);
    router.push(`/relationship/${slug}`);
  }
};

const handleAddProfile = () => {
  router.push("/add-profile");
};

onMounted(async () => {
  const savedUser = sessionManager.getUser();
  if (!savedUser) {
    router.push("/");
    return;
  }

  currentUser.value = savedUser;
  await loadUserProfile();
  await loadRelationships();
});
</script>

<template>
  <div class="view-all-page">
    <!-- Main Content -->
    <main class="view-all-main">
      <div v-if="isLoading" class="loading-state-full">
        <div class="spinner-large"></div>
        <p>Loading relationships...</p>
      </div>

      <div v-else class="view-all-container">
        <!-- Pinned Relationships Section -->
        <section class="pinned-section">
          <h2 class="section-title-view-all">Pinned Relationships</h2>
          <div class="relationships-grid">
            <div
              v-for="(relationship, index) in pinnedRelationships"
              :key="relationship.id"
              :draggable="true"
              @dragstart="
                handleDragStart(relationship, 'pinned', index, $event)
              "
              @dragend="handleDragEnd($event)"
              @dragover="handleDragOver('pinned', index, $event)"
              @dragleave="handleDragLeave"
              @drop="handleDrop('pinned', index, $event)"
              @click="handleCardClick(relationship)"
              class="relationship-card-view-all"
              :class="{
                dragging:
                  draggedItem?.source === 'pinned' &&
                  draggedItem?.index === index,
                'drag-over':
                  (dragOverContainer === 'pinned' &&
                    dragOverIndex === index &&
                    draggedItem?.source !== 'pinned') ||
                  (draggedItem?.source === 'pinned' &&
                    draggedItem?.index !== index &&
                    dragOverIndex === index),
              }"
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
              <div class="relationship-icon-wrapper">
                <svg
                  v-if="relationship.relationshipType === 'Family'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  ></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Friend'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Romantic'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  ></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Colleague'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <path d="M20 8v6"></path>
                  <path d="M23 11h-6"></path>
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6"></path>
                  <path d="M12 16h.01"></path>
                </svg>
              </div>
              <div class="relationship-name">{{ relationship.name }}</div>
              <div class="relationship-type">
                {{ relationship.relationshipType }}
              </div>
            </div>

            <!-- Static Info Card (always last) -->
            <div
              class="relationship-card-view-all info-card"
              :class="{
                hidden: pinnedRelationships.length >= MAX_PINNED,
                'drag-over':
                  canAddToPinned && draggedItem && draggedItem.source === 'all',
              }"
              @dragover.prevent="
                handleDragOver('pinned', pinnedRelationships.length, $event)
              "
              @drop.prevent="
                handleDrop('pinned', pinnedRelationships.length, $event)
              "
            >
              <div class="info-icon-wrapper-large">
                <svg
                  v-if="
                    canAddToPinned &&
                    draggedItem &&
                    draggedItem.source === 'all'
                  "
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="info-icon"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <svg
                  v-else
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="info-icon"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  ></path>
                </svg>
              </div>
              <div class="info-title">
                {{
                  canAddToPinned && draggedItem && draggedItem.source === "all"
                    ? "Drop here to pin"
                    : "Drag to Organize"
                }}
              </div>
              <div class="info-text">
                {{
                  canAddToPinned && draggedItem && draggedItem.source === "all"
                    ? "Release to add this relationship to pinned"
                    : "Drag cards to reorder pinned relationships."
                }}
              </div>
            </div>
          </div>
        </section>

        <!-- All Relationships Section -->
        <section class="all-relationships-section">
          <h2 class="section-title-view-all">All Relationships</h2>
          <div class="relationships-grid">
            <!-- Add Relationship Card (first card) -->
            <div
              @click="handleAddProfile"
              class="relationship-card-view-all add-card"
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

            <div
              v-for="(relationship, index) in unpinnedRelationships"
              :key="relationship.id"
              :draggable="true"
              @dragstart="handleDragStart(relationship, 'all', index, $event)"
              @dragend="handleDragEnd($event)"
              @dragover="handleDragOver('all', index, $event)"
              @dragleave="handleDragLeave"
              @drop="handleDrop('all', index, $event)"
              @click="handleCardClick(relationship)"
              class="relationship-card-view-all"
              :class="{
                dragging:
                  draggedItem?.source === 'all' && draggedItem?.index === index,
                'drag-over':
                  (dragOverContainer === 'all' &&
                    dragOverIndex === index &&
                    draggedItem?.source !== 'all') ||
                  (draggedItem?.source === 'all' &&
                    draggedItem?.index !== index &&
                    dragOverIndex === index),
              }"
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
              <div class="relationship-icon-wrapper">
                <svg
                  v-if="relationship.relationshipType === 'Family'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  ></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Friend'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Romantic'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  ></path>
                </svg>
                <svg
                  v-else-if="relationship.relationshipType === 'Colleague'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <path d="M20 8v6"></path>
                  <path d="M23 11h-6"></path>
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="relationship-type-icon"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6"></path>
                  <path d="M12 16h.01"></path>
                </svg>
              </div>
              <div class="relationship-name">{{ relationship.name }}</div>
              <div class="relationship-type">
                {{ relationship.relationshipType }}
              </div>
            </div>
            <div
              v-if="unpinnedRelationships.length === 0"
              class="empty-state-view-all"
            >
              <p>No other relationships. All relationships are pinned!</p>
            </div>

            <!-- Drop zone for empty space in all relationships -->
            <div
              v-if="draggedItem && draggedItem.source === 'pinned'"
              class="relationship-card-view-all drop-zone"
              @dragover.prevent="
                handleDragOver('all', unpinnedRelationships.length, $event)
              "
              @drop.prevent="
                handleDrop('all', unpinnedRelationships.length, $event)
              "
              :class="{
                'drag-over':
                  dragOverContainer === 'all' &&
                  dragOverIndex === unpinnedRelationships.length,
              }"
            >
              <div class="drop-zone-content">
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
                <span>Drop here to unpin</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
