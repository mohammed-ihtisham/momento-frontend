<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import { sessionManager, profileApi, collaboratorsApi } from '../api'

const router = useRouter()

const currentUser = ref<any>(null)
const userProfile = ref<{
  name: string
  email: string
  username?: string
} | null>(null)
const showUserMenu = ref(false)
const showInvitesMenu = ref(false)
const invitations = ref<
  Array<{
    id: string
    invitePayload: any
    toUsername: string
    createdAt: string
    status: 'pending' | 'accepted' | 'error'
    errorMessage?: string
  }>
>([])

// Get user's first name from profile
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return firstName || userProfile.value.name || userProfile.value.username || 'User'
  }
  return userProfile.value?.username || currentUser.value?.username || 'User'
})

const pendingInvitationsCount = computed(
  () => invitations.value.filter((i) => i.status === 'pending').length
)

// Load user profile
const loadUserProfile = async () => {
  const savedUser = sessionManager.getUser()
  if (savedUser) {
    currentUser.value = savedUser
    try {
      const profile = await profileApi.getProfile(savedUser)
      if (profile && profile.name) {
        userProfile.value = profile
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }
}

// Load incoming invitations
const loadInvitations = async () => {
  try {
    const backendInvites = await collaboratorsApi.getIncomingInvites()
    const invitesWithUsernames = await Promise.all(
      (backendInvites || [])
        .filter((inv: any) => inv.status === 'pending')
        .map(async (inv: any) => {
          const rawInvite = inv.invite
          const sender = inv.sender
          let username = 'someone'

          if (typeof sender === 'string') {
            try {
              const profile = await profileApi.getProfile({
                id: sender,
                username: sender,
              })
              username = profile.username || profile.name || sender
            } catch (error) {
              console.warn('Failed to look up sender profile:', sender, error)
              username = sender
            }
          } else if (sender?.username) {
            username = sender.username
          } else if (sender?.name) {
            username = sender.name
          }

          return {
            id: String(rawInvite?.id ?? rawInvite ?? inv.id ?? ''),
            invitePayload: rawInvite,
            toUsername: username,
            createdAt: inv.createdAt,
            status: 'pending' as const,
          }
        })
    )

    invitations.value = invitesWithUsernames
  } catch (error) {
    console.error('Failed to load collaborator invitations:', error)
    invitations.value = []
  }
}

const handleAcceptInvite = async (invite: (typeof invitations.value)[number]) => {
  try {
    await collaboratorsApi.acceptInvite(invite.invitePayload ?? invite.id)
    invitations.value = invitations.value.filter((i) => i.id !== invite.id)
    // Emit event to reload data in child components
    window.dispatchEvent(new CustomEvent('invite-accepted'))
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
  }
}

const handleDeclineInvite = async (invite: (typeof invitations.value)[number]) => {
  try {
    await collaboratorsApi.declineInvite(invite.id)
    invitations.value = invitations.value.filter((i) => i.id !== invite.id)
  } catch (error: any) {
    console.error('Error declining invitation:', error)
  }
}

// Close menus when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
  if (!target.closest('.navbar-mail-wrapper')) {
    showInvitesMenu.value = false
  }
}

// Get greeting based on time of day
const getGreeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

// Handle logout
const handleLogout = () => {
  sessionManager.clearUser()
  currentUser.value = null
  userProfile.value = null
  router.replace('/')
}

onMounted(async () => {
  await loadUserProfile()
  await loadInvitations()
  document.addEventListener('click', handleClickOutside)
  
  // Listen for invite accepted events to reload invitations
  window.addEventListener('invite-accepted', loadInvitations)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('invite-accepted', loadInvitations)
})
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-content">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-content">
          <div class="header-greeting">
            <h1 class="greeting-text-main">
              {{ getGreeting }}, {{ getUserFirstName }}!
            </h1>
            <p class="greeting-text-sub">
              Never miss an important moment!
            </p>
          </div>
          <div class="header-actions">
            <div class="navbar-mail-wrapper">
              <button
                @click.stop="showInvitesMenu = !showInvitesMenu; showUserMenu = false"
                class="header-icon-button notification-button"
                :aria-expanded="showInvitesMenu"
                aria-label="Notifications"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span v-if="pendingInvitationsCount > 0" class="notification-badge">
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
                          invite.status === 'pending'
                            ? 'Pending'
                            : invite.status === 'accepted'
                            ? 'Accepted'
                            : 'Error'
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
                @click.stop="showUserMenu = !showUserMenu; showInvitesMenu = false"
                class="user-avatar-button"
                :aria-expanded="showUserMenu"
                aria-label="User menu"
              >
                <div class="user-avatar">
                  <span class="avatar-initial">
                    {{ getUserFirstName.charAt(0).toUpperCase() }}
                  </span>
                </div>
              </button>
              <div v-if="showUserMenu" class="user-menu-dropdown" @click.stop>
                <div class="user-menu-header">
                  <div class="user-menu-name">{{ getUserFirstName }}</div>
                  <div class="user-menu-email">{{ userProfile?.email || currentUser?.username }}</div>
                </div>
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

      <!-- Page Content -->
      <main class="page-content">
        <slot />
      </main>
    </div>
  </div>
</template>
