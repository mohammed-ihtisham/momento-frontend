import { ref, computed } from "vue";

export type FeedbackVariant = "info" | "success" | "error" | "warning";

interface FeedbackOptions {
  message: string;
  title?: string;
  variant?: FeedbackVariant;
}

export function useFeedbackModal() {
  const isOpen = ref(false);
  const rawTitle = ref("");
  const message = ref("");
  const variant = ref<FeedbackVariant>("info");

  const computedTitle = computed(() => {
    if (rawTitle.value) return rawTitle.value;

    switch (variant.value) {
      case "error":
        return "Something went wrong";
      case "success":
        return "All set!";
      case "warning":
        return "Please review";
      case "info":
      default:
        return "Heads up";
    }
  });

  const open = (options: FeedbackOptions) => {
    message.value = options.message;
    variant.value = options.variant ?? "info";
    rawTitle.value = options.title ?? "";
    isOpen.value = true;
  };

  const openError = (messageText: string, title?: string) => {
    open({
      message: messageText,
      title: title ?? "Something went wrong",
      variant: "error",
    });
  };

  const openSuccess = (messageText: string, title?: string) => {
    open({
      message: messageText,
      title: title ?? "All set!",
      variant: "success",
    });
  };

  const close = () => {
    isOpen.value = false;
  };

  return {
    // state
    isFeedbackOpen: isOpen,
    feedbackTitle: computedTitle,
    feedbackMessage: message,
    feedbackVariant: variant,
    // actions
    openFeedbackModal: open,
    openErrorModal: openError,
    openSuccessModal: openSuccess,
    closeFeedbackModal: close,
  };
}


