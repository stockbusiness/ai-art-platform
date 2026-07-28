import { Injectable } from "@nestjs/common";

import type { AuthClock } from "../domain-services/auth-clock.port.js";

@Injectable()
export class SystemAuthClockService implements AuthClock {
  now(): Date {
    return new Date();
  }
}
