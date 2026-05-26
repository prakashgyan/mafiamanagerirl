/**
 * Shared URL resolution utilities used by both the API client and the WebSocket hook.
 * Avoids duplicating stripTrailingSlash and the local-origin check.
 */

export const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const isLocalOrigin = (origin: string): boolean =>
  origin.includes("localhost") || origin.includes("127.0.0.1");
