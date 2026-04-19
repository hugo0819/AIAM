import { EventEmitter } from "node:events";

/**
 * 进程内事件总线，用于把 Audit / Approval / Risk 等事件广播给 SSE 订阅端。
 * 开发环境下挂 globalThis，热更新不丢订阅。
 */
export const EVENT_TOPICS = {
  audit: "audit",
  approval: "approval",
  risk: "risk",
} as const;

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS];

class Bus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }
  publish<T>(topic: EventTopic, payload: T) {
    this.emit(topic, payload);
  }
  subscribe<T>(topic: EventTopic, handler: (payload: T) => void) {
    this.on(topic, handler);
    return () => this.off(topic, handler);
  }
}

const g = globalThis as unknown as { __bus?: Bus };
export const bus = g.__bus ?? new Bus();
if (process.env.NODE_ENV !== "production") g.__bus = bus;
