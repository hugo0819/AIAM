import { NextRequest } from "next/server";
import { bus, EVENT_TOPICS } from "@/lib/eventBus";
import type { AuditEventData } from "@/types/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE 审计事件流：订阅 bus，每有新事件就 data: {json}\n\n 推送给客户端。
 * 浏览器用 new EventSource("/api/audit/stream") 订阅。
 */
export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: AuditEventData) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // 已关闭
        }
      };

      controller.enqueue(encoder.encode(`: hello\n\n`));

      const unsubscribe = bus.subscribe<AuditEventData>(EVENT_TOPICS.audit, send);

      // 心跳保持连接（15s）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      _req.signal?.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
