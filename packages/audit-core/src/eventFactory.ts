import type { AuditClock, AuditEvent, AuditEventInput } from "./types.js";

const defaultClock: AuditClock = {
  now: () => new Date().toISOString()
};

export function createAuditEvent(input: AuditEventInput, clock: AuditClock = defaultClock): AuditEvent {
  return {
    ...input,
    timestamp: clock.now()
  };
}
