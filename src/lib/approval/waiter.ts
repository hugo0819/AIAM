import { bus, EVENT_TOPICS } from "@/lib/eventBus";
import type { ApprovalRequestData } from "@/types/events";
import { markTimeout } from "./manager";

/**
 * 等待某个 ApprovalRequest 被审批（或超时）。
 * 用 EventBus 的 "approval" topic 做通知中枢。
 */
export function waitForApproval(
  approvalId: string,
  timeoutMs: number = 60_000,
): Promise<"APPROVED" | "REJECTED" | "TIMEOUT"> {
  return new Promise((resolve) => {
    let settled = false;

    const onEvent = (payload: ApprovalRequestData) => {
      if (payload.id !== approvalId) return;
      if (payload.status === "PENDING") return;
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(timer);
      resolve(payload.status as "APPROVED" | "REJECTED" | "TIMEOUT");
    };

    const unsubscribe = bus.subscribe<ApprovalRequestData>(EVENT_TOPICS.approval, onEvent);

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      await markTimeout(approvalId).catch(() => {});
      resolve("TIMEOUT");
    }, timeoutMs);
  });
}
