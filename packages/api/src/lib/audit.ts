import { db } from "../db/index";
import { auditEvents } from "../db/schema";

type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

export async function logAuditEvent(
  userId: string | null,
  action: string,
  metadata: AuditMetadata = {},
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      userId,
      action,
      metadata,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "audit_log_failed",
        action,
        reason: err instanceof Error ? err.message : "unknown",
      }),
    );
  }
}
