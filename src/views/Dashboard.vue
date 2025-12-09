<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
  profileApi,
  sessionManager,
  relationshipApi,
  occasionsApi,
  collaboratorsApi,
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
const occasions = ref<any[]>([]);
const showUserMenu = ref(false);
const isLoadingRelationships = ref(false);

// Invitations inbox (loaded from backend)
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

const pendingInvitationsCount = computed(
  () => invitations.value.filter((i) => i.status === "pending").length
);

// Drag and drop state
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const isDragging = ref(false);
const justDropped = ref(false);

// Create occasion modal state
const showCreateOccasionModal = ref(false);
const occasionFormName = ref("");
const occasionFormDate = ref("");
const occasionFormDescription = ref("");
const occasionFormRelationship = ref<string | null>(null);
const isSubmittingOccasion = ref(false);
const occasionFormErrors = ref({
  name: "",
  date: "",
  relationship: "",
});

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

// Display pinned relationships on dashboard
const displayedRelationships = computed(() => {
  return pinnedRelationships.value;
});

// Check if there are more relationships than pinned (to show "View All" button)
const hasMoreRelationships = computed(() => {
  return allRelationships.value.length > pinnedRelationships.value.length;
});

// Load incoming invitations for the current user from backend
const loadInvitations = async () => {
  try {
    console.log("[Dashboard] Loading incoming invites...");
    const backendInvites = await collaboratorsApi.getIncomingInvites();
    console.log("[Dashboard] Received invites from API:", backendInvites);

    // Resolve sender usernames
    const invitesWithUsernames = await Promise.all(
      (backendInvites || [])
        .filter((inv: any) => inv.status === "pending")
        .map(async (inv: any) => {
          const rawInvite = inv.invite;
          const sender = inv.sender;
          let username = "someone";

          // If sender is a string (user ID), look up the profile
          if (typeof sender === "string") {
            try {
              const profile = await profileApi.getProfile({
                id: sender,
                username: sender,
              });
              username = profile.username || profile.name || sender;
            } catch (error) {
              console.warn(
                "[Dashboard] Failed to look up sender profile:",
                sender,
                error
              );
              username = sender; // Fallback to showing the ID
            }
          } else if (sender?.username) {
            username = sender.username;
          } else if (sender?.name) {
            username = sender.name;
          }

          return {
            id: String(rawInvite?.id ?? rawInvite ?? inv.id ?? ""),
            invitePayload: rawInvite,
            toUsername: username,
            createdAt: inv.createdAt,
            status: "pending" as const,
          };
        })
    );

    invitations.value = invitesWithUsernames;
  } catch (error) {
    console.error("Failed to load collaborator invitations:", error);
    invitations.value = [];
  }
};

const handleAcceptInvite = async (
  invite: (typeof invitations.value)[number]
) => {
  try {
    await collaboratorsApi.acceptInvite(invite.invitePayload ?? invite.id);
    invitations.value = invitations.value.filter((i) => i.id !== invite.id);

    // Reload occasions to show the newly accepted occasion immediately
    if (currentUser.value) {
      try {
        const occasionsData = await occasionsApi.getOccasions(
          currentUser.value
        );

        // Enrich with relationship/relationshipType info
        const enriched = occasionsData.map((occ) => {
          const relationship = allRelationships.value.find(
            (r) => r.name === occ.person
          );

          return {
            ...occ,
            id: occ.occasion?.id || occ.occasionType + occ.person + occ.date,
            name: occ.occasionType,
            relationshipName: occ.person,
            relationshipType: relationship?.relationshipType || "Unknown",
            date: new Date(occ.date),
          };
        });

        occasions.value = enriched;
      } catch (error) {
        console.error(
          "Error reloading occasions after accepting invite:",
          error
        );
      }
    }
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    alert(
      error instanceof Error
        ? error.message
        : "Failed to accept invitation. Please try again."
    );
  }
};

const handleDeclineInvite = async (
  invite: (typeof invitations.value)[number]
) => {
  try {
    await collaboratorsApi.declineInvite(invite.id);
    invitations.value = invitations.value.filter((i) => i.id !== invite.id);
  } catch (error: any) {
    console.error("Error declining invitation:", error);
    alert(
      error instanceof Error
        ? error.message
        : "Failed to decline invitation. Please try again."
    );
  }
};

// Helper function to normalize date to start of day for comparison
const normalizeToDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

// Get upcoming occasions sorted by date (soonest first), limited to 3
const upcomingOccasions = computed(() => {
  const now = normalizeToDay(new Date());

  return occasions.value
    .filter((occ) => {
      const occDate = normalizeToDay(
        occ.date instanceof Date ? occ.date : new Date(occ.date)
      );
      return occDate.getTime() >= now.getTime();
    })
    .sort((a, b) => {
      const dateA = normalizeToDay(
        a.date instanceof Date ? a.date : new Date(a.date)
      );
      const dateB = normalizeToDay(
        b.date instanceof Date ? b.date : new Date(b.date)
      );
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 3);
});

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
      .filter(Boolean);
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

// Load dashboard data
const loadDashboardData = async () => {
  if (!currentUser.value) return;

  try {
    // Load user profile
    try {
      const profile = await profileApi.getProfile(currentUser.value);
      if (profile && profile.name) {
        userProfile.value = profile;
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }

    // Load relationships
    isLoadingRelationships.value = true;
    try {
      const relationshipsData = await relationshipApi.getRelationships(
        currentUser.value
      );
      const mapped = relationshipsData.map((r) => ({
        id: r.relationship?.id || r.name, // Use relationship ID if available, otherwise use name as stable identifier
        name: r.name,
        relationshipType: r.relationshipType,
        relationship: r.relationship,
        avatar: null,
      }));
      allRelationships.value = mapped;
      // Load pinned relationships
      loadPinnedRelationships(mapped);
    } catch (error) {
      console.error("Error loading relationships:", error);
      allRelationships.value = [];
      pinnedRelationships.value = [];
    } finally {
      isLoadingRelationships.value = false;
    }

    // Load occasions
    try {
      const occasionsData = await occasionsApi.getOccasions(currentUser.value);

      // Enrich with relationship/relationshipType info
      const enriched = occasionsData.map((occ) => {
        const relationship = allRelationships.value.find(
          (r) => r.name === occ.person
        );

        return {
          ...occ,
          id: occ.occasion?.id || occ.occasionType + occ.person + occ.date,
          name: occ.occasionType,
          relationshipName: occ.person,
          relationshipType: relationship?.relationshipType || "Unknown",
          date: new Date(occ.date),
        };
      });

      occasions.value = enriched;
    } catch (error) {
      console.error("Error loading occasions:", error);
      occasions.value = [];
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
};

// Logout function
const handleLogout = async () => {
  sessionManager.clearUser();
  currentUser.value = null;
  userProfile.value = null;
  allRelationships.value = [];
  pinnedRelationships.value = [];
  occasions.value = [];
  showUserMenu.value = false;
  // Use replace to ensure navigation and redirect to login page
  router.replace("/");
};

// Format time until event
const getTimeUntilEvent = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const normalizedDate = normalizeToDay(dateObj);
  const now = normalizeToDay(new Date());
  const diff = normalizedDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
};

// Format date
const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Handle add profile
const handleAddProfile = () => {
  router.push("/add-profile");
};

// Handle add occasion - open modal
const handleAddOccasion = () => {
  if (allRelationships.value.length === 0) {
    alert("Please add a profile first before creating an occasion.");
    return;
  }
  occasionFormName.value = "";
  occasionFormDate.value = "";
  occasionFormDescription.value = "";
  occasionFormRelationship.value = null;
  showCreateOccasionModal.value = true;
};

// Close create occasion modal
const closeCreateOccasionModal = () => {
  showCreateOccasionModal.value = false;
  occasionFormName.value = "";
  occasionFormDate.value = "";
  occasionFormDescription.value = "";
  occasionFormRelationship.value = null;
  occasionFormErrors.value = {
    name: "",
    date: "",
    relationship: "",
  };
};

// Helper function to parse date string in local timezone
const parseLocalDate = (dateString: string): Date => {
  const parts = dateString.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  const day = parts[2] || 1;
  return new Date(year, month - 1, day);
};

// Create occasion
const handleCreateOccasion = async () => {
  // Reset errors
  occasionFormErrors.value = {
    name: "",
    date: "",
    relationship: "",
  };

  // Validate fields
  let hasErrors = false;
  if (!occasionFormName.value.trim()) {
    occasionFormErrors.value.name = "Please enter an occasion name";
    hasErrors = true;
  }
  if (!occasionFormDate.value) {
    occasionFormErrors.value.date = "Please select a date";
    hasErrors = true;
  }
  if (!occasionFormRelationship.value) {
    occasionFormErrors.value.relationship = "Please select a person";
    hasErrors = true;
  }

  if (hasErrors) {
    return;
  }

  try {
    isSubmittingOccasion.value = true;
    await occasionsApi.createOccasion(
      currentUser.value,
      occasionFormRelationship.value!,
      occasionFormName.value.trim(),
      parseLocalDate(occasionFormDate.value)
    );
    closeCreateOccasionModal();
    await loadDashboardData();
  } catch (error: any) {
    console.error("Error creating occasion:", error);
    alert(error.message || "Failed to create occasion");
  } finally {
    isSubmittingOccasion.value = false;
  }
};

// Handle view all relationships
const handleViewAllRelationships = () => {
  router.push("/view-all");
};

// Handle view all occasions
const handleViewAllOccasions = () => {
  router.push("/occasions");
};

// Handle relationship card click
const handleRelationshipClick = (relationship: any) => {
  const slug = nameToSlug(relationship.name);
  router.push(`/relationship/${slug}`);
};

// Handle occasion card click
const handleOccasionClick = (occasion: any) => {
  // Use the same ID strategy as the occasions list/detail views
  const occasionId = occasion.occasion?.id || JSON.stringify(occasion.occasion);
  router.push(`/occasion/${occasionId}`);
};

// Drag and drop handlers
const handleDragStart = (index: number, event: DragEvent) => {
  draggedIndex.value = index;
  isDragging.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", index.toString());
  }
  // Add visual feedback with a slight delay
  if (event.target) {
    (event.target as HTMLElement).style.opacity = "0.5";
  }
};

const handleDragEnd = (event: DragEvent) => {
  // Reset opacity
  if (event.target) {
    (event.target as HTMLElement).style.opacity = "1";
  }
  // Use setTimeout to allow drop handler to complete first
  setTimeout(() => {
    if (draggedIndex.value !== null && dragOverIndex.value === null) {
      // If drag ended without dropping, it might have been a click
      // Reset the dragging state
      isDragging.value = false;
    }
    draggedIndex.value = null;
    dragOverIndex.value = null;
  }, 0);
};

const handleDragOver = (index: number, event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  // Only allow drag over within the pinned relationships
  if (
    draggedIndex.value !== null &&
    draggedIndex.value !== index &&
    draggedIndex.value < pinnedRelationships.value.length &&
    index < pinnedRelationships.value.length
  ) {
    dragOverIndex.value = index;
  }
};

const handleDragLeave = () => {
  dragOverIndex.value = null;
};

const handleDrop = (dropIndex: number, event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    dragOverIndex.value = null;
    isDragging.value = false;
    return;
  }

  // Ensure we're only reordering within the pinned relationships
  if (
    draggedIndex.value >= pinnedRelationships.value.length ||
    dropIndex >= pinnedRelationships.value.length
  ) {
    dragOverIndex.value = null;
    isDragging.value = false;
    return;
  }

  // Reorder pinned relationships
  const newPinned = [...pinnedRelationships.value];
  const draggedItem = newPinned[draggedIndex.value];
  newPinned.splice(draggedIndex.value, 1);
  newPinned.splice(dropIndex, 0, draggedItem);

  pinnedRelationships.value = newPinned;
  savePinnedRelationships();

  // Set flag to prevent click navigation
  justDropped.value = true;
  setTimeout(() => {
    justDropped.value = false;
  }, 100);

  // Reset drag state
  draggedIndex.value = null;
  dragOverIndex.value = null;
  isDragging.value = false;
};

const handleCardClick = (relationship: any) => {
  // Only navigate if we're not dragging and didn't just drop
  if (!isDragging.value && !justDropped.value) {
    handleRelationshipClick(relationship);
  }
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

onMounted(async () => {
  const savedUser = sessionManager.getUser();
  if (savedUser) {
    currentUser.value = savedUser;
    await loadInvitations();
    await loadDashboardData();
  } else {
    router.push("/");
  }

  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
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
          <div class="navbar-right">
            <div class="navbar-mail-wrapper">
              <button
                @click.stop="showInvitesMenu = !showInvitesMenu"
                class="navbar-mail-button"
                :aria-expanded="showInvitesMenu"
                aria-label="Collaboration invitations"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <polyline points="3 7 12 13 21 7" />
                </svg>
                <span
                  v-if="pendingInvitationsCount > 0"
                  class="navbar-mail-badge"
                >
                  {{ pendingInvitationsCount }}
                </span>
              </button>
              <div
                v-if="showInvitesMenu"
                class="navbar-mail-dropdown"
                @click.stop
              >
                <div class="navbar-mail-header">Invitations</div>
                <div v-if="!invitations.length" class="navbar-mail-empty">
                  No invitations yet.
                </div>
                <div v-else class="navbar-mail-list">
                  <div
                    v-for="invite in invitations"
                    :key="invite.id"
                    class="navbar-mail-item"
                  >
                    <div class="navbar-mail-line">
                      <span class="navbar-mail-username">
                        @{{ invite.toUsername }}
                      </span>
                      <span
                        class="navbar-mail-status"
                        :class="[
                          invite.status === 'pending' && 'status-pending',
                          invite.status === 'accepted' && 'status-accepted',
                          invite.status === 'error' && 'status-error',
                        ]"
                      >
                        {{
                          invite.status === "pending"
                            ? "Pending"
                            : invite.status === "accepted"
                            ? "Accepted"
                            : "Error"
                        }}
                      </span>
                    </div>
                    <div class="navbar-mail-date">
                      {{ new Date(invite.createdAt).toLocaleDateString() }}
                    </div>
                    <div class="navbar-mail-actions">
                      <button
                        class="navbar-mail-action-accept"
                        @click="handleAcceptInvite(invite)"
                      >
                        Accept
                      </button>
                      <button
                        class="navbar-mail-action-decline"
                        @click="handleDeclineInvite(invite)"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                <button
                  class="menu-item menu-item-danger"
                  @click="handleLogout"
                >
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
      <main class="dashboard-main">
        <div class="dashboard-content">
          <!-- Your People Section -->
          <section class="dashboard-section">
            <div class="section-header">
              <div class="section-header-content">
                <h2 class="section-title">Pinned Relationships</h2>
                <p
                  v-if="
                    allRelationships.length === 0 && !isLoadingRelationships
                  "
                  class="section-subtitle"
                >
                  No relationships yet. Add your first person!
                </p>
                <p
                  v-if="pinnedRelationships.length > 0 && hasMoreRelationships"
                  class="section-subtitle"
                >
                  Showing {{ pinnedRelationships.length }} pinned of
                  {{ allRelationships.length }} people
                </p>
                <p
                  v-else-if="
                    pinnedRelationships.length === 0 &&
                    allRelationships.length > 0
                  "
                  class="section-subtitle"
                >
                  Pin relationships to see them here
                </p>
              </div>
              <button
                v-if="hasMoreRelationships || pinnedRelationships.length > 0"
                @click="handleViewAllRelationships"
                class="section-action"
              >
                View All →
              </button>
            </div>
            <div class="relationships-carousel">
              <div class="relationships-scroll">
                <div
                  v-for="(relationship, displayIndex) in displayedRelationships"
                  :key="relationship.id"
                  :draggable="true"
                  @dragstart="handleDragStart(displayIndex, $event)"
                  @dragend="handleDragEnd($event)"
                  @dragover="handleDragOver(displayIndex, $event)"
                  @dragleave="handleDragLeave"
                  @drop="handleDrop(displayIndex, $event)"
                  @click="handleCardClick(relationship)"
                  class="relationship-card"
                  :class="{
                    dragging: draggedIndex === displayIndex,
                    'drag-over':
                      dragOverIndex === displayIndex &&
                      draggedIndex !== displayIndex,
                  }"
                >
                  <div class="relationship-avatar">
                    <span
                      v-if="!relationship.avatar"
                      class="avatar-placeholder"
                    >
                      {{ relationship.name.charAt(0).toUpperCase() }}
                    </span>
                    <img
                      v-else
                      :src="relationship.avatar"
                      :alt="relationship.name"
                    />
                  </div>
                  <div class="relationship-name">{{ relationship.name }}</div>
                  <div class="relationship-type">
                    {{ relationship.relationshipType }}
                  </div>
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
                v-for="occasion in upcomingOccasions"
                :key="occasion.id"
                @click="handleOccasionClick(occasion)"
                class="occasion-card"
              >
                <div class="occasion-main">
                  <div class="occasion-info">
                    <div class="occasion-header-row">
                      <h3 class="occasion-name">{{ occasion.name }}</h3>
                    </div>
                    <div class="occasion-meta">
                      <span class="occasion-time">{{
                        getTimeUntilEvent(occasion.date)
                      }}</span>
                      <span class="occasion-date">{{
                        formatDate(occasion.date)
                      }}</span>
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
              <div
                v-if="upcomingOccasions.length < 3"
                @click="handleAddOccasion"
                class="occasion-card add-occasion-card"
              >
                <div class="add-occasion-content">
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
                  <span>Add Occasion</span>
                </div>
              </div>
              <div v-if="upcomingOccasions.length === 0" class="empty-state">
                <p>
                  No upcoming occasions. Add one to stay on top of important
                  dates!
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- Create Occasion Modal -->
    <div
      v-if="showCreateOccasionModal"
      class="modal-overlay"
      @click.self="closeCreateOccasionModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Create New Occasion</h2>
          <button
            @click="closeCreateOccasionModal"
            class="modal-close"
            aria-label="Close"
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
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Occasion Name *</label>
              <input
                v-model="occasionFormName"
                type="text"
                placeholder="e.g., Birthday, Anniversary"
                class="form-input"
                :class="{ 'has-error': occasionFormErrors.name }"
                required
                @input="occasionFormErrors.name = ''"
              />
              <span v-if="occasionFormErrors.name" class="field-error">{{
                occasionFormErrors.name
              }}</span>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input
                v-model="occasionFormDate"
                type="date"
                class="form-input"
                :class="{ 'has-error': occasionFormErrors.date }"
                required
                @input="occasionFormErrors.date = ''"
              />
              <span v-if="occasionFormErrors.date" class="field-error">{{
                occasionFormErrors.date
              }}</span>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Person *</label>
              <select
                v-model="occasionFormRelationship"
                class="form-input"
                :class="{ 'has-error': occasionFormErrors.relationship }"
                required
                @change="occasionFormErrors.relationship = ''"
              >
                <option :value="null">Select a person</option>
                <option
                  v-for="relationship in allRelationships"
                  :key="relationship.id"
                  :value="relationship.name"
                >
                  {{ relationship.name }} ({{ relationship.relationshipType }})
                </option>
              </select>
              <span
                v-if="occasionFormErrors.relationship"
                class="field-error"
                >{{ occasionFormErrors.relationship }}</span
              >
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Description (Optional)</label>
              <textarea
                v-model="occasionFormDescription"
                placeholder="Add any notes or details..."
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCreateOccasionModal" class="button-secondary">
            Cancel
          </button>
          <button
            @click="handleCreateOccasion"
            class="button-primary"
            :disabled="isSubmittingOccasion"
          >
            {{ isSubmittingOccasion ? "Creating..." : "Create Occasion" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
