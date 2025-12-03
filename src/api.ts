/**
 * API Service for Momento Backend
 *
 * All endpoints use POST method with application/json content type.
 * Base URL: defaults to /api, can be overridden with VITE_API_BASE_URL environment variable
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

interface ApiResponse<T> {
  [key: string]: T;
}

interface User {
  id?: string;
  username: string;
  [key: string]: any;
}

interface Profile {
  id?: string;
  user: User;
  name: string;
  [key: string]: any;
}

/**
 * Generic API call function
 */
async function apiCall<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    // Automatically attach session to every request body when available,
    // unless the caller has already provided a session field.
    let finalBody: Record<string, any> = { ...body };
    try {
      // sessionManager is declared later in this file; it's safe to reference here at runtime.
      // We guard with typeof to avoid issues in tests or unusual environments.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const existingHasSession = Object.prototype.hasOwnProperty.call(
        body,
        "session"
      );
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const session =
        !existingHasSession && typeof sessionManager !== "undefined"
          ? (sessionManager as any).getSession?.()
          : null;
      if (session) {
        finalBody = { ...finalBody, session };
      }
    } catch {
      // If anything goes wrong while attaching session, fall back to the original body.
      finalBody = body;
    }

    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalBody),
    });
  } catch (error) {
    // Handle network errors (connection refused, CORS, etc.)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Cannot connect to backend server. Please make sure the backend is running and accessible."
      );
    }
    throw error;
  }

  // Handle response body - try to parse as JSON
  let data: any = {};
  const contentType = response.headers.get("content-type");
  const hasJsonContent =
    contentType && contentType.includes("application/json");

  // Try to parse response as JSON (even if content-type isn't set, backend might return JSON)
  try {
    const text = await response.text();
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // If it looks like JSON but parsing failed, or if content-type says JSON
        if (hasJsonContent) {
          // Backend said it's JSON but it's not valid - this is a backend issue
          if (!response.ok) {
            throw new Error(
              `Server error (${response.status}): Invalid JSON response. ${response.statusText}`
            );
          }
          throw new Error("Invalid JSON response from server");
        }
        // Not JSON, that's okay - might be plain text error
        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}: ${
              text || response.statusText
            }`
          );
        }
      }
    }
  } catch (error) {
    // If we already threw an error above, re-throw it
    if (error instanceof Error) {
      throw error;
    }
    // Otherwise, handle the case where text() itself fails
    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}: ${response.statusText}`
      );
    }
  }

  // Check for HTTP errors (4xx, 5xx)
  if (!response.ok) {
    // Check if this might be a proxy connection error (empty response with 500)
    if (response.status === 500 && (!data || Object.keys(data).length === 0)) {
      throw new Error(
        "Cannot connect to backend server. Please make sure the backend is running on the configured port (default: http://localhost:3000). Check your .env file or vite.config.ts for the VITE_BACKEND_URL setting."
      );
    }

    // Try to extract error message from response
    let errorMessage = `Request failed with status ${response.status}`;

    if (data && typeof data === "object") {
      // Check for common error message fields
      if ("error" in data && typeof data.error === "string") {
        errorMessage = data.error;
      } else if ("message" in data && typeof data.message === "string") {
        errorMessage = data.message;
      } else if ("detail" in data && typeof data.detail === "string") {
        errorMessage = data.detail;
      } else {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }
    } else {
      errorMessage = `${errorMessage}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  // Check for API-level errors (error field in response even when status is 200)
  if ("error" in data && data.error) {
    const errorMessage =
      typeof data.error === "string" ? data.error : "An error occurred";
    throw new Error(errorMessage);
  }

  return data as T;
}

/**
 * UserAuth API
 */
export const userAuthApi = {
  /**
   * Register a new user
   * POST /api/UserAuth/register
   */
  async register(username: string, password: string): Promise<User> {
    const response = await apiCall<ApiResponse<User>>("/UserAuth/register", {
      username,
      password,
    });
    if (!response.user) {
      throw new Error("Failed to register user");
    }
    return response.user;
  },

  /**
   * Login a user
   * POST /api/UserAuth/login
   */
  async login(username: string, password: string): Promise<User> {
    const response = await apiCall<any>("/UserAuth/login", {
      username,
      password,
    });
    // Persist session token if backend provides one
    if (response.session) {
      sessionManager.setSession(response.session);
    }
    if (!response.user) {
      throw new Error("Failed to login user");
    }
    return response.user;
  },

  /**
   * Get user by username
   * POST /api/UserAuth/_getUserByUsername
   */
  async getUserByUsername(username: string): Promise<User> {
    const response = await apiCall<Array<ApiResponse<User>>>(
      "/UserAuth/_getUserByUsername",
      { username }
    );
    if (!response[0]?.user) {
      throw new Error("User not found");
    }
    return response[0].user;
  },
};

/**
 * Profile API
 */
export const profileApi = {
  /**
   * Create a new profile for a user
   * POST /api/Profile/createProfile
   */
  async createProfile(user: User, name: string): Promise<Profile> {
    const response = await apiCall<ApiResponse<Profile>>(
      "/Profile/createProfile",
      {
        user,
        name,
      }
    );
    if (!response.profile) {
      throw new Error("Failed to create profile");
    }
    return response.profile;
  },

  /**
   * Update profile name
   * POST /api/Profile/updateName
   */
  async updateName(user: User, name: string): Promise<void> {
    await apiCall("/Profile/updateName", {
      user,
      name,
    });
  },

  /**
   * Get profile information
   * POST /api/Profile/_getProfile
   */
  async getProfile(
    user: User
  ): Promise<{ name: string; email: string; username?: string }> {
    // Send user ID if available, otherwise send the whole user object
    const userPayload = user.id || user.username || user;

    const response = await apiCall<any>("/Profile/_getProfile", {
      user: userPayload,
    });
    console.log("Profile API response:", response);

    // Handle different response formats
    let profile: { name: string; email: string; username?: string } | null =
      null;

    // If response is wrapped in a 'profile' field
    if (response && typeof response === "object" && "profile" in response) {
      profile = response.profile as {
        name: string;
        email: string;
        username?: string;
      };
    }
    // If response is an array, take the first element
    else if (Array.isArray(response)) {
      profile = response[0] || null;
    }
    // If response is already an object with name and email
    else if (response && typeof response === "object" && "name" in response) {
      profile = response as { name: string; email: string; username?: string };
    }
    // If response might be wrapped in a data field
    else if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      Array.isArray(response.data)
    ) {
      profile = response.data[0] || null;
    }

    if (!profile || !profile.name) {
      console.error("Profile response format:", response);
      throw new Error("Profile not found or name is missing");
    }

    return profile;
  },

  /**
   * Get profile name only
   * POST /api/Profile/_getName
   */
  async getName(user: User): Promise<string> {
    const response = await apiCall<Array<{ name: string }>>(
      "/Profile/_getName",
      { user }
    );
    if (!response[0]?.name) {
      throw new Error("Profile name not found");
    }
    return response[0].name;
  },
};

/**
 * Collaborators API (backed by CollaboratorsConcept)
 *
 * NOTE: The underlying concept works with a set of Users (IDs). On the frontend we:
 * - Invite by username (resolve to a User via UserAuth)
 * - Maintain a simple shape for display: { id, username }
 */
export const collaboratorsApi = {
  /**
   * (LEGACY) Directly add a collaborator by username (no invite workflow).
   * Prefer using createInvite + acceptInvite in new code.
   */
  async addCollaboratorByUsername(username: string): Promise<{ user: User }> {
    const user = await userAuthApi.getUserByUsername(username);

    await apiCall<{}>("/Collaborators/addCollaborator", {
      user,
    });

    return { user };
  },

  /**
   * Remove collaborator by user object or raw ID.
   */
  async removeCollaborator(user: User | string): Promise<void> {
    const userPayload =
      typeof user === "string" ? user : user.id || user.username || user;
    await apiCall<{}>("/Collaborators/removeCollaborator", {
      user: userPayload,
    });
  },

  /**
   * Get all collaborators (returns raw IDs or user-like objects from backend).
   * We keep the response generic and let callers resolve profiles if needed.
   */
  async getCollaborators(): Promise<any[]> {
    const response = await apiCall<any[]>(
      "/Collaborators/_getCollaborators",
      {}
    );
    return response;
  },

  /**
   * Check if a given user is already a collaborator.
   */
  async hasCollaborator(user: User | string): Promise<boolean> {
    const userPayload =
      typeof user === "string" ? user : user.id || user.username || user;
    const response = await apiCall<Array<{ value: boolean }>>(
      "/Collaborators/_hasCollaborator",
      {
        user: userPayload,
      }
    );
    if (Array.isArray(response) && typeof response[0]?.value === "boolean") {
      return response[0].value;
    }
    // Fallback: if backend returns a bare boolean
    if (typeof (response as unknown as any) === "boolean") {
      return response as unknown as boolean;
    }
    return false;
  },

  /**
   * Create a collaboration invite for a specific occasion by recipient username.
   * The backend:
   *  - Resolves the username to a User
   *  - Creates a pending invite tied to the occasion
   */
  async createInvite(
    recipientUsername: string,
    occasionId: any,
    senderUsername?: string
  ): Promise<{ invite: string }> {
    const body: Record<string, any> = {
      recipientUsername,
      occasionId,
    };
    console.log("recipientUsername", recipientUsername);
    console.log("occasionId", occasionId);
    console.log("senderUsername", senderUsername);
    // Include sender username if provided
    if (senderUsername) {
      body.senderUsername = senderUsername;
    }

    const response = await apiCall<{ invite: string }>(
      "/Collaborators/createInvite",
      body
    );
    return response;
  },

  /**
   * Get all incoming (received) invites for the current user.
   */
  async getIncomingInvites(): Promise<
    Array<{
      invite: any;
      occasionId: any;
      sender: User;
      status: string;
      createdAt: string;
    }>
  > {
    const response = await apiCall<{ invites?: any[] }>(
      "/Collaborators/_getIncomingInvites",
      {}
    );
    return (response.invites || []) as Array<{
      invite: string;
      occasionId: any;
      sender: User;
      status: string;
      createdAt: string;
    }>;
  },

  /**
   * Get all invites sent by the current user.
   */
  async getSentInvites(): Promise<
    Array<{
      invite: any;
      occasionId: any;
      recipient: User;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const response = await apiCall<{ invites?: any[] }>(
      "/Collaborators/_getSentInvites",
      {}
    );
    return (response.invites || []) as Array<{
      invite: string;
      occasionId: any;
      recipient: User;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>;
  },

  /**
   * Accept an invitation (current user must be the recipient).
   */
  async acceptInvite(invite: any): Promise<void> {
    await apiCall<{ status: string }>("/Collaborators/acceptInvite", {
      invite,
    });
  },

  /**
   * Decline an invitation (current user must be the recipient).
   */
  async declineInvite(invite: any): Promise<void> {
    await apiCall<{ status: string }>("/Collaborators/declineInvite", {
      invite,
    });
  },

  /**
   * Get accepted collaborators for a single occasion.
   */
  async getCollaboratorsForOccasion(occasionId: any): Promise<any[]> {
    const response = await apiCall<{ collaborators?: any[] }>(
      "/Collaborators/_getCollaboratorsForOccasion",
      { occasionId }
    );
    return response.collaborators || [];
  },
};

/**
 * Relationship API
 */
export const relationshipApi = {
  /**
   * Create a new relationship
   * POST /api/Relationship/createRelationship
   */
  async createRelationship(
    owner: User,
    name: string,
    relationshipType: string
  ): Promise<any> {
    const response = await apiCall<ApiResponse<any>>(
      "/Relationship/createRelationship",
      {
        owner,
        name,
        relationshipType,
      }
    );
    if (!response.relationship) {
      throw new Error("Failed to create relationship");
    }
    return response.relationship;
  },

  /**
   * Get all relationships for a user
   * POST /api/Relationship/_getRelationships
   */
  async getRelationships(owner: User): Promise<
    Array<{
      relationship: any;
      name: string;
      relationshipType: string;
    }>
  > {
    const response = await apiCall<
      Array<{
        relationship: any;
        name: string;
        relationshipType: string;
      }>
    >("/Relationship/_getRelationships", { owner });
    return response;
  },

  /**
   * Get relationship by name
   * POST /api/Relationship/_getRelationshipByName
   */
  async getRelationshipByName(
    owner: User,
    name: string
  ): Promise<{
    relationship: any;
    name: string;
    relationshipType: string;
  }> {
    const response = await apiCall<
      Array<{
        relationship: any;
        name: string;
        relationshipType: string;
      }>
    >("/Relationship/_getRelationshipByName", { owner, name });
    if (!response[0]) {
      throw new Error("Relationship not found");
    }
    return response[0];
  },
};

/**
 * Notes API
 */
export const notesApi = {
  /**
   * Create a new note
   * POST /api/Notes/createNote
   */
  async createNote(
    owner: User,
    relationship: any,
    title: string,
    content: string
  ): Promise<any> {
    const response = await apiCall<ApiResponse<any>>("/Notes/createNote", {
      owner,
      relationship,
      title,
      content,
    });
    if (!response.note) {
      throw new Error("Failed to create note");
    }
    return response.note;
  },

  /**
   * Update a note
   * POST /api/Notes/updateNote
   */
  async updateNote(note: any, title?: string, content?: string): Promise<any> {
    const body: any = { note };
    if (title !== undefined) {
      body.title = title;
    }
    if (content !== undefined) {
      body.content = content;
    }
    const response = await apiCall<ApiResponse<any>>("/Notes/updateNote", body);
    if (!response.note) {
      throw new Error("Failed to update note");
    }
    return response.note;
  },

  /**
   * Delete a note
   * POST /api/Notes/deleteNote
   */
  async deleteNote(note: any): Promise<void> {
    await apiCall("/Notes/deleteNote", { note });
  },

  /**
   * Get all notes for a relationship
   * POST /api/Notes/_getNotesByRelationship
   */
  async getNotesByRelationship(
    owner: User,
    relationship: any
  ): Promise<
    Array<{
      note: any;
      title: string;
      content: string;
    }>
  > {
    const response = await apiCall<
      Array<{
        note: any;
        title: string;
        content: string;
      }>
    >("/Notes/_getNotesByRelationship", { owner, relationship });
    return response;
  },
};

/**
 * MemoryGallery API
 */
export const memoryGalleryApi = {
  /**
   * Upload an image for a relationship
   * POST /api/MemoryGallery/uploadImage
   */
  async uploadImage(
    file: File,
    owner: User,
    relationship: any
  ): Promise<{ uploadDate: Date; imageUrl: string }> {
    const formData = new FormData();
    formData.append("file", file); // File object from input

    // Send owner - use ID if available, otherwise send the whole object as JSON string
    const ownerValue = owner.id || owner.username || JSON.stringify(owner);
    formData.append("owner", ownerValue);

    // Send relationship - use ID if available, otherwise send the whole object as JSON string
    const relationshipValue = relationship.id || JSON.stringify(relationship);
    formData.append("relationship", relationshipValue);

    const url = `${API_BASE_URL}/MemoryGallery/uploadImage`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      // Note: Don't set Content-Type header - browser will set it with boundary
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      const errorMessage =
        result.error || `Upload failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return {
      uploadDate: new Date(result.uploadDate),
      imageUrl: result.imageUrl,
    };
  },

  /**
   * Get all images for a relationship
   * POST /api/MemoryGallery/_getImagesByRelationship
   */
  async getImagesByRelationship(
    owner: User,
    relationship: any
  ): Promise<
    Array<{
      imageUrl: string;
      uploadDate: string;
    }>
  > {
    const url = `${API_BASE_URL}/MemoryGallery/_getImagesByRelationship`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ owner, relationship }),
    });

    const images = await response.json();

    if (!response.ok) {
      const errorMessage =
        images &&
        typeof images === "object" &&
        "error" in images &&
        typeof images.error === "string"
          ? images.error
          : `Failed to fetch images with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return images; // Array of { imageUrl, uploadDate }
  },
};

/**
 * Occasions API (backed by OccasionConcept)
 */
export const occasionsApi = {
  /**
   * Create a new occasion
   * POST /api/Occasion/createOccasion
   */
  async createOccasion(
    owner: User,
    person: string,
    occasionType: string,
    date: Date
  ): Promise<any> {
    const response = await apiCall<ApiResponse<any>>(
      "/Occasion/createOccasion",
      {
        owner,
        person,
        occasionType,
        date: date.toISOString(),
      }
    );
    if (!response.occasion) {
      throw new Error("Failed to create occasion");
    }
    return response.occasion;
  },

  /**
   * Update an occasion
   * POST /api/Occasion/updateOccasion
   */
  async updateOccasion(
    occasion: any,
    person?: string,
    occasionType?: string,
    date?: Date
  ): Promise<any> {
    const body: any = { occasion };
    if (person !== undefined) {
      body.person = person;
    }
    if (occasionType !== undefined) {
      body.occasionType = occasionType;
    }
    if (date !== undefined) {
      body.date = date.toISOString();
    }

    const response = await apiCall<ApiResponse<any>>(
      "/Occasion/updateOccasion",
      body
    );
    if (!response.occasion) {
      throw new Error("Failed to update occasion");
    }
    return response.occasion;
  },

  /**
   * Delete an occasion
   * POST /api/Occasion/deleteOccasion
   */
  async deleteOccasion(occasion: any): Promise<void> {
    await apiCall("/Occasion/deleteOccasion", { occasion });
  },

  /**
   * Get all occasions for a user
   * POST /api/Occasion/_getOccasions
   */
  async getOccasions(owner: User): Promise<
    Array<{
      occasion: any;
      person: string;
      occasionType: string;
      date: string;
    }>
  > {
    const response = await apiCall<
      Array<{
        occasion: any;
        person: string;
        occasionType: string;
        date: string;
      }>
    >("/Occasion/_getOccasions", { owner });
    return response;
  },

  /**
   * Get all occasions for a user for a specific person
   * POST /api/Occasion/_getOccasionsByPerson
   */
  async getOccasionsByPerson(
    owner: User,
    person: string
  ): Promise<
    Array<{
      occasion: any;
      occasionType: string;
      date: string;
    }>
  > {
    const response = await apiCall<
      Array<{
        occasion: any;
        occasionType: string;
        date: string;
      }>
    >("/Occasion/_getOccasionsByPerson", { owner, person });
    return response;
  },
};

/**
 * Task API (backed by TaskConcept)
 */
export const tasksApi = {
  /**
   * Create a new task for a user
   * POST /api/Task/createTask
   */
  async createTask(owner: User, description: string): Promise<any> {
    const response = await apiCall<ApiResponse<any>>("/Task/createTask", {
      owner,
      description,
    });
    if (!response.task) {
      throw new Error("Failed to create task");
    }
    return response.task;
  },

  /**
   * Update a task's description
   * POST /api/Task/updateTaskDescription
   */
  async updateTaskDescription(task: any, description: string): Promise<any> {
    const body: any = { task, description };
    const response = await apiCall<ApiResponse<any>>(
      "/Task/updateTaskDescription",
      body
    );
    if (!response.task) {
      throw new Error("Failed to update task");
    }
    return response.task;
  },

  /**
   * Delete a task
   * POST /api/Task/deleteTask
   */
  async deleteTask(task: any): Promise<void> {
    await apiCall("/Task/deleteTask", { task });
  },

  /**
   * Get all tasks for a user
   * POST /api/Task/_getTasks
   */
  async getTasks(owner: User): Promise<
    Array<{
      task: any;
      description: string;
    }>
  > {
    const response = await apiCall<
      Array<{
        task: any;
        description: string;
      }>
    >("/Task/_getTasks", { owner });
    return response;
  },
};

/**
 * TaskChecklist API (backed by TaskChecklistConcept)
 */
export const taskChecklistApi = {
  /**
   * Add a task to the checklist for a user
   * POST /api/TaskChecklist/addTask
   */
  async addTask(owner: User, task: any): Promise<any> {
    const response = await apiCall<ApiResponse<any>>("/TaskChecklist/addTask", {
      owner,
      task,
    });
    if (!response.entry) {
      throw new Error("Failed to add task to checklist");
    }
    return response.entry;
  },

  /**
   * Remove a task from the checklist for a user
   * POST /api/TaskChecklist/removeTask
   */
  async removeTask(owner: User, task: any): Promise<void> {
    await apiCall("/TaskChecklist/removeTask", { owner, task });
  },

  /**
   * Mark a task as complete in the checklist
   * POST /api/TaskChecklist/markComplete
   */
  async markComplete(owner: User, task: any): Promise<void> {
    await apiCall("/TaskChecklist/markComplete", { owner, task });
  },

  /**
   * Mark a task as incomplete in the checklist
   * POST /api/TaskChecklist/markIncomplete
   */
  async markIncomplete(owner: User, task: any): Promise<void> {
    await apiCall("/TaskChecklist/markIncomplete", { owner, task });
  },

  /**
   * Get all checklist entries for a user
   * POST /api/TaskChecklist/_getChecklist
   */
  async getChecklist(owner: User): Promise<
    Array<{
      task: any;
      completed: boolean;
    }>
  > {
    const response = await apiCall<
      Array<{
        task: any;
        completed: boolean;
      }>
    >("/TaskChecklist/_getChecklist", { owner });
    return response;
  },

  /**
   * Get all completed tasks for a user
   * POST /api/TaskChecklist/_getCompletedTasks
   */
  async getCompletedTasks(owner: User): Promise<any[]> {
    const response = await apiCall<any[]>("/TaskChecklist/_getCompletedTasks", {
      owner,
    });
    return response;
  },

  /**
   * Get all incomplete tasks for a user
   * POST /api/TaskChecklist/_getIncompleteTasks
   */
  async getIncompleteTasks(owner: User): Promise<any[]> {
    const response = await apiCall<any[]>(
      "/TaskChecklist/_getIncompleteTasks",
      { owner }
    );
    return response;
  },
};

/**
 * SuggestionEngine API (backed by SuggestionEngineConcept)
 */
export const suggestionEngineApi = {
  /**
   * Generate 3 gift/gesture suggestions for a person using aggregated shared notes as context.
   * POST /api/SuggestionEngine/generateGiftSuggestions
   */
  async generateGiftSuggestions(
    owner: User,
    context: Record<string, any>
  ): Promise<
    Array<{
      suggestion: any;
      content: string;
    }>
  > {
    const response = await apiCall<{
      suggestions?: Array<{ suggestion: any; content: string }>;
    }>("/SuggestionEngine/generateGiftSuggestions", {
      owner,
      context,
    });

    if (!response.suggestions || !Array.isArray(response.suggestions)) {
      throw new Error("Failed to generate gift suggestions");
    }

    return response.suggestions;
  },

  /**
   * Get all previously generated suggestions for an owner.
   * POST /api/SuggestionEngine/_getSuggestions
   */
  async getSuggestions(owner: User): Promise<
    Array<{
      suggestion: any;
      content: string;
      generatedAt: string | Date;
    }>
  > {
    const response = await apiCall<
      Array<{
        suggestion: any;
        content: string;
        generatedAt: string | Date;
      }>
    >("/SuggestionEngine/_getSuggestions", {
      owner,
    });
    return response;
  },
};

/**
 * Session management
 */
export const sessionManager = {
  /**
   * Store user session
   */
  setUser(user: User): void {
    localStorage.setItem("momento_user", JSON.stringify(user));
  },

  /**
   * Store backend session token (if provided by UserAuth)
   */
  setSession(session: string): void {
    localStorage.setItem("momento_session", session);
  },

  /**
   * Get current user from session
   */
  getUser(): User | null {
    const userStr = localStorage.getItem("momento_user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  },

  /**
   * Clear user session
   */
  clearUser(): void {
    localStorage.removeItem("momento_user");
    localStorage.removeItem("momento_session");
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.getUser() !== null;
  },

  /**
   * Get current backend session token (if any)
   */
  getSession(): string | null {
    return localStorage.getItem("momento_session");
  },
};
