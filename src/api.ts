/**
 * API Service for Momento Backend
 * 
 * All endpoints use POST method with application/json content type.
 * Base URL: defaults to /api, can be overridden with VITE_API_BASE_URL environment variable
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

interface ApiResponse<T> {
  [key: string]: T
}

interface User {
  id?: string
  username: string
  [key: string]: any
}

interface Profile {
  id?: string
  user: User
  name: string
  [key: string]: any
}

/**
 * Generic API call function
 */
async function apiCall<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    // Handle network errors (connection refused, CORS, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Cannot connect to backend server. Please make sure the backend is running and accessible.'
      )
    }
    throw error
  }

  // Handle response body - try to parse as JSON
  let data: any = {}
  const contentType = response.headers.get('content-type')
  const hasJsonContent = contentType && contentType.includes('application/json')
  
  // Try to parse response as JSON (even if content-type isn't set, backend might return JSON)
  try {
    const text = await response.text()
    if (text && text.trim()) {
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        // If it looks like JSON but parsing failed, or if content-type says JSON
        if (hasJsonContent) {
          // Backend said it's JSON but it's not valid - this is a backend issue
          if (!response.ok) {
            throw new Error(
              `Server error (${response.status}): Invalid JSON response. ${response.statusText}`
            )
          }
          throw new Error('Invalid JSON response from server')
        }
        // Not JSON, that's okay - might be plain text error
        if (!response.ok) {
          throw new Error(
            `Request failed with status ${response.status}: ${text || response.statusText}`
          )
        }
      }
    }
  } catch (error) {
    // If we already threw an error above, re-throw it
    if (error instanceof Error) {
      throw error
    }
    // Otherwise, handle the case where text() itself fails
    if (!response.ok) {
      throw new Error(
        `Request failed with status ${response.status}: ${response.statusText}`
      )
    }
  }

  // Check for HTTP errors (4xx, 5xx)
  if (!response.ok) {
    // Check if this might be a proxy connection error (empty response with 500)
    if (response.status === 500 && (!data || Object.keys(data).length === 0)) {
      throw new Error(
        'Cannot connect to backend server. Please make sure the backend is running on the configured port (default: http://localhost:3000). Check your .env file or vite.config.ts for the VITE_BACKEND_URL setting.'
      )
    }
    
    // Try to extract error message from response
    let errorMessage = `Request failed with status ${response.status}`
    
    if (data && typeof data === 'object') {
      // Check for common error message fields
      if ('error' in data && typeof data.error === 'string') {
        errorMessage = data.error
      } else if ('message' in data && typeof data.message === 'string') {
        errorMessage = data.message
      } else if ('detail' in data && typeof data.detail === 'string') {
        errorMessage = data.detail
      } else {
        errorMessage = `${errorMessage}: ${response.statusText}`
      }
    } else {
      errorMessage = `${errorMessage}: ${response.statusText}`
    }
    
    throw new Error(errorMessage)
  }

  // Check for API-level errors (error field in response even when status is 200)
  if ('error' in data && data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'An error occurred'
    throw new Error(errorMessage)
  }

  return data as T
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
    const response = await apiCall<ApiResponse<User>>('/UserAuth/register', {
      username,
      password,
    })
    if (!response.user) {
      throw new Error('Failed to register user')
    }
    return response.user
  },

  /**
   * Login a user
   * POST /api/UserAuth/login
   */
  async login(username: string, password: string): Promise<User> {
    const response = await apiCall<ApiResponse<User>>('/UserAuth/login', {
      username,
      password,
    })
    if (!response.user) {
      throw new Error('Failed to login user')
    }
    return response.user
  },

  /**
   * Get user by username
   * POST /api/UserAuth/_getUserByUsername
   */
  async getUserByUsername(username: string): Promise<User> {
    const response = await apiCall<Array<ApiResponse<User>>>(
      '/UserAuth/_getUserByUsername',
      { username }
    )
    if (!response[0]?.user) {
      throw new Error('User not found')
    }
    return response[0].user
  },
}

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
      '/Profile/createProfile',
      {
        user,
        name,
      }
    )
    if (!response.profile) {
      throw new Error('Failed to create profile')
    }
    return response.profile
  },

  /**
   * Update profile name
   * POST /api/Profile/updateName
   */
  async updateName(user: User, name: string): Promise<void> {
    await apiCall('/Profile/updateName', {
      user,
      name,
    })
  },

  /**
   * Get profile information
   * POST /api/Profile/_getProfile
   */
  async getProfile(user: User): Promise<{ name: string; email: string }> {
    // Send user ID if available, otherwise send the whole user object
    const userPayload = user.id || user.username || user
    
    const response = await apiCall<any>('/Profile/_getProfile', { user: userPayload })
    console.log('Profile API response:', response)
    
    // Handle different response formats
    let profile: { name: string; email: string } | null = null
    
    // If response is an array, take the first element
    if (Array.isArray(response)) {
      profile = response[0] || null
    }
    // If response is already an object with name and email
    else if (response && typeof response === 'object' && 'name' in response) {
      profile = response as { name: string; email: string }
    }
    // If response might be wrapped in a data field
    else if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
      profile = response.data[0] || null
    }
    
    if (!profile || !profile.name) {
      console.error('Profile response format:', response)
      throw new Error('Profile not found or name is missing')
    }
    
    return profile
  },

  /**
   * Get profile name only
   * POST /api/Profile/_getName
   */
  async getName(user: User): Promise<string> {
    const response = await apiCall<Array<{ name: string }>>(
      '/Profile/_getName',
      { user }
    )
    if (!response[0]?.name) {
      throw new Error('Profile name not found')
    }
    return response[0].name
  },
}

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
      '/Relationship/createRelationship',
      {
        owner,
        name,
        relationshipType,
      }
    )
    if (!response.relationship) {
      throw new Error('Failed to create relationship')
    }
    return response.relationship
  },

  /**
   * Get all relationships for a user
   * POST /api/Relationship/_getRelationships
   */
  async getRelationships(owner: User): Promise<
    Array<{
      relationship: any
      name: string
      relationshipType: string
    }>
  > {
    const response = await apiCall<
      Array<{
        relationship: any
        name: string
        relationshipType: string
      }>
    >('/Relationship/_getRelationships', { owner })
    return response
  },

  /**
   * Get relationship by name
   * POST /api/Relationship/_getRelationshipByName
   */
  async getRelationshipByName(owner: User, name: string): Promise<{
    relationship: any
    name: string
    relationshipType: string
  }> {
    const response = await apiCall<
      Array<{
        relationship: any
        name: string
        relationshipType: string
      }>
    >('/Relationship/_getRelationshipByName', { owner, name })
    if (!response[0]) {
      throw new Error('Relationship not found')
    }
    return response[0]
  },
}

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
    const response = await apiCall<ApiResponse<any>>('/Notes/createNote', {
      owner,
      relationship,
      title,
      content,
    })
    if (!response.note) {
      throw new Error('Failed to create note')
    }
    return response.note
  },

  /**
   * Update a note
   * POST /api/Notes/updateNote
   */
  async updateNote(
    note: any,
    title?: string,
    content?: string
  ): Promise<any> {
    const body: any = { note }
    if (title !== undefined) {
      body.title = title
    }
    if (content !== undefined) {
      body.content = content
    }
    const response = await apiCall<ApiResponse<any>>('/Notes/updateNote', body)
    if (!response.note) {
      throw new Error('Failed to update note')
    }
    return response.note
  },

  /**
   * Delete a note
   * POST /api/Notes/deleteNote
   */
  async deleteNote(note: any): Promise<void> {
    await apiCall('/Notes/deleteNote', { note })
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
      note: any
      title: string
      content: string
    }>
  > {
    const response = await apiCall<
      Array<{
        note: any
        title: string
        content: string
      }>
    >('/Notes/_getNotesByRelationship', { owner, relationship })
    return response
  },
}

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
    const formData = new FormData()
    formData.append('file', file) // File object from input
    
    // Send owner - use ID if available, otherwise send the whole object as JSON string
    const ownerValue = owner.id || owner.username || JSON.stringify(owner)
    formData.append('owner', ownerValue)
    
    // Send relationship - use ID if available, otherwise send the whole object as JSON string
    const relationshipValue = relationship.id || JSON.stringify(relationship)
    formData.append('relationship', relationshipValue)

    const url = `${API_BASE_URL}/MemoryGallery/uploadImage`
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Note: Don't set Content-Type header - browser will set it with boundary
    })

    const result = await response.json()
    
    if (!response.ok || result.error) {
      const errorMessage = result.error || `Upload failed with status ${response.status}`
      throw new Error(errorMessage)
    }

    return {
      uploadDate: new Date(result.uploadDate),
      imageUrl: result.imageUrl,
    }
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
      imageUrl: string
      uploadDate: string
    }>
  > {
    const url = `${API_BASE_URL}/MemoryGallery/_getImagesByRelationship`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, relationship }),
    })

    const images = await response.json()
    
    if (!response.ok) {
      const errorMessage = 
        (images && typeof images === 'object' && 'error' in images && typeof images.error === 'string')
          ? images.error
          : `Failed to fetch images with status ${response.status}`
      throw new Error(errorMessage)
    }

    return images // Array of { imageUrl, uploadDate }
  },
}

/**
 * Session management
 */
export const sessionManager = {
  /**
   * Store user session
   */
  setUser(user: User): void {
    localStorage.setItem('momento_user', JSON.stringify(user))
  },

  /**
   * Get current user from session
   */
  getUser(): User | null {
    const userStr = localStorage.getItem('momento_user')
    if (!userStr) return null
    try {
      return JSON.parse(userStr) as User
    } catch {
      return null
    }
  },

  /**
   * Clear user session
   */
  clearUser(): void {
    localStorage.removeItem('momento_user')
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.getUser() !== null
  },
}

