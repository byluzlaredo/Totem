import { useCallback, useEffect, type RefObject } from "react";

export function useModalErrorScrollToTop(
  formRef: RefObject<HTMLFormElement | null>,
  submitAttempts: number,
  shouldScroll: boolean,
) {
  const scrollModalBodyToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const formElement = formRef.current;
    if (!(formElement instanceof HTMLElement)) {
      return;
    }

    const modalBody = formRef.current?.closest("[data-form-modal-body]");

    if (!(modalBody instanceof HTMLElement)) {
      const top = Math.max(
        window.scrollY + formElement.getBoundingClientRect().top - 24,
        0,
      );

      window.scrollTo({
        top,
        behavior,
      });
      return;
    }

    modalBody.scrollTo({
      top: 0,
      behavior,
    });
  }, [formRef]);

  useEffect(() => {
    if (!shouldScroll) return;
    scrollModalBodyToTop("smooth");
  }, [submitAttempts, shouldScroll, scrollModalBodyToTop]);

  return scrollModalBodyToTop;
}

interface UseModalErrorScrollToFieldOptions {
  behavior?: ScrollBehavior;
  offset?: number;
  focusTarget?: boolean;
}

export function useModalErrorScrollToField(
  formRef: RefObject<HTMLFormElement | null>,
  submitAttempts: number,
  shouldScroll: boolean,
  targetSelector: string,
  options: UseModalErrorScrollToFieldOptions = {},
) {
  const {
    behavior = "smooth",
    offset = 24,
    focusTarget = false,
  } = options;

  const scrollToField = useCallback(() => {
    const formElement = formRef.current;
    if (!(formElement instanceof HTMLElement)) {
      return;
    }

    const targetElement = formElement.querySelector<HTMLElement>(targetSelector);
    if (!(targetElement instanceof HTMLElement)) {
      return;
    }

    if (focusTarget && typeof targetElement.focus === "function") {
      targetElement.focus({ preventScroll: true });
    }

    const modalBody = formElement.closest("[data-form-modal-body]");

    if (modalBody instanceof HTMLElement) {
      const containerRect = modalBody.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const top = Math.max(
        modalBody.scrollTop + (targetRect.top - containerRect.top) - offset,
        0,
      );

      modalBody.scrollTo({ top, behavior });
      return;
    }

    const top = Math.max(
      window.scrollY + targetElement.getBoundingClientRect().top - offset,
      0,
    );

    window.scrollTo({ top, behavior });
  }, [behavior, focusTarget, formRef, offset, targetSelector]);

  useEffect(() => {
    if (!shouldScroll) {
      return;
    }

    scrollToField();
  }, [shouldScroll, submitAttempts, scrollToField]);

  return scrollToField;
}
