import type { AuthClock } from "../../domain-services/auth-clock.port.js";

/** Controllable clock for deterministic lockout/expiry tests. */
export class FixedAuthClock implements AuthClock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = date;
  }
}
