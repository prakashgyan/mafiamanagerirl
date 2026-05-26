/**
 * Extracts a human-readable message from an unknown error value.
 * Use this instead of the repeated `err instanceof Error ? err.message : "fallback"` pattern.
 */
export const getErrorMessage = (err: unknown, fallback = "An unexpected error occurred"): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
};
