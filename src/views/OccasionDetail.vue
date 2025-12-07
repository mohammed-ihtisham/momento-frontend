<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  sessionManager,
  occasionsApi,
  profileApi,
  relationshipApi,
  notesApi,
  tasksApi,
  taskChecklistApi,
  collaboratorsApi,
  suggestionEngineApi,
} from "../api";

const router = useRouter();
const route = useRoute();

// App state
const currentUser = ref<any>(null);
const userProfile = ref<{
  name: string;
  email: string;
  username?: string;
} | null>(null);
const occasion = ref<any>(null);
const isLoading = ref(true);
const showUserMenu = ref(false);

// Invitations dropdown (reuses same storage key as navbar on other pages)
const showInvitesMenu = ref(false);

// Event details
const eventName = ref("");
const eventDate = ref("");
const isEditingEventName = ref(false);
const showEditEventModal = ref(false);
const editEventName = ref("");
const editEventDate = ref("");
const editEventDescription = ref("");
const editEventPerson = ref<any>(null);
const isUpdatingEvent = ref(false);

// Relationship context (person for this occasion)
const allRelationships = ref<any[]>([]);
const relationship = ref<any | null>(null);
const relationshipName = ref<string | null>(null);

// Collaborators (backed by CollaboratorsConcept + invite workflow)
const collaborators = ref<
  Array<{
    id: string;
    name: string;
    initial: string;
    status: "accepted" | "pending";
  }>
>([]);
const showInviteModal = ref(false);
const newCollaboratorUsername = ref("");

// Store occasion owner info for collaborator view
const occasionOwnerId = ref<string | null>(null);
const isCurrentUserOwner = ref<boolean>(false);

// Incoming invitations for the current user (inbox-style)
type InvitationStatus = "pending" | "accepted" | "error";
interface Invitation {
  id: string;
  invitePayload?: any;
  toUsername: string;
  senderId?: any;
  occasionId?: any;
  createdAt: string;
  status: InvitationStatus;
  errorMessage?: string;
}

const invitations = ref<Invitation[]>([]);

const pendingInvitationsCount = computed(
  () => invitations.value.filter((i) => i.status === "pending").length
);

// Load incoming invites for the current user from backend
const loadIncomingInvitations = async () => {
  try {
    const backendInvites = await collaboratorsApi.getIncomingInvites();
    // Only show pending invites in the inbox
    invitations.value = (backendInvites || [])
      .filter((inv: any) => inv.status === "pending")
      .map((inv: any) => {
        const rawInvite = inv.invite;
        const sender = inv.sender;
        // Try to get username from sender - it might be an ID or user object
        let username = "someone";
        if (typeof sender === "string") {
          username = sender;
        } else if (sender?.username) {
          username = sender.username;
        } else if (sender?.name) {
          username = sender.name;
        }

        return {
          id: String(rawInvite?.id ?? rawInvite ?? inv.id ?? ""),
          invitePayload: rawInvite,
          toUsername: username,
          senderId: sender,
          occasionId: inv.occasionId,
          createdAt: inv.createdAt,
          status: "pending" as InvitationStatus,
        };
      });
  } catch (error) {
    console.error(
      "Failed to load collaborator invitations from backend:",
      error
    );
    invitations.value = [];
  }
};

// Load invites on demand (when mail icon is clicked)
const loadInvitesOnDemand = async () => {
  try {
    // Load incoming invites
    await loadIncomingInvitations();

    // Load sent invites and update collaborators list
    if (occasion.value?.occasion) {
      await loadOccasionCollaborators(occasion.value.occasion, true);
    }
  } catch (error) {
    console.error("Error loading invites on demand:", error);
  }
};

// Handle accepting an invitation
const handleAcceptInvite = async (invite: Invitation) => {
  try {
    await collaboratorsApi.acceptInvite(invite.invitePayload ?? invite.id);
    invitations.value = invitations.value.filter((i) => i.id !== invite.id);
    // Reload collaborators to show the newly accepted user (include sent invites)
    if (occasion.value?.occasion) {
      await loadOccasionCollaborators(occasion.value.occasion, true);
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

// Handle declining an invitation
const handleDeclineInvite = async (invite: Invitation) => {
  try {
    await collaboratorsApi.declineInvite(invite.invitePayload ?? invite.id);
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

// Planning Checklist
const tasks = ref<
  Array<{
    id: string;
    name: string;
    completed: boolean;
    priority: "low" | "medium" | "high";
    assignees: Array<{ id: string; name: string; initial: string }>;
    isEditing?: boolean;
  }>
>([]);
const showAddTask = ref(false);
const newTaskName = ref("");
const newTaskPriority = ref<"low" | "medium" | "high">("medium");

// Shared Notes
const notes = ref<
  Array<{
    id: string;
    content: string;
    assignees: Array<{ id: string; name: string; initial: string }>;
    source: "relationship" | "occasion";
    createdBy: string;
    title?: string;
    noteRef?: any;
    isEditing?: boolean;
    editingContent?: string;
  }>
>([]);
const occasionNotesStorageKey = ref<string | null>(null);
const newNoteTitle = ref("");
const newNoteContent = ref("");

// Helper to build a stable storage key for this user's occasion notes
// Uses the occasion route ID (string) so it stays stable across reloads.
const buildOccasionNotesStorageKey = (
  user: any,
  occasionRouteId: string | string[]
) => {
  const userPart = user?.id || user?.username || "unknown";
  const occasionPart = Array.isArray(occasionRouteId)
    ? occasionRouteId.join("_")
    : occasionRouteId || "unknown_occasion";
  return `momento_occasion_notes_${userPart}_${occasionPart}`;
};

// Persist which backend notes are attached to this occasion's Shared Notes
const persistOccasionNotesSelection = () => {
  if (!occasionNotesStorageKey.value) return;
  try {
    const payload = notes.value.map((n) => ({
      noteId: n.noteRef?.id || null,
      title: n.title || null,
      source: n.source,
    }));
    localStorage.setItem(
      occasionNotesStorageKey.value,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error("Failed to persist occasion shared notes selection:", error);
  }
};

// Occasion note creation modal state
const showNoteModal = ref(false);
const isCreatingOccasionNote = ref(false);

// No notes modal state
const showNoNotesModal = ref(false);

// Existing notes on this person (from Relationship notes)
const relationshipNotes = ref<
  Array<{
    note: any;
    title: string;
    content: string;
  }>
>([]);
const isLoadingRelationshipNotes = ref(false);
const showImportNotes = ref(false);

// Only show relationship notes that haven't already been attached
// to this occasion's Shared Notes list (regardless of how they were added).
const availableRelationshipNotes = computed(() =>
  relationshipNotes.value.filter((relNote) => {
    const relNoteId = relNote.note?.id;
    const relTitle = relNote.title;

    return !notes.value.some((n) => {
      const noteId = n.noteRef?.id;
      const noteTitle = n.title;

      if (noteId && relNoteId) {
        return noteId === relNoteId;
      }

      // Fallback: match by title when IDs are missing
      if (noteTitle && relTitle) {
        return noteTitle === relTitle;
      }

      return false;
    });
  })
);

// Suggestions
const suggestions = ref<string[]>([]);
const isLoadingSuggestions = ref(false);

// Get user's first name
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

// Calculate remaining days
const remainingDays = computed(() => {
  if (!eventDate.value) return 0;
  const date = new Date(eventDate.value);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days;
});

const daysText = computed(() => {
  const days = remainingDays.value;
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
});

// Checklist / notes stats (for task‑manager style overview)
const totalTasks = computed(() => tasks.value.length);
const completedTasks = computed(
  () => tasks.value.filter((t) => t.completed).length
);
const pendingTasks = computed(() =>
  Math.max(totalTasks.value - completedTasks.value, 0)
);
const highPriorityOpenTasks = computed(
  () => tasks.value.filter((t) => t.priority === "high" && !t.completed).length
);
const notesCount = computed(() => notes.value.length);

// Open Edit Event modal, pre‑filling current values (mirrors the create/edit
// occasion modal used in the All Occasions view)
const openEditEventModal = () => {
  if (!occasion.value) return;

  editEventName.value = eventName.value;
  editEventPerson.value = relationshipName.value;
  editEventDescription.value = (occasion.value as any)?.description || "";

  if (eventDate.value) {
    const date = new Date(eventDate.value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    editEventDate.value = `${year}-${month}-${day}`;
  } else {
    editEventDate.value = "";
  }

  showEditEventModal.value = true;
};

// Persist event updates to backend
const handleUpdateEvent = async () => {
  if (!occasion.value) return;

  const name = editEventName.value.trim();
  const dateStr = editEventDate.value;
  const person = editEventPerson.value;
  const description = editEventDescription.value.trim();

  if (!name || !dateStr || !person) return;

  isUpdatingEvent.value = true;
  try {
    const newDate = new Date(dateStr);

    await occasionsApi.updateOccasion(
      occasion.value.occasion,
      // person (name of relationship)
      person,
      name,
      newDate
    );

    // Update local state to reflect saved changes
    eventName.value = name;
    eventDate.value = newDate.toISOString();
    relationshipName.value = person;
    occasion.value.person = person;
    (occasion.value as any).description = description;
    showEditEventModal.value = false;
  } catch (error) {
    console.error("Error updating event details:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update event. Please try again.";
    alert(message);
  } finally {
    isUpdatingEvent.value = false;
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

// Load occasion details
const loadOccasion = async () => {
  if (!currentUser.value || !route.params.id) return;

  try {
    isLoading.value = true;
    
    // Get occasion details including owner
    const occasionId = route.params.id;
    let occasionDetails: { owner: string; person: string; occasionType: string; date: string } | null = null;
    let isOwner = false;
    let ownerId: string | null = null;
    
    // First, get all occasions to find the occasion
    const allOccasions = await occasionsApi.getOccasions(currentUser.value);
    const found = allOccasions.find(
      (occ) =>
        occ.occasion?.id === occasionId ||
        JSON.stringify(occ.occasion) === occasionId
    );
    
    // Try to get occasion details from API (this includes owner)
    try {
      occasionDetails = await occasionsApi.getOccasion(occasionId);
      console.log("[loadOccasion] Occasion details from API:", occasionDetails);
    } catch (error) {
      console.error("[loadOccasion] Error getting occasion details:", error);
    }
    
    // Determine owner and user role
    const currentUserId = typeof currentUser.value === "string" 
      ? currentUser.value 
      : currentUser.value?.id || currentUser.value?.username || currentUser.value;
    
    if (occasionDetails && occasionDetails.owner) {
      isOwner = occasionDetails.owner === currentUserId;
      ownerId = occasionDetails.owner;
      
      console.log("[loadOccasion] Occasion owner:", ownerId);
      console.log("[loadOccasion] Current user:", currentUserId);
      console.log("[loadOccasion] Is owner:", isOwner);
    } else {
      // Fallback: If getOccasion failed, try to determine owner from incoming invites
      // The sender of an invite for this occasion should be the owner
      console.warn("[loadOccasion] getOccasion returned null or no owner, trying to determine owner from invites");
      
      try {
        // Try to get owner from incoming invites (pending or accepted)
        const incomingInvites = await collaboratorsApi.getIncomingInvites();
        const inviteForThisOccasion = (incomingInvites || []).find(
          (inv: any) => {
            const invOccasionId = inv.occasionId?.id || inv.occasionId?.occasion || inv.occasionId;
            return String(invOccasionId) === String(occasionId);
          }
        );
        
        if (inviteForThisOccasion && inviteForThisOccasion.sender) {
          // Found an invite - the sender is the owner
          ownerId = typeof inviteForThisOccasion.sender === "string"
            ? inviteForThisOccasion.sender
            : inviteForThisOccasion.sender?.id || inviteForThisOccasion.sender?.username || inviteForThisOccasion.sender;
          isOwner = ownerId === currentUserId;
          console.log("[loadOccasion] Found owner from incoming invite sender:", ownerId);
        } else {
          // Try sent invites - if user sent an invite for this occasion, they are the owner
          try {
            const sentInvites = await collaboratorsApi.getSentInvites();
            const sentInviteForOccasion = (sentInvites || []).find(
              (inv: any) => {
                const invOccasionId = inv.occasionId?.id || inv.occasionId?.occasion || inv.occasionId;
                return String(invOccasionId) === String(occasionId);
              }
            );
            
            if (sentInviteForOccasion) {
              // User sent an invite, so they are the owner
              isOwner = true;
              ownerId = currentUserId;
              console.log("[loadOccasion] Found owner from sent invite - user is owner");
            } else {
              // No invite found - check if user is a collaborator by checking collaborators list
              console.warn("[loadOccasion] No invite found, checking if user is collaborator");
              
              const collaborators = await collaboratorsApi.getCollaboratorsForOccasion(occasionId);
              const isCollaborator = (collaborators || []).some(
                (c: any) => {
                  const cId = c.id || c._id || c.user || c;
                  return String(cId) === String(currentUserId);
                }
              );
              
              if (isCollaborator) {
                // User is a collaborator, so they're not the owner
                // Try to get owner from the invite - the sender of the invite is the owner
                console.warn("[loadOccasion] User is a collaborator, trying to get owner from invite");
                
                // Get all incoming invites to find the one for this occasion
                const allIncomingInvites = await collaboratorsApi.getIncomingInvites();
                const inviteForOccasion = (allIncomingInvites || []).find(
                  (inv: any) => {
                    const invOccasionId = inv.occasionId?.id || inv.occasionId?.occasion || inv.occasionId;
                    return String(invOccasionId) === String(occasionId);
                  }
                );
                
                if (inviteForOccasion && inviteForOccasion.sender) {
                  ownerId = typeof inviteForOccasion.sender === "string"
                    ? inviteForOccasion.sender
                    : inviteForOccasion.sender?.id || inviteForOccasion.sender?.username || inviteForOccasion.sender;
                  isOwner = false;
                  console.log("[loadOccasion] Found owner from invite sender:", ownerId);
                } else {
                  console.error("[loadOccasion] Cannot determine owner - tasks/notes may not load correctly");
                  isOwner = false;
                  ownerId = null;
                }
              } else {
                // User is not a collaborator, so they must be the owner
                isOwner = true;
                ownerId = currentUserId;
                console.log("[loadOccasion] User appears to be owner (not in collaborators list)");
              }
            }
          } catch (error) {
            console.error("[loadOccasion] Error getting sent invites:", error);
            // Fallback: check if user is a collaborator
            const collaborators = await collaboratorsApi.getCollaboratorsForOccasion(occasionId);
            const isCollaborator = (collaborators || []).some(
              (c: any) => {
                const cId = c.id || c._id || c.user || c;
                return String(cId) === String(currentUserId);
              }
            );
            
            if (isCollaborator) {
              isOwner = false;
              ownerId = null;
            } else {
              isOwner = true;
              ownerId = currentUserId;
            }
          }
        }
      } catch (error) {
        console.error("[loadOccasion] Error trying to determine owner from invites:", error);
        // Last resort: assume current user is owner
        isOwner = true;
        ownerId = currentUserId;
        console.warn("[loadOccasion] Using current user as owner fallback due to error");
      }
    }
    
    // Store owner info for use in other functions
    occasionOwnerId.value = ownerId;
    isCurrentUserOwner.value = isOwner;

    if (found) {
      occasion.value = found;
      eventName.value = found.occasionType || "Untitled Event";
      eventDate.value = found.date;
      relationshipName.value = found.person;

      // Prepare storage key for this occasion's shared notes selection
      // based on the route param ID so it's consistent across sessions.
      occasionNotesStorageKey.value = buildOccasionNotesStorageKey(
        currentUser.value,
        route.params.id
      );

      // Load relationship object and existing notes for this person
      // If current user is a collaborator, load from owner instead
      try {
        // Ensure we pass a proper User object format
        // If we don't know the owner and user is a collaborator, we can't load owner's data
        if (!isOwner && !ownerId) {
          console.error("[loadOccasion] Cannot load owner's data - owner unknown and user is collaborator");
          // Skip loading relationships/notes/tasks if we can't determine owner
          relationship.value = null;
          relationshipNotes.value = [];
          tasks.value = [];
        } else {
          // Extract user ID - backend expects a string ID, not an object
          const userToLoadFrom = isOwner 
            ? currentUser.value 
            : (ownerId ? ownerId : currentUser.value);
          
          // Convert to string ID if it's an object
          const userIdToLoad = typeof userToLoadFrom === "string" 
            ? userToLoadFrom 
            : userToLoadFrom?.id || userToLoadFrom?.username || userToLoadFrom;
          
          console.log("[loadOccasion] Loading relationships from user ID:", userIdToLoad);
        
        const relationshipsData = await relationshipApi.getRelationships(
          userIdToLoad
        );

        allRelationships.value = relationshipsData.map((r) => ({
          id: r.relationship?.id || r.name,
          name: r.name,
          relationshipType: r.relationshipType,
          relationship: r.relationship,
        }));

        const matchingRelationship = allRelationships.value.find(
          (r) => r.name === found.person
        );

        if (matchingRelationship) {
          relationship.value = matchingRelationship.relationship;
          relationshipName.value = matchingRelationship.name;

          try {
            isLoadingRelationshipNotes.value = true;
            // Load notes from the owner if current user is a collaborator
            const notesData = await notesApi.getNotesByRelationship(
              userIdToLoad,
              matchingRelationship.relationship
            );
            relationshipNotes.value = notesData;

            // Initialize Shared Notes from any previously saved selection
            notes.value = [];
            if (occasionNotesStorageKey.value) {
              try {
                const stored = localStorage.getItem(
                  occasionNotesStorageKey.value
                );
                if (stored) {
                  const parsed: Array<{
                    noteId: any | null;
                    title: string | null;
                    source: "relationship" | "occasion";
                  }> = JSON.parse(stored);

                  const createdBy =
                    userProfile.value?.name || getUserFirstName.value || "You";

                  const attachedNotes: typeof notes.value = [];
                  for (const entry of parsed) {
                    let backendNote = null as (typeof notesData)[number] | null;

                    if (entry.noteId) {
                      backendNote =
                        notesData.find((n) => n.note?.id === entry.noteId) ||
                        null;
                    }

                    if (!backendNote && entry.title) {
                      backendNote =
                        notesData.find((n) => n.title === entry.title) || null;
                    }

                    if (!backendNote) continue;

                    attachedNotes.push({
                      id:
                        backendNote.note?.id ||
                        backendNote.title ||
                        Date.now().toString(),
                      content: backendNote.content,
                      assignees: [],
                      source: entry.source,
                      createdBy,
                      title: backendNote.title,
                      noteRef: backendNote.note,
                      isEditing: false,
                    });
                  }

                  notes.value = attachedNotes;
                }
              } catch (error) {
                console.error(
                  "Error restoring saved occasion shared notes:",
                  error
                );
                notes.value = [];
              }
            }
          } catch (error) {
            console.error(
              "Error loading relationship notes for occasion:",
              error
            );
            relationshipNotes.value = [];
          } finally {
            isLoadingRelationshipNotes.value = false;
          }
        } else {
          console.warn(
            "No matching relationship found for person:",
            found.person
          );
          relationship.value = null;
          relationshipNotes.value = [];
        }
        }
      } catch (error) {
        console.error("Error loading relationships for occasion:", error);
        relationship.value = null;
        relationshipNotes.value = [];
      }

      // Load collaborators for this occasion (without sent invites - loaded on demand)
      await loadOccasionCollaborators(found.occasion, false);

      // Load planning checklist tasks from owner (if collaborator) or current user (if owner)
      try {
        // If we don't know the owner and user is a collaborator, skip loading tasks
        if (!isOwner && !ownerId) {
          console.error("[loadOccasion] Cannot load owner's tasks - owner unknown and user is collaborator");
          tasks.value = [];
        } else {
          // Extract user ID - backend expects a string ID, not an object
          const userToLoadTasksFrom = isOwner 
            ? currentUser.value 
            : (ownerId ? ownerId : currentUser.value);
          
          // Convert to string ID if it's an object
          const userIdToLoadTasks = typeof userToLoadTasksFrom === "string" 
            ? userToLoadTasksFrom 
            : userToLoadTasksFrom?.id || userToLoadTasksFrom?.username || userToLoadTasksFrom;
          
          console.log("[loadOccasion] Loading tasks from user ID:", userIdToLoadTasks);
          
          if (userIdToLoadTasks) {
            const [taskList, checklist] = await Promise.all([
              tasksApi.getTasks(userIdToLoadTasks),
              taskChecklistApi.getChecklist(userIdToLoadTasks),
            ]);

            const checklistMap = new Map<any, boolean>();
            for (const entry of checklist) {
              checklistMap.set(entry.task, entry.completed);
            }

            // Load saved priorities from localStorage
            const taskPrioritiesKey = `occasion-tasks-priorities-${route.params.id}-${ownerId}`;
            let savedPriorities: Record<string, "low" | "medium" | "high"> = {};
            try {
              const stored = localStorage.getItem(taskPrioritiesKey);
              if (stored) {
                savedPriorities = JSON.parse(stored);
              }
            } catch (error) {
              console.error("Error loading task priorities from localStorage:", error);
            }

            // Only show tasks that are actually in the checklist
            tasks.value = taskList
              .filter((t) => checklistMap.has(t.task))
              .map((t) => {
                const taskIdStr = String(t.task);
                return {
                  id: taskIdStr,
                  name: t.description,
                  completed: !!checklistMap.get(t.task),
                  // Priority is stored in localStorage since backend doesn't support it
                  priority: (savedPriorities[taskIdStr] || "medium") as "low" | "medium" | "high",
                  assignees: [],
                  isEditing: false,
                };
              });
            
            // Save priorities back to localStorage to ensure they persist
            saveTaskPriorities();
          } else {
            tasks.value = [];
          }
        }
      } catch (error) {
        console.error("Error loading planning checklist tasks:", error);
        tasks.value = [];
      }
    }
  } catch (error) {
    console.error("Error loading occasion:", error);
  } finally {
    isLoading.value = false;
  }
};

// Handle back navigation (go back to where user came from, with safe fallback)
const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/occasions");
  }
};

// Toggle task completion (backed by TaskChecklistConcept)
const toggleTask = async (taskId: string) => {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task || !currentUser.value) return;

  const previousCompleted = task.completed;
  // Optimistic UI update
  task.completed = !task.completed;

  try {
    // Use owner's account for task operations so all collaborators see the changes
    const taskOwner = isCurrentUserOwner.value 
      ? currentUser.value 
      : (occasionOwnerId.value ? occasionOwnerId.value : currentUser.value);
    
    // Extract user ID if it's an object
    const taskOwnerId = typeof taskOwner === "string" 
      ? taskOwner 
      : taskOwner?.id || taskOwner?.username || taskOwner;
    
    if (task.completed) {
      await taskChecklistApi.markComplete(taskOwnerId, taskId);
    } else {
      await taskChecklistApi.markIncomplete(taskOwnerId, taskId);
    }
    saveTaskPriorities(); // Save priorities after any task change
  } catch (error) {
    console.error("Error updating task completion status:", error);
    // Revert UI on error
    task.completed = previousCompleted;
    alert(
      error instanceof Error
        ? error.message
        : "Failed to update task status. Please try again."
    );
  }
};

// Add new task (backed by TaskConcept + TaskChecklistConcept)
const addTask = async () => {
  if (!newTaskName.value.trim() || !currentUser.value) return;

  const description = newTaskName.value.trim();

  try {
    // Determine which user should own the task
    // If current user is a collaborator, tasks should be added to the owner's account
    // so all collaborators can see them
    const taskOwner = isCurrentUserOwner.value 
      ? currentUser.value 
      : (occasionOwnerId.value ? occasionOwnerId.value : currentUser.value);
    
    // Extract user ID if it's an object
    const taskOwnerId = typeof taskOwner === "string" 
      ? taskOwner 
      : taskOwner?.id || taskOwner?.username || taskOwner;
    
    console.log("[addTask] Creating task for owner:", taskOwnerId, "isOwner:", isCurrentUserOwner.value);
    
    // 1) Create the underlying Task
    const createdTask = await tasksApi.createTask(
      taskOwnerId,
      description
    );
    const taskId = String(
      (createdTask as any).id ?? (createdTask as any).task ?? createdTask
    );

    // 2) Attach it to the owner's checklist
    await taskChecklistApi.addTask(taskOwnerId, taskId);

    // 3) Reload tasks to ensure we have the latest from the owner's account
    // This ensures collaborators see tasks added by other collaborators
    // We only reload the tasks section, not the entire occasion
    try {
      // Preserve existing task priorities before reloading
      const priorityMap = new Map<string, "low" | "medium" | "high">();
      for (const task of tasks.value) {
        priorityMap.set(task.id, task.priority);
      }
      
      const [taskList, checklist] = await Promise.all([
        tasksApi.getTasks(taskOwnerId),
        taskChecklistApi.getChecklist(taskOwnerId),
      ]);

      const checklistMap = new Map<any, boolean>();
      for (const entry of checklist) {
        checklistMap.set(entry.task, entry.completed);
      }

      // Load saved priorities from localStorage
      const taskPrioritiesKey = `occasion-tasks-priorities-${route.params.id}-${taskOwnerId}`;
      let savedPriorities: Record<string, "low" | "medium" | "high"> = {};
      try {
        const stored = localStorage.getItem(taskPrioritiesKey);
        if (stored) {
          savedPriorities = JSON.parse(stored);
        }
      } catch (error) {
        console.error("Error loading task priorities from localStorage:", error);
      }

      // Only show tasks that are actually in the checklist
      tasks.value = taskList
        .filter((t) => checklistMap.has(t.task))
        .map((t) => {
          const taskIdStr = String(t.task);
          // Use saved priority, or the new task's priority if it's the one we just added, or preserved priority, or default to medium
          const priority = taskIdStr === taskId 
            ? newTaskPriority.value 
            : (priorityMap.get(taskIdStr) || savedPriorities[taskIdStr] || "medium");
          
          return {
            id: taskIdStr,
            name: t.description,
            completed: !!checklistMap.get(t.task),
            priority: priority as "low" | "medium" | "high",
            assignees: [],
            isEditing: false,
          };
        });
      
      // Save priorities back to localStorage to ensure they persist
      saveTaskPriorities();
    } catch (error) {
      console.error("Error reloading tasks after adding:", error);
      // Fallback: add to local state
      tasks.value.push({
        id: taskId,
        name: description,
        completed: false,
        priority: newTaskPriority.value,
        assignees: [],
      });
      // Save priorities even in fallback case
      saveTaskPriorities();
    }

    newTaskName.value = "";
    showAddTask.value = false;
  } catch (error) {
    console.error("Error adding planning checklist task:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to add task. Please try again.";
    alert(message);
  }
};

// Delete task (remove from checklist + delete underlying Task)
const deleteTask = async (taskId: string) => {
  if (!currentUser.value) return;

  const previousTasks = [...tasks.value];
  tasks.value = tasks.value.filter((t) => t.id !== taskId);

  try {
    // Use owner's account for task operations so all collaborators see the changes
    const taskOwner = isCurrentUserOwner.value 
      ? currentUser.value 
      : (occasionOwnerId.value ? occasionOwnerId.value : currentUser.value);
    
    // Extract user ID if it's an object
    const taskOwnerId = typeof taskOwner === "string" 
      ? taskOwner 
      : taskOwner?.id || taskOwner?.username || taskOwner;
    
    await taskChecklistApi.removeTask(taskOwnerId, taskId);
    await tasksApi.deleteTask(taskId);
  } catch (error) {
    console.error("Error deleting planning checklist task:", error);
    // Restore previous state if backend delete fails
    tasks.value = previousTasks;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete task. Please try again.";
    alert(message);
  }
};

// Start editing task (local UI flag)
const startEditingTask = (task: any) => {
  task.isEditing = true;
};

// Save task priorities to localStorage
const saveTaskPriorities = () => {
  if (!occasionOwnerId.value || !route.params.id) return;
  
  const taskPrioritiesKey = `occasion-tasks-priorities-${route.params.id}-${occasionOwnerId.value}`;
  const prioritiesToSave: Record<string, "low" | "medium" | "high"> = {};
  
  for (const task of tasks.value) {
    prioritiesToSave[task.id] = task.priority;
  }
  
  try {
    localStorage.setItem(taskPrioritiesKey, JSON.stringify(prioritiesToSave));
  } catch (error) {
    console.error("Error saving task priorities to localStorage:", error);
  }
};

// Save task edit (backed by TaskConcept.updateTaskDescription)
const saveTaskEdit = async (task: any) => {
  if (!task || !task.id) {
    task.isEditing = false;
    return;
  }

  const newName = (task.name ?? "").trim();
  if (!newName) {
    task.isEditing = false;
    return;
  }

  const previousName = task.name;
  task.isEditing = false;

  try {
    await tasksApi.updateTaskDescription(task.id, newName);
    saveTaskPriorities(); // Save priorities after any task change
  } catch (error) {
    console.error("Error updating planning checklist task:", error);
    task.name = previousName;
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update task. Please try again.";
    alert(message);
  }
};

// Cancel task edit
const cancelTaskEdit = (task: any) => {
  task.isEditing = false;
};

// Add new note (occasion‑specific, persisted as a relationship note when possible)
const addNote = async () => {
  if (!newNoteContent.value.trim()) return;

  const content = newNoteContent.value.trim();
  const title =
    newNoteTitle.value.trim() ||
    eventName.value?.trim() ||
    relationshipName.value ||
    "Occasion note";
  const createdBy = userProfile.value?.name || getUserFirstName.value || "You";

  let backendNote: any | null = null;

  // If we know the underlying relationship, persist this as a real note.
  // If this fails, do NOT add a local-only note so the UI always matches backend.
  if (currentUser.value && relationship.value) {
    try {
      // Determine which user should own the note
      // If current user is a collaborator, notes should be added to the owner's account
      // so all collaborators can see them
      const noteOwner = isCurrentUserOwner.value 
        ? currentUser.value 
        : (occasionOwnerId.value ? occasionOwnerId.value : currentUser.value);
      
      // Extract user ID if it's an object
      const noteOwnerId = typeof noteOwner === "string" 
        ? noteOwner 
        : noteOwner?.id || noteOwner?.username || noteOwner;
      
      console.log("[addNote] Creating note for owner:", noteOwnerId, "isOwner:", isCurrentUserOwner.value);
      
      backendNote = await notesApi.createNote(
        noteOwnerId,
        relationship.value,
        title,
        content
      );
    } catch (error) {
      console.error("Error creating occasion note in backend:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create note. Please try a different title.";
      alert(message);
      return;
    }
  } else {
    // No relationship context – we can't persist to backend meaningfully.
    // For now, don't create a phantom note that will disappear on refresh.
    alert(
      "Cannot attach this note because the person for this occasion could not be found."
    );
    return;
  }

  notes.value.push({
    id: backendNote?.id || Date.now().toString(),
    content,
    assignees: [],
    source: "occasion",
    createdBy,
    title,
    noteRef: backendNote || null,
    isEditing: false,
  });

  // Persist updated selection of notes attached to this occasion
  persistOccasionNotesSelection();

  // Refresh relationship notes from backend so state is in sync
  try {
    if (relationship.value) {
      // Use owner's account to load notes so collaborators see all notes
      const noteOwner = isCurrentUserOwner.value 
        ? currentUser.value 
        : (occasionOwnerId.value ? occasionOwnerId.value : currentUser.value);
      
      // Extract user ID if it's an object
      const noteOwnerId = typeof noteOwner === "string" 
        ? noteOwner 
        : noteOwner?.id || noteOwner?.username || noteOwner;
      
      const notesData = await notesApi.getNotesByRelationship(
        noteOwnerId,
        relationship.value
      );
      relationshipNotes.value = notesData;
    }
  } catch (error) {
    console.error("Error refreshing relationship notes after create:", error);
  }

  newNoteTitle.value = "";
  newNoteContent.value = "";
};

const openOccasionNoteModal = () => {
  newNoteTitle.value = "";
  newNoteContent.value = "";
  showNoteModal.value = true;
};

const closeOccasionNoteModal = () => {
  showNoteModal.value = false;
  newNoteTitle.value = "";
  newNoteContent.value = "";
};

const handleCreateOccasionNote = async () => {
  if (!newNoteTitle.value.trim() || !newNoteContent.value.trim()) return;
  isCreatingOccasionNote.value = true;
  try {
    await addNote();
    showNoteModal.value = false;
  } finally {
    isCreatingOccasionNote.value = false;
  }
};

// Delete note (only removes from this occasion view; underlying person note stays)
const deleteNote = (noteId: string) => {
  notes.value = notes.value.filter((n) => n.id !== noteId);
  persistOccasionNotesSelection();
};

// Start editing note
const startEditingNote = (note: any) => {
  note.editingContent = note.content;
  note.isEditing = true;
};

// Save note edit
const saveNoteEdit = (note: any) => {
  if (note.editingContent !== undefined) {
    note.content = note.editingContent.trim();
    note.editingContent = undefined;
  }
  note.isEditing = false;
};

// Cancel note edit
const cancelNoteEdit = (note: any) => {
  note.editingContent = undefined;
  note.isEditing = false;
};

// Bring in an existing note from the person's notes
const addNoteFromRelationship = (relNote: {
  note: any;
  title: string;
  content: string;
}) => {
  const relNoteId = relNote.note?.id;
  const relTitle = relNote.title;

  const existing = notes.value.find((n) => {
    if (n.source !== "relationship") return false;

    const noteId = n.noteRef?.id;
    const noteTitle = n.title;

    if (noteId && relNoteId) {
      return noteId === relNoteId;
    }

    // Fallback: match by title when IDs are missing
    if (noteTitle && relTitle) {
      return noteTitle === relTitle;
    }

    return false;
  });
  if (existing) {
    showImportNotes.value = false;
    return;
  }

  const createdBy = userProfile.value?.name || getUserFirstName.value || "You";

  notes.value.push({
    id: relNote.note?.id || Date.now().toString(),
    content: relNote.content,
    assignees: [],
    source: "relationship",
    createdBy,
    title: relNote.title,
    noteRef: relNote.note,
    isEditing: false,
  });

  // Persist updated selection of notes attached to this occasion
  persistOccasionNotesSelection();

  showImportNotes.value = false;
};

// Invite collaborator (by username, backed by CollaboratorsConcept)
const inviteCollaborator = async () => {
  const username = newCollaboratorUsername.value.trim();
  console.log("recipient username", username);
  if (!username) return;

  // Avoid duplicate collaborators by username
  if (
    collaborators.value.some(
      (c) => c.name.toLowerCase() === username.toLowerCase()
    )
  ) {
    alert("This user is already a collaborator.");
    return;
  }

  try {
    if (!occasion.value?.occasion) {
      throw new Error(
        "Occasion not found. Please reload the page and try again."
      );
    }

    // Get sender username from user profile or current user object
    // Note: The login form uses "email" field for username, so currentUser.username should be set
    const senderUsername = userProfile.value?.username || currentUser.value?.username;
    console.log("sender username", senderUsername);
    console.log("currentUser.value", currentUser.value);
    console.log("userProfile.value", userProfile.value);
    if (!senderUsername) {
      throw new Error("Unable to determine sender. Please log in again.");
    }

    await collaboratorsApi.createInvite(
      username,
      occasion.value.occasion,
      senderUsername
    );

    // Reload collaborators to show the pending invite tag (include sent invites)
    await loadOccasionCollaborators(occasion.value.occasion, true);

    // Show success message
    alert(`Invitation sent successfully to ${username}!`);

    // Only clear input & close modal on success
    newCollaboratorUsername.value = "";
    showInviteModal.value = false;
  } catch (error: any) {
    console.error("Error inviting collaborator:", error);

    const rawMessage =
      error instanceof Error
        ? error.message
        : "Failed to invite collaborator. Please check the username and try again.";

    const lower = rawMessage.toLowerCase();

    // Provide a cleaner message when a pending invite already exists
    if (lower.includes("pending invite already exists")) {
      alert("An invitation is already pending for this user on this occasion.");
      return;
    }

    // Provide a clearer message if sender/recipient validation failed
    if (lower.includes("sender and recipient are required")) {
      alert(
        "Unable to send invite. Please make sure you are logged in and the username is valid, then try again."
      );
      return;
    }

    alert(rawMessage);
  }
};

// Load collaborators for an occasion (including accepted and optionally pending sent invites)
const loadOccasionCollaborators = async (
  occasionId: any,
  includeSentInvites: boolean = true
) => {
  try {
    // Extract occasion ID if it's an object
    const occasionIdValue = typeof occasionId === "string" 
      ? occasionId 
      : occasionId?.id || occasionId?.occasion || occasionId;
    
    console.log("[loadOccasionCollaborators] Loading collaborators for occasion:", occasionIdValue);
    
    // Load accepted collaborators
    const backendCollaborators =
      await collaboratorsApi.getCollaboratorsForOccasion(occasionIdValue);
    
    console.log("[loadOccasionCollaborators] Received collaborators from API:", backendCollaborators);
    
    // Resolve usernames for collaborator user IDs
    const mapped: Array<{
      id: string;
      name: string;
      initial: string;
      status: "accepted" | "pending";
    }> = await Promise.all(
      (backendCollaborators || []).map(async (c: any) => {
        const id = c.id || c._id || c.user || c;
        let username: string = String(id ?? "collaborator");
        
        // If collaborator is just a user ID string, look up the profile
        if (typeof c === "string" || (typeof id === "string" && !c.username && !c.name)) {
          try {
            const profile = await profileApi.getProfile({ id: String(id), username: String(id) });
            username = profile.username || profile.name || String(id);
          } catch (error) {
            console.warn("[loadOccasionCollaborators] Failed to look up collaborator profile:", id, error);
            username = String(id); // Fallback to showing the ID
          }
        } else {
          username = c.username || c.name || String(id);
        }
        
        const initial = username.charAt(0).toUpperCase();
        return {
          id: String(id),
          name: username,
          initial,
          status: "accepted" as const,
        };
      })
    );

    // Always include the owner as a collaborator
    if (occasionOwnerId.value) {
      const ownerId = occasionOwnerId.value;
      const hasOwner = mapped.some((c: any) => c.id === ownerId);
      
      if (!hasOwner) {
        try {
          const ownerProfile = await profileApi.getProfile({ id: ownerId, username: ownerId });
          const ownerName = ownerProfile.username || ownerProfile.name || ownerId;
          mapped.unshift({
            id: ownerId,
            name: ownerName,
            initial: ownerName.charAt(0).toUpperCase(),
            status: "accepted" as const,
          });
        } catch (error) {
          console.warn("[loadOccasionCollaborators] Failed to look up owner profile:", ownerId, error);
          mapped.unshift({
            id: ownerId,
            name: ownerId,
            initial: ownerId.charAt(0).toUpperCase(),
            status: "accepted" as const,
          });
        }
      }
    }

    // Load sent invites and add pending ones as tags (only if requested)
    if (includeSentInvites) {
      try {
        const sentInvites = await collaboratorsApi.getSentInvites();
        const pendingForOccasion = (sentInvites || []).filter(
          (inv: any) =>
            inv.occasionId === occasionId && inv.status === "pending"
        );

        for (const inv of pendingForOccasion) {
          const rawRecipient = inv.recipient;
          const id =
            (rawRecipient as any)?.id ||
            (rawRecipient as any)?._id ||
            rawRecipient;
          const username =
            (rawRecipient as any)?.username ||
            (rawRecipient as any)?.name ||
            String(id ?? "collaborator");
          const initial = username.charAt(0).toUpperCase();

          const alreadyExists = mapped.some(
            (c) =>
              c.id === String(id) ||
              c.name.toLowerCase() === username.toLowerCase()
          );
          if (!alreadyExists) {
            mapped.push({
              id: String(inv.invite ?? id ?? username),
              name: username,
              initial,
              status: "pending" as const,
            });
          }
        }
      } catch (error) {
        console.error(
          "Error loading sent collaborator invites for occasion:",
          error
        );
      }
    }

    collaborators.value = mapped;
  } catch (error) {
    console.error("Error loading collaborators from backend:", error);
    // Fallback: show only current user as collaborator for now
    if (userProfile.value) {
      collaborators.value = [
        {
          id:
            currentUser.value?.id ||
            currentUser.value?.username ||
            "current-user",
          name: userProfile.value.name,
          initial: userProfile.value.name.charAt(0).toUpperCase(),
          status: "accepted",
        },
      ];
    } else {
      collaborators.value = [];
    }
  }
};

// Remove collaborator
const removeCollaborator = async (collabId: string) => {
  try {
    if (!occasion.value?.occasion) {
      console.warn("[removeCollaborator] No occasion available");
      return;
    }
    
    // Extract occasion ID
    const occasionId = typeof occasion.value.occasion === "string"
      ? occasion.value.occasion
      : occasion.value.occasion?.id || occasion.value.occasion?.occasion || occasion.value.occasion;
    
    // Call the backend API to remove the collaborator
    await collaboratorsApi.removeCollaborator(collabId, occasionId);
    
    // Reload collaborators to reflect the change
    await loadOccasionCollaborators(occasionId, true);
  } catch (error: any) {
    console.error("Error removing collaborator:", error);
    alert(
      error instanceof Error
        ? error.message
        : "Failed to remove collaborator. Please try again."
    );
  }
};

// Get suggestions
const getSuggestions = async () => {
  if (!currentUser.value) {
    alert("You need to be logged in to get suggestions.");
    return;
  }

  if (!relationshipName.value || notes.value.length === 0) {
    showNoNotesModal.value = true;
    return;
  }

  isLoadingSuggestions.value = true;
  try {
    // Aggregate shared notes into a single context string
    const sharedNotes = notes.value
      .map((n) => {
        const titlePart = n.title ? `${n.title}: ` : "";
        return `${titlePart}${n.content}`;
      })
      .join("\n\n");

    const context = {
      sharedNotes,
      personName: relationshipName.value,
      occasionName: eventName.value,
      occasionDate: eventDate.value,
      daysRemaining: remainingDays.value,
      occasionId: route.params.id,
      collaborators: collaborators.value.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
    };

    const result = await suggestionEngineApi.generateGiftSuggestions(
      currentUser.value,
      context
    );

    // Backend already flattens each suggestion into a single string
    suggestions.value = result.map((s) => s.content).slice(0, 3);
  } catch (error) {
    console.error("Error getting suggestions:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get suggestions. Please try again.";
    alert(message);
  } finally {
    isLoadingSuggestions.value = false;
  }
};

// Handle logout
const handleLogout = async () => {
  sessionManager.clearUser();
  currentUser.value = null;
  userProfile.value = null;
  showUserMenu.value = false;
  router.replace("/");
};

// Handle mail icon click - load invites on demand
const handleMailIconClick = async () => {
  await loadInvitesOnDemand();
  showInvitesMenu.value = !showInvitesMenu.value;
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
  if (!savedUser) {
    router.push("/");
    return;
  }

  currentUser.value = savedUser;
  await loadUserProfile();
  await loadOccasion();

  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="occasion-detail-page">
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
          <div class="navbar-mail-wrapper">
            <button
              @click.stop="handleMailIconClick"
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
                      From @{{ invite.toUsername }}
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
                  <div
                    v-if="invite.status === 'pending'"
                    class="navbar-mail-actions"
                  >
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
    <main class="occasion-detail-main">
      <div v-if="isLoading" class="loading-state-full">
        <div class="spinner-large"></div>
        <p>Loading event details...</p>
      </div>

      <div v-else-if="occasion" class="occasion-detail-container">
        <!-- Top Navigation Section -->
        <div class="occasion-top-nav">
          <div class="occasion-top-left">
            <div class="occasion-title-section">
              <h1
                v-if="!isEditingEventName"
                @click="isEditingEventName = true"
                class="occasion-title-editable"
              >
                {{ eventName }}
              </h1>
              <input
                v-else
                v-model="eventName"
                @blur="isEditingEventName = false"
                @keyup.enter="isEditingEventName = false"
                @keyup.esc="isEditingEventName = false"
                class="occasion-title-input"
                autofocus
              />
              <div class="occasion-days-remaining">
                <svg
                  width="16"
                  height="16"
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
                <span>{{ daysText }}</span>
              </div>
            </div>
          </div>
          <div class="occasion-top-right">
            <button @click="openEditEventModal" class="edit-event-button">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                ></path>
                <path
                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                ></path>
              </svg>
              Edit Event Details
            </button>
          </div>
        </div>

        <!-- Overview Stats Row (task‑management style) -->
        <div class="occasion-stats-row">
          <div class="occasion-stat-card stat-completed">
            <div class="stat-label">Completed</div>
            <div class="stat-value">{{ completedTasks }}</div>
            <div class="stat-meta">of {{ totalTasks }} tasks</div>
          </div>
          <div class="occasion-stat-card stat-pending">
            <div class="stat-label">Pending</div>
            <div class="stat-value">{{ pendingTasks }}</div>
            <div class="stat-meta">
              {{ highPriorityOpenTasks }} high priority
            </div>
          </div>
          <div class="occasion-stat-card stat-notes">
            <div class="stat-label">Notes</div>
            <div class="stat-value">{{ notesCount }}</div>
            <div class="stat-meta">Shared insights</div>
          </div>
        </div>

        <!-- Collaborators Section -->
        <section class="occasion-section">
          <h2 class="section-title">Collaborators</h2>
          <div class="collaborators-pills">
            <div
              v-for="collab in collaborators"
              :key="collab.id"
              class="collaborator-pill"
              :class="{
                'collaborator-pill-pending': collab.status === 'pending',
              }"
            >
              <span class="pill-avatar">{{ collab.initial }}</span>
              <div class="pill-main">
                <span class="pill-name">{{ collab.name }}</span>
                <span
                  v-if="collab.status === 'pending'"
                  class="pill-status pill-status-pending"
                >
                  Pending invite
                </span>
              </div>
              <button
                v-if="!isCurrentUserOwner && collab.id !== occasionOwnerId && collab.id !== (currentUser?.id || currentUser?.username || currentUser)"
                @click="removeCollaborator(collab.id)"
                class="pill-remove"
                aria-label="Remove collaborator"
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
            </div>
            <button @click="showInviteModal = true" class="invite-pill">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Invite +
            </button>
          </div>
        </section>

        <!-- Planning Checklist Section -->
        <section class="occasion-section">
          <h2 class="section-title">Planning Checklist</h2>
          <div class="checklist-container">
            <div v-for="task in tasks" :key="task.id" class="task-card">
              <div class="task-left">
                <button
                  @click="toggleTask(task.id)"
                  class="task-checkbox"
                  :class="{
                    'task-checkbox-completed': task.completed,
                    [`priority-${task.priority}`]: !task.completed,
                  }"
                  :aria-label="
                    task.completed ? 'Mark as incomplete' : 'Mark as complete'
                  "
                >
                  <svg
                    v-if="task.completed"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="3"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <div class="task-content">
                  <input
                    v-if="task.isEditing"
                    v-model="task.name"
                    @blur="saveTaskEdit(task)"
                    @keyup.enter="saveTaskEdit(task)"
                    @keyup.esc="cancelTaskEdit(task)"
                    class="task-name-input"
                    autofocus
                  />
                  <span
                    v-else
                    @dblclick="startEditingTask(task)"
                    class="task-name"
                    :class="{ 'task-name-completed': task.completed }"
                  >
                    {{ task.name }}
                  </span>
                </div>
              </div>
              <div class="task-right">
                <div class="task-assignees">
                  <div
                    v-for="assignee in task.assignees"
                    :key="assignee.id"
                    class="assignee-mini-pill"
                  >
                    {{ assignee.initial }}
                  </div>
                </div>
                <button
                  @click="deleteTask(task.id)"
                  class="task-delete"
                  aria-label="Delete task"
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
            <button
              v-if="!showAddTask"
              @click="showAddTask = true"
              class="add-task-button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add new task
            </button>
            <div v-else class="add-task-form">
              <input
                v-model="newTaskName"
                @keyup.enter="addTask"
                @keyup.esc="showAddTask = false"
                placeholder="Task name..."
                class="add-task-input"
                autofocus
              />
              <select v-model="newTaskPriority" class="add-task-priority">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <div class="add-task-actions">
                <button @click="addTask" class="add-task-save">Add</button>
                <button @click="showAddTask = false" class="add-task-cancel">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Shared Notes Section -->
        <section class="occasion-section">
          <div class="section-header-with-help">
            <h2 class="section-title">Shared Notes</h2>
            <p class="section-help-text">
              Each user can selectively choose to share notes they gathered on
              person.
            </p>
          </div>
          <div class="notes-container">
            <div v-for="note in notes" :key="note.id" class="note-card">
              <div class="note-content-wrapper">
                <div v-if="note.isEditing" class="note-editing">
                  <textarea
                    v-model="note.editingContent"
                    @keyup.esc="cancelNoteEdit(note)"
                    class="note-edit-input"
                    rows="3"
                    autofocus
                  ></textarea>
                  <div class="note-edit-actions">
                    <button @click="saveNoteEdit(note)" class="note-save-btn">
                      Save
                    </button>
                    <button
                      @click="cancelNoteEdit(note)"
                      class="note-cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div
                  v-else
                  @dblclick="startEditingNote(note)"
                  class="note-content"
                >
                  <h3 class="note-title">
                    {{ note.title || "Note" }}
                  </h3>
                  <p class="note-text">
                    {{ note.content }}
                  </p>
                  <div class="note-meta">
                    <span
                      class="note-source-pill"
                      :class="{
                        'note-source-pill-relationship':
                          note.source === 'relationship',
                        'note-source-pill-occasion': note.source === 'occasion',
                      }"
                    >
                      {{
                        note.source === "relationship"
                          ? "From person notes"
                          : "Occasion note"
                      }}
                    </span>
                    <span class="note-author-label">
                      Added by {{ note.createdBy || getUserFirstName }}
                    </span>
                  </div>
                  <div class="note-actions-hover">
                    <button
                      @click="startEditingNote(note)"
                      class="note-action-btn"
                      aria-label="Edit note"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                        ></path>
                        <path
                          d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                        ></path>
                      </svg>
                    </button>
                    <button
                      @click="deleteNote(note.id)"
                      class="note-action-btn"
                      aria-label="Delete note"
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
              </div>
              <div class="note-assignees">
                <div
                  v-for="assignee in note.assignees"
                  :key="assignee.id"
                  class="assignee-mini-pill"
                >
                  {{ assignee.initial }}
                </div>
              </div>
            </div>
            <div class="notes-actions-row">
              <button @click="openOccasionNoteModal" class="add-note-button">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add new note for this occasion
              </button>
              <button
                v-if="relationshipName"
                @click="showImportNotes = !showImportNotes"
                class="add-note-secondary-button"
              >
                Add existing note for {{ relationshipName || "this person" }}
              </button>
            </div>

            <div v-if="showImportNotes" class="import-notes-list">
              <div
                v-if="isLoadingRelationshipNotes"
                class="import-notes-loading"
              >
                Loading notes...
              </div>
              <div
                v-else-if="!relationshipNotes.length"
                class="import-notes-loading"
              >
                No existing notes yet for this person.
              </div>
              <div
                v-else-if="!availableRelationshipNotes.length"
                class="import-notes-loading"
              >
                All existing notes for this person are already added to this
                occasion.
              </div>
              <div
                v-else
                v-for="relNote in availableRelationshipNotes"
                :key="relNote.note?.id || relNote.title"
                class="import-note-item"
                @click="addNoteFromRelationship(relNote)"
              >
                <div class="import-note-title">
                  {{ relNote.title || "Untitled note" }}
                </div>
                <div class="import-note-preview">
                  {{ relNote.content }}
                </div>
                <div class="import-note-cta">Add to this occasion</div>
              </div>
              <div
                v-if="isLoadingRelationshipNotes"
                class="import-notes-loading"
              >
                Loading notes...
              </div>
            </div>
          </div>
        </section>

        <!-- Suggestions Results (if available) -->
        <section v-if="suggestions.length > 0" class="occasion-section">
          <h2 class="section-title">Suggestions</h2>
          <div class="suggestions-list">
            <div
              v-for="(suggestion, index) in suggestions"
              :key="index"
              class="suggestion-item"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              <span>{{ suggestion }}</span>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Edit Occasion Modal (matches All Occasions edit/create modal) -->
    <div
      v-if="showEditEventModal"
      class="modal-overlay"
      @click.self="showEditEventModal = false"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Edit Occasion</h2>
          <button
            @click="showEditEventModal = false"
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
                v-model="editEventName"
                type="text"
                placeholder="e.g., Birthday, Anniversary"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input
                v-model="editEventDate"
                type="date"
                class="form-input"
                required
              />
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Person *</label>
              <select v-model="editEventPerson" class="form-input" required>
                <option :value="null">Select a person</option>
                <option
                  v-for="rel in allRelationships"
                  :key="rel.id"
                  :value="rel.name"
                >
                  {{ rel.name }} ({{ rel.relationshipType }})
                </option>
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">Description (Optional)</label>
              <textarea
                v-model="editEventDescription"
                placeholder="Add any notes or details..."
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditEventModal = false" class="button-secondary">
            Cancel
          </button>
          <button
            @click="handleUpdateEvent"
            class="button-primary"
            :disabled="
              isUpdatingEvent ||
              !editEventName.trim() ||
              !editEventDate ||
              !editEventPerson
            "
          >
            {{ isUpdatingEvent ? "Updating..." : "Update Occasion" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Occasion Note Modal -->
    <transition name="modal">
      <div
        v-if="showNoteModal"
        class="modal-overlay"
        @click.self="closeOccasionNoteModal"
      >
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">New Occasion Note</h2>
            <button
              @click="closeOccasionNoteModal"
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
            <div class="modal-form">
              <div class="modal-field">
                <label class="modal-label">Title</label>
                <input
                  v-model="newNoteTitle"
                  type="text"
                  placeholder="Note title..."
                  class="modal-input"
                />
              </div>
              <div class="modal-field">
                <label class="modal-label">Content</label>
                <textarea
                  v-model="newNoteContent"
                  placeholder="Write your note for this occasion..."
                  class="modal-textarea"
                  rows="8"
                ></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <div class="modal-footer-actions">
              <button
                @click="handleCreateOccasionNote"
                :disabled="
                  !newNoteTitle.trim() ||
                  !newNoteContent.trim() ||
                  isCreatingOccasionNote
                "
                class="modal-button modal-button-primary"
              >
                {{ isCreatingOccasionNote ? "Adding..." : "Add Note" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Primary Bottom CTA -->
    <div class="occasion-bottom-cta">
      <button
        @click="getSuggestions"
        class="get-suggestions-button"
        :disabled="isLoadingSuggestions"
      >
        <svg
          v-if="!isLoadingSuggestions"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          ></path>
        </svg>
        <div v-else class="spinner-small"></div>
        {{
          isLoadingSuggestions ? "Getting suggestions..." : "Get Suggestions"
        }}
      </button>
    </div>

    <!-- Invite Collaborator Modal -->
    <div
      v-if="showInviteModal"
      class="modal-overlay"
      @click.self="showInviteModal = false"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Invite Collaborator</h2>
          <button
            @click="showInviteModal = false"
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
          <div class="form-group">
            <label class="form-label">Username</label>
            <input
              v-model="newCollaboratorUsername"
              type="text"
              placeholder="collaborator-username"
              class="form-input"
              @keyup.enter="inviteCollaborator"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showInviteModal = false" class="button-secondary">
            Cancel
          </button>
          <button @click="inviteCollaborator" class="button-primary">
            Invite
          </button>
        </div>
      </div>
    </div>

    <!-- No Notes Modal -->
    <transition name="modal">
      <div
        v-if="showNoNotesModal"
        class="modal-overlay"
        @click.self="showNoNotesModal = false"
      >
        <div class="modal-content no-notes-modal" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">Add Notes First</h2>
            <button
              @click="showNoNotesModal = false"
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
          <div class="modal-body no-notes-modal-body">
            <div class="no-notes-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3 class="no-notes-title">
              We need more information to generate suggestions
            </h3>
            <p class="no-notes-message">
              Add some shared notes about
              <strong>{{ relationshipName || "this person" }}</strong> first to
              get personalized gift suggestions tailored to their interests and
              preferences.
            </p>
          </div>
          <div class="modal-footer no-notes-modal-footer">
            <button
              @click="showNoNotesModal = false"
              class="button-secondary"
            >
              Got it
            </button>
            <button
              @click="
                showNoNotesModal = false;
                openOccasionNoteModal();
              "
              class="button-primary"
            >
              <svg
                width="18"
                height="18"
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
        </div>
      </div>
    </transition>
  </div>
</template>
