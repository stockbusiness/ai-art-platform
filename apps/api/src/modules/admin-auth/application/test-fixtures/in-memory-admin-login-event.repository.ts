import type {
  AdminLoginEventRepository,
  RecordAdminLoginEventInput,
} from "@ai-art-platform/domain";

/** In-memory AdminLoginEventRepository test double. */
export class InMemoryAdminLoginEventRepository implements AdminLoginEventRepository {
  readonly events: RecordAdminLoginEventInput[] = [];

  record(input: RecordAdminLoginEventInput): Promise<void> {
    this.events.push(input);
    return Promise.resolve();
  }

  countRecentFailuresByIpHash(ipHash: string, now: Date, windowSeconds: number): Promise<number> {
    const since = now.getTime() - windowSeconds * 1000;
    const count = this.events.filter(
      (event) => event.ipHash === ipHash && !event.success && event.now.getTime() >= since,
    ).length;
    return Promise.resolve(count);
  }
}
