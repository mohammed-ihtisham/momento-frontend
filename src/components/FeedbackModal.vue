<script setup lang="ts">
import type { FeedbackVariant } from "../useFeedbackModal";

defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  variant?: FeedbackVariant;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const close = () => {
  emit("update:modelValue", false);
};
</script>

<template>
  <transition name="modal">
    <div
      v-if="modelValue"
      class="modal-overlay feedback-modal-overlay"
      @click.self="close"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="modal-container feedback-modal"
        :data-variant="variant || 'info'"
        @click.stop
      >
        <div class="modal-header feedback-modal-header">
          <h2 class="modal-title feedback-modal-title">
            <span class="feedback-modal-icon-wrapper" aria-hidden="true">
              <span
                v-if="variant === 'success'"
                class="feedback-modal-icon feedback-modal-icon-success"
              >
                ✓
              </span>
              <span
                v-else-if="variant === 'error'"
                class="feedback-modal-icon feedback-modal-icon-error"
              >
                !
              </span>
              <span
                v-else-if="variant === 'warning'"
                class="feedback-modal-icon feedback-modal-icon-warning"
              >
                !
              </span>
              <span
                v-else
                class="feedback-modal-icon feedback-modal-icon-info"
              >
                i
              </span>
            </span>
            <span>{{ title }}</span>
          </h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close message"
            @click="close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="modal-content feedback-modal-content">
          <p class="feedback-modal-message">
            {{ message }}
          </p>
        </div>

        <div class="modal-footer feedback-modal-footer">
          <div class="modal-footer-actions">
            <button
              type="button"
              class="modal-button modal-button-primary"
              @click="close"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.feedback-modal-overlay {
  backdrop-filter: blur(10px);
}

.feedback-modal {
  max-width: 420px;
}

.feedback-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feedback-modal-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.feedback-modal-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
}

.feedback-modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.feedback-modal[data-variant="success"] .feedback-modal-icon-wrapper {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.feedback-modal[data-variant="error"] .feedback-modal-icon-wrapper {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.feedback-modal[data-variant="warning"] .feedback-modal-icon-wrapper {
  background: rgba(245, 158, 11, 0.14);
  color: #d97706;
}

.feedback-modal[data-variant="info"] .feedback-modal-icon-wrapper {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.feedback-modal-content {
  padding-top: 0;
}

.feedback-modal-message {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #4b5563;
}

.feedback-modal-footer {
  justify-content: flex-end;
}
</style>


