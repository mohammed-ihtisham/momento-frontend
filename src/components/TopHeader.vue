<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { profileApi, sessionManager, collaboratorsApi } from '../api'

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

const pendingInvitationsCount = computed(
  () => invitations.value.filter((i) => i.status === 'pending').length
)

// Get user's first name
const getUserFirstName = computed(() => {
  if (userProfile.value?.name) {
    const firstName = userProfile.value.name.split(' ')[0]
    return (
      firstName ||
      userProfile.value.name ||
      userProfile.value.username ||
      'User'
    )
  }
  return userProfile.value?.username || currentUser.value?.username || 'User'
})

// Get greeting based on time of day
const getGreeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

// Load user profile
const loadProfile = async () => {
  const savedUser = sessionManager.getUser()
  if (!savedUser) return

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

// Load invitations
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

// Handle accept invite
const handleAcceptInvite = async (
  invite: (typeof invitations.value)[number]
) => {
  try {
    await collaboratorsApi.acceptInvite(invite.invitePayload ?? invite.id)
    invitations.value = invitations.value.filter((i) => i.id !== invite.id)
    // Emit event to refresh data in parent
    window.dispatchEvent(new CustomEvent('invitation-accepted'))
  } catch (error: any) {
    console.error('Error accepting invitation:', error)
    alert(
      error instanceof Error
        ? error.message
        : 'Failed to accept invitation. Please try again.'
    )
  }
}

// Handle decline invite
const handleDeclineInvite = async (
  invite: (typeof invitations.value)[number]
) => {
  try {
    await collaboratorsApi.declineInvite(invite.id)
    invitations.value = invitations.value.filter((i) => i.id !== invite.id)
  } catch (error: any) {
    console.error('Error declining invitation:', error)
    alert(
      error instanceof Error
        ? error.message
        : 'Failed to decline invitation. Please try again.'
    )
  }
}

// Handle click outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
  if (!target.closest('.navbar-mail-wrapper')) {
    showInvitesMenu.value = false
  }
}

onMounted(async () => {
  await loadProfile()
  await loadInvitations()
  document.addEventListener('click', handleClickOutside)
  
  // Listen for invitation accepted events
  window.addEventListener('invitation-accepted', loadInvitations)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('invitation-accepted', loadInvitations)
})
</script>

<template>
  <header class="top-header">
    <div class="header-content">
      <!-- Greeting -->
      <div class="header-greeting">
        <h1 class="greeting-text">
          {{ getGreeting }}, {{ getUserFirstName }}! Let's make today productive!
        </h1>
      </div>

      <!-- Right Actions -->
      <div class="header-actions">
        <!-- Invitations -->
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
            <span v-if="pendingInvitationsCount > 0" class="navbar-mail-badge">
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

        <!-- User Menu -->
        <div class="user-menu-wrapper">
          <button
            @click.stop="showUserMenu = !showUserMenu"
            class="user-menu-trigger"
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
            <button
              class="menu-item menu-item-danger"
              @click="() => { sessionManager.clearUser(); router.replace('/'); }"
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
</template>

<style scoped>
.top-header {
  position: fixed;
  top: 0;
  left: 260px;
  right: 0;
  height: 80px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  z-index: 90;
  padding: 0 2rem;
}

.header-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.header-greeting {
  flex: 1;
}

.greeting-text {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  letter-spacing: -0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.navbar-mail-wrapper {
  position: relative;
}

.navbar-mail-button {
  position: relative;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.625rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #6b7280;
}

.navbar-mail-button:hover {
  background: #f3f4f6;
  color: #111827;
}

.navbar-mail-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #ffffff;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0 4px;
}

.navbar-mail-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 400px;
  overflow-y: auto;
}

.navbar-mail-header {
  padding: 1rem;
  font-weight: 600;
  color: #111827;
  border-bottom: 1px solid #f3f4f6;
}

.navbar-mail-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
}

.navbar-mail-list {
  padding: 0.5rem;
}

.navbar-mail-item {
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: #f9fafb;
}

.navbar-mail-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.navbar-mail-username {
  font-weight: 500;
  color: #111827;
  font-size: 0.875rem;
}

.navbar-mail-status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-accepted {
  background: #d1fae5;
  color: #065f46;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.navbar-mail-date {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.navbar-mail-actions {
  display: flex;
  gap: 0.5rem;
}

.navbar-mail-action-accept,
.navbar-mail-action-decline {
  flex: 1;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.navbar-mail-action-accept {
  background: #d1fae5;
  color: #065f46;
}

.navbar-mail-action-accept:hover {
  background: #a7f3d0;
}

.navbar-mail-action-decline {
  background: #fee2e2;
  color: #991b1b;
}

.navbar-mail-action-decline:hover {
  background: #fecaca;
}

.user-menu-wrapper {
  position: relative;
}

.user-menu-trigger {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 1rem;
}

.avatar-initial {
  line-height: 1;
}

.user-menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  z-index: 1000;
  overflow: hidden;
}

.menu-item {
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #f9fafb;
  color: #111827;
}

.menu-item-danger {
  color: #ef4444;
}

.menu-item-danger:hover {
  background: #fef2f2;
  color: #dc2626;
}
</style>

