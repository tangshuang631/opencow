export interface AuditEventInput {
  readonly module: string;
  readonly source: string;
  readonly summary: string;
  readonly detail: string;
}

export interface AuditEvent extends AuditEventInput {
  readonly timestamp: string;
}

export interface AuditClock {
  now(): string;
}
