import { RefObject, useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside a modal/sheet dialog element.
 * Handles Tab/Shift+Tab cycling and Escape to close.
 *
 * @param ref - ref pointing at the dialog container element
 * @param onClose - called when the user presses Escape
 */
export const useModalFocusTrap = (ref: RefObject<HTMLElement | null>, onClose: () => void) => {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [ref, onClose]);
};
