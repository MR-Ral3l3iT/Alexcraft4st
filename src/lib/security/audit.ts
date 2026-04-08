type AuditLevel = "info" | "warn" | "error";

export function auditLog(level: AuditLevel, action: string, data: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    action,
    ...data
  };
  // Replace with external logger in production.
  console[level](`[AUDIT] ${JSON.stringify(payload)}`);
}
