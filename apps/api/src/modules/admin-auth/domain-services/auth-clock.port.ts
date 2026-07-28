export const AUTH_CLOCK = "AUTH_CLOCK";

/**
 * Injectable clock so Use Case unit tests can control "now" without
 * monkey-patching the global Date constructor.
 */
export interface AuthClock {
  now(): Date;
}
