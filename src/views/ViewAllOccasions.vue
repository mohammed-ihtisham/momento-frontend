<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  sessionManager,
  relationshipApi,
  profileApi,
  occasionsApi,
} from "../api";
import FeedbackModal from "../components/FeedbackModal.vue";
import { useFeedbackModal } from "../useFeedbackModal";

const router = useRouter();

// App state
const currentUser = ref<any>(null);
const userProfile = ref<{
  name: string;
  email: string;
  username?: string;
} | null>(null);
const allRelationships = ref<any[]>([]);
// Frontend shape: map backend fields (person, occasionType) into
// name (occasion label) and relationshipName (person name) so the UI
// can stay focused on \"occasion\" and \"person\"
const occasions = ref<
  Array<{
    occasion: any;
    name: string; // maps to backend occasionType
    date: string;
    person: string;
    description?: string;
    relationshipName?: string; // person name, mirrors person
    relationshipType?: string;
  }>
>([]);
const isLoading = ref(true);

// Shared feedback modal for this view
const {
  isFeedbackOpen,
  feedbackTitle,
  feedbackMessage,
  feedbackVariant,
} = useFeedbackModal();

// Modal state
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const deletingOccasion = ref<any>(null);

// Inline error messaging for CRUD modals
const createOccasionError = ref("");
const deleteOccasionError = ref("");

// Form state
const formName = ref("");
const formDate = ref("");
const formDescription = ref("");
const formRelationship = ref<any>(null);
const isSubmitting = ref(false);
const formErrors = ref({
  name: "",
  date: "",
  relationship: "",
});

// Filter and sort state
const selectedPersonFilter = ref<string | null>(null);
const sortBy = ref<"date-asc" | "date-desc" | "name-asc" | "name-desc">(
  "date-asc"
);
const searchQuery = ref("");


// Get unique person names for filter
const relationshipNames = computed(() => {
  const names = new Set<string>();
  occasions.value.forEach((occ) => {
    if (occ.relationshipName || occ.person) {
      names.add(occ.relationshipName || occ.person);
    }
  });
  return Array.from(names).sort();
});

// Filtered and sorted occasions
const filteredOccasions = computed(() => {
  let filtered = [...occasions.value];

  // Filter by person
  if (selectedPersonFilter.value) {
    filtered = filtered.filter(
      (occ) =>
        occ.relationshipName === selectedPersonFilter.value ||
        occ.person === selectedPersonFilter.value
    );
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (occ) =>
        occ.name.toLowerCase().includes(query) ||
        occ.relationshipName?.toLowerCase().includes(query) ||
        occ.person.toLowerCase().includes(query) ||
        occ.description?.toLowerCase().includes(query)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortBy.value === "date-asc") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy.value === "date-desc") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortBy.value === "name-asc") {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

  return filtered;
});


// View mode: 'list' or 'calendar'
const viewMode = ref<"list" | "calendar">("calendar");

// Calendar state
const currentMonth = ref(new Date());
const selectedDate = ref<Date | null>(new Date()); // Auto-select today by default
const occasionsByDate = computed(() => {
  const map: Record<string, typeof occasions.value> = {};
  filteredOccasions.value.forEach((occ) => {
    const dateKey = formatDateForCalendar(new Date(occ.date));
    if (!map[dateKey]) {
      map[dateKey] = [];
    }
    map[dateKey].push(occ);
  });
  return map;
});

// Calendar helper functions
const formatDateForCalendar = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getFirstDayOfMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

const getCalendarDays = (): Array<{ date: Date; isCurrentMonth: boolean; occasions: typeof occasions.value }> => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  const daysInMonth = getDaysInMonth(currentMonth.value);
  const firstDay = getFirstDayOfMonth(currentMonth.value);
  
  const days: Array<{ date: Date; isCurrentMonth: boolean; occasions: typeof occasions.value }> = [];
  
  // Previous month's trailing days
  const prevMonth = new Date(year, month - 1, 0);
  const daysInPrevMonth = prevMonth.getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i);
    const dateKey = formatDateForCalendar(date);
    days.push({
      date,
      isCurrentMonth: false,
      occasions: occasionsByDate.value[dateKey] || [],
    });
  }
  
  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateForCalendar(date);
    days.push({
      date,
      isCurrentMonth: true,
      occasions: occasionsByDate.value[dateKey] || [],
    });
  }
  
  // Next month's leading days (to fill the grid)
  const totalCells = days.length;
  const remainingCells = 42 - totalCells; // 6 weeks * 7 days
  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(year, month + 1, day);
    const dateKey = formatDateForCalendar(date);
    days.push({
      date,
      isCurrentMonth: false,
      occasions: occasionsByDate.value[dateKey] || [],
    });
  }
  
  return days;
};

const navigateMonth = (direction: "prev" | "next") => {
  const newDate = new Date(currentMonth.value);
  if (direction === "prev") {
    newDate.setMonth(newDate.getMonth() - 1);
  } else {
    newDate.setMonth(newDate.getMonth() + 1);
  }
  currentMonth.value = newDate;
};

const goToToday = () => {
  const today = new Date();
  currentMonth.value = today;
  selectedDate.value = today;
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const getOccasionsForDate = (date: Date): typeof occasions.value => {
  const dateKey = formatDateForCalendar(date);
  return occasionsByDate.value[dateKey] || [];
};

// Load relationships
const loadRelationships = async () => {
  if (!currentUser.value) return;

  try {
    const relationshipsData = await relationshipApi.getRelationships(
      currentUser.value
    );
    allRelationships.value = relationshipsData.map((r) => ({
      id: r.relationship?.id || r.name,
      name: r.name,
      relationshipType: r.relationshipType,
      relationship: r.relationship,
    }));
  } catch (error) {
    console.error("Error loading relationships:", error);
    allRelationships.value = [];
  }
};

// Load occasions
const loadOccasions = async () => {
  if (!currentUser.value) return;

  try {
    isLoading.value = true;
    const occasionsData = await occasionsApi.getOccasions(currentUser.value);

    // Enrich with relationship/relationshipType info using Relationships concept.
    // Backend returns: { occasion, person, occasionType, date }
    const enriched = occasionsData.map((occ) => {
      const relationship = allRelationships.value.find(
        (r) => r.name === occ.person
      );

      return {
        ...occ,
        name: occ.occasionType,
        person: occ.person,
        relationshipName: occ.person,
        relationshipType: relationship?.relationshipType || "Unknown",
      };
    });

    occasions.value = enriched;
  } catch (error) {
    console.error("Error loading occasions:", error);
    occasions.value = [];
  } finally {
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


// Navigate to occasion detail
const viewOccasionDetail = (occasion: any) => {
  const occasionId = occasion.occasion?.id || JSON.stringify(occasion.occasion);
  router.push(`/occasion/${occasionId}`);
};


// Open create modal
const openCreateModal = () => {
  formName.value = "";
  formDate.value = "";
  formDescription.value = "";
  formRelationship.value = null;
  showCreateModal.value = true;
};

// Close create modal
const closeCreateModal = () => {
  showCreateModal.value = false;
  formName.value = "";
  formDate.value = "";
  formDescription.value = "";
  formRelationship.value = null;
  formErrors.value = {
    name: "",
    date: "",
    relationship: "",
  };
};


// Helper function to parse date string in local timezone (avoids timezone shift)
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
  formErrors.value = {
    name: "",
    date: "",
    relationship: "",
  };

  // Validate fields
  let hasErrors = false;
  if (!formName.value.trim()) {
    formErrors.value.name = "Please enter an occasion name";
    hasErrors = true;
  }
  if (!formDate.value) {
    formErrors.value.date = "Please select a date";
    hasErrors = true;
  }
  if (!formRelationship.value) {
    formErrors.value.relationship = "Please select a person";
    hasErrors = true;
  }

  if (hasErrors) {
    return;
  }

  try {
    isSubmitting.value = true;
    createOccasionError.value = "";
    await occasionsApi.createOccasion(
      currentUser.value,
      // person name
      formRelationship.value,
      // occasionType
      formName.value.trim(),
      parseLocalDate(formDate.value)
    );
    closeCreateModal();
    await loadOccasions();
  } catch (error: any) {
    console.error("Error creating occasion:", error);
    createOccasionError.value =
      error.message || "Failed to create occasion. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
};


// Open delete confirmation modal
const openDeleteModal = (occasion: any) => {
  deletingOccasion.value = occasion;
  showDeleteModal.value = true;
};

// Close delete modal
const closeDeleteModal = () => {
  showDeleteModal.value = false;
  deletingOccasion.value = null;
};

// Delete occasion (after confirmation)
const handleDeleteOccasion = () => {
  if (!deletingOccasion.value || !currentUser.value) return;

  try {
    deleteOccasionError.value = "";
    
    // Get occasion ID for localStorage cleanup
    const occasionId = deletingOccasion.value.occasion?.id || JSON.stringify(deletingOccasion.value.occasion);
    const ownerId = currentUser.value.id || currentUser.value.username || "";
    
    // Remove from local occasions array
    const occasionToDelete = deletingOccasion.value;
    // Use the same unique key logic as the template (occasion.occasion?.id || occasion.name)
    const deleteKey = occasionToDelete.occasion?.id || occasionToDelete.name;
    occasions.value = occasions.value.filter((occ) => {
      const occKey = occ.occasion?.id || occ.name;
      return occKey !== deleteKey;
    });
    
    // Clean up localStorage entries for this occasion
    if (ownerId) {
      const taskPrioritiesKey = `occasion-tasks-priorities-${occasionId}-${ownerId}`;
      const deletedTasksKey = `occasion-tasks-deleted-${occasionId}-${ownerId}`;
      localStorage.removeItem(taskPrioritiesKey);
      localStorage.removeItem(deletedTasksKey);
    }
    
    closeDeleteModal();
  } catch (error: any) {
    console.error("Error deleting occasion locally:", error);
    deleteOccasionError.value = "Failed to delete occasion locally.";
  }
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper function to normalize date to start of day (midnight) for comparison
const normalizeToDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

// Format time until event
const getTimeUntilEvent = (dateString: string): string => {
  const date = normalizeToDay(new Date(dateString));
  const now = normalizeToDay(new Date());
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
};

// Get date status class
const getDateStatus = (
  dateString: string
): "past" | "today" | "upcoming" | "soon" => {
  const date = normalizeToDay(new Date(dateString));
  const now = normalizeToDay(new Date());
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "upcoming";
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
  await loadOccasions();
});
</script>

<template>
  <div class="view-all-occasions-page">
    <!-- Main Content -->
    <main class="occasions-main">
      <div class="occasions-page-content">
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
              {{ filteredOccasions.length }}
              {{ filteredOccasions.length === 1 ? "occasion" : "occasions" }}
            </p>
          </div>
          <button @click="openCreateModal" class="create-occasion-button">
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
            New Occasion
          </button>
        </div>

        <!-- Filters and Controls -->
        <div class="occasions-controls">
          <!-- Search -->
          <div class="search-wrapper">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="search-icon"
            >
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button
              @click="viewMode = 'calendar'"
              :class="['view-mode-button', { active: viewMode === 'calendar' }]"
              aria-label="Calendar view"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Occasions List -->
        <div v-if="viewMode === 'list'" class="occasions-list-view">
          <div
            v-if="filteredOccasions.length === 0"
            class="empty-state-occasions"
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="empty-icon"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <p class="empty-title">No occasions found</p>
            <p class="empty-text">
              {{
                searchQuery || selectedPersonFilter
                  ? "Try adjusting your filters"
                  : "Create your first occasion to get started!"
              }}
            </p>
            <button
              v-if="!searchQuery && !selectedPersonFilter"
              @click="openCreateModal"
              class="empty-state-button"
            >
              Create Occasion
            </button>
          </div>

          <div v-else class="occasions-grid">
            <div
              v-for="occasion in filteredOccasions"
              :key="occasion.occasion?.id || occasion.name"
              class="occasion-card-detailed"
              :class="`status-${getDateStatus(occasion.date)}`"
              @click="viewOccasionDetail(occasion)"
            >
              <div class="occasion-card-header">
                <div class="occasion-card-title-row">
                  <h3 class="occasion-card-name">{{ occasion.name }}</h3>
                  <div class="occasion-card-actions">
                    <button
                      @click.stop="openDeleteModal(occasion)"
                      class="action-button delete-button"
                      aria-label="Delete occasion"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path
                          d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  class="occasion-card-date-badge"
                  :class="`badge-${getDateStatus(occasion.date)}`"
                >
                  <span class="badge-time">{{
                    getTimeUntilEvent(occasion.date)
                  }}</span>
                  <span class="badge-date">{{
                    formatDate(occasion.date)
                  }}</span>
                </div>
              </div>

              <div class="occasion-card-body">
                <div class="occasion-card-person">
                  <div class="person-avatar">
                    {{
                      occasion.relationshipName?.charAt(0).toUpperCase() || "?"
                    }}
                  </div>
                  <div class="person-info">
                    <span class="person-name">{{
                      occasion.relationshipName || "Unknown"
                    }}</span>
                    <span class="person-type">{{
                      occasion.relationshipType || ""
                    }}</span>
                  </div>
                </div>
                <p
                  v-if="occasion.description"
                  class="occasion-card-description"
                >
                  {{ occasion.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Calendar View -->
        <div v-else class="occasions-calendar-view">
          <div
            v-if="filteredOccasions.length === 0"
            class="empty-state-occasions"
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="empty-icon"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <p class="empty-title">No occasions found</p>
            <p class="empty-text">
              {{
                searchQuery || selectedPersonFilter
                  ? "Try adjusting your filters"
                  : "Create your first occasion to get started!"
              }}
            </p>
            <button
              v-if="!searchQuery && !selectedPersonFilter"
              @click="openCreateModal"
              class="empty-state-button"
            >
              Create Occasion
            </button>
          </div>

          <div v-else class="calendar-wrapper">
            <!-- Left Side: Calendar -->
            <div class="calendar-side">
              <!-- Calendar Header -->
              <div class="calendar-header">
                <div class="calendar-nav">
                  <button @click="navigateMonth('prev')" class="calendar-nav-button" aria-label="Previous month">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <h2 class="calendar-month-year">{{ formatMonthYear(currentMonth) }}</h2>
                  <button @click="navigateMonth('next')" class="calendar-nav-button" aria-label="Next month">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
                <button @click="goToToday" class="calendar-today-button">Today</button>
              </div>

              <!-- Calendar Grid -->
              <div class="calendar-grid">
                <!-- Weekday Headers -->
                <div class="calendar-weekdays">
                  <div class="calendar-weekday">Sun</div>
                  <div class="calendar-weekday">Mon</div>
                  <div class="calendar-weekday">Tue</div>
                  <div class="calendar-weekday">Wed</div>
                  <div class="calendar-weekday">Thu</div>
                  <div class="calendar-weekday">Fri</div>
                  <div class="calendar-weekday">Sat</div>
                </div>

                <!-- Calendar Days -->
                <div class="calendar-days">
                  <div
                    v-for="(day, index) in getCalendarDays()"
                    :key="index"
                    class="calendar-day"
                    :class="{
                      'calendar-day-other-month': !day.isCurrentMonth,
                      'calendar-day-today': isToday(day.date),
                      'calendar-day-selected': selectedDate && formatDateForCalendar(day.date) === formatDateForCalendar(selectedDate),
                      'calendar-day-has-occasions': day.occasions.length > 0,
                    }"
                    @click="selectedDate = day.date"
                  >
                    <div class="calendar-day-number">{{ day.date.getDate() }}</div>
                    <div v-if="day.occasions.length > 0" class="calendar-day-occasions">
                      <div
                        v-for="(occasion, occIndex) in day.occasions.slice(0, 3)"
                        :key="occIndex"
                        class="calendar-occasion-dot"
                        :class="`dot-${getDateStatus(occasion.date)}`"
                        :title="occasion.name"
                      ></div>
                      <div v-if="day.occasions.length > 3" class="calendar-occasion-more">
                        +{{ day.occasions.length - 3 }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Side: Selected Date and Events -->
            <div class="calendar-events-side">
              <div class="calendar-events-container">
                <div class="selected-date-header">
                  <div>
                    <h3 class="selected-date-title">
                      {{ selectedDate ? formatDate(selectedDate.toISOString()) : 'Select a date' }}
                    </h3>
                    <p v-if="selectedDate" class="selected-date-subtitle">
                      {{ getOccasionsForDate(selectedDate).length }}
                      {{ getOccasionsForDate(selectedDate).length === 1 ? 'occasion' : 'occasions' }}
                    </p>
                  </div>
                </div>
                
                <div v-if="!selectedDate" class="selected-date-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <p class="empty-text">Click on a date to view occasions</p>
                </div>
                
                <div v-else-if="getOccasionsForDate(selectedDate).length === 0" class="selected-date-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                  <p class="empty-text">No occasions on this date</p>
                  <button @click="openCreateModal" class="empty-state-button">Create Occasion</button>
                </div>
                
                <div v-else class="selected-date-occasions-list">
                  <div
                    v-for="occasion in getOccasionsForDate(selectedDate)"
                    :key="occasion.occasion?.id || occasion.name"
                    class="selected-occasion-card"
                    :class="`status-${getDateStatus(occasion.date)}`"
                    @click="viewOccasionDetail(occasion)"
                  >
                    <div class="selected-occasion-header">
                      <h4 class="selected-occasion-name">{{ occasion.name }}</h4>
                      <div class="selected-occasion-actions">
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
                    <div class="selected-occasion-person">
                      <div class="person-avatar-small">
                        {{ (occasion.relationshipName || "?").charAt(0).toUpperCase() }}
                      </div>
                      <span class="selected-occasion-person-name">{{ occasion.relationshipName || "Unknown" }}</span>
                    </div>
                    <div class="selected-occasion-time" :class="`badge-${getDateStatus(occasion.date)}`">
                      {{ getTimeUntilEvent(occasion.date) }}
                    </div>
                    <p v-if="occasion.description" class="selected-occasion-description">
                      {{ occasion.description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </main>

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="modal-overlay"
      @click.self="closeCreateModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Create New Occasion</h2>
          <button
            @click="closeCreateModal"
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
                v-model="formName"
                type="text"
                placeholder="e.g., Birthday, Anniversary"
                class="form-input"
                :class="{ 'has-error': formErrors.name }"
                required
                @input="formErrors.name = ''"
              />
              <span v-if="formErrors.name" class="field-error">{{
                formErrors.name
              }}</span>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input
                v-model="formDate"
                type="date"
                class="form-input"
                :class="{ 'has-error': formErrors.date }"
                required
                @input="formErrors.date = ''"
              />
              <span v-if="formErrors.date" class="field-error">{{
                formErrors.date
              }}</span>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Person *</label>
              <select
                v-model="formRelationship"
                class="form-input"
                :class="{ 'has-error': formErrors.relationship }"
                required
                @change="formErrors.relationship = ''"
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
              <span v-if="formErrors.relationship" class="field-error">{{
                formErrors.relationship
              }}</span>
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
          <button @click="closeCreateModal" class="button-secondary">
            Cancel
          </button>
          <button
            @click="handleCreateOccasion"
            class="button-primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Creating..." : "Create Occasion" }}
          </button>
          <p v-if="createOccasionError" class="modal-error-text">
            {{ createOccasionError }}
          </p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteModal"
      class="modal-overlay"
      @click.self="closeDeleteModal"
    >
      <div class="modal-content delete-modal-content">
        <div class="modal-header delete-modal-header-simple">
          <h2 class="modal-title">Delete Occasion</h2>
          <button
            @click="closeDeleteModal"
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
        <div class="modal-body delete-modal-body">
          <div class="delete-modal-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              ></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h3 class="delete-modal-title">Are you sure?</h3>
          <p class="delete-modal-message">
            This will permanently delete
            <strong>"{{ deletingOccasion?.name }}"</strong>. This action cannot
            be undone.
          </p>
        </div>
        <div class="modal-footer delete-modal-footer">
          <button @click="handleDeleteOccasion" class="button-danger">
            Delete Occasion
          </button>
          <p v-if="deleteOccasionError" class="modal-error-text">
            {{ deleteOccasionError }}
          </p>
        </div>
      </div>
    </div>

    <!-- Global feedback modal for this view -->
    <FeedbackModal
      v-model="isFeedbackOpen"
      :title="feedbackTitle"
      :message="feedbackMessage"
      :variant="feedbackVariant"
    />
  </div>
</template>
