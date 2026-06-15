import { inject, type InjectionKey, type Ref } from "vue";
import type { FeishuMcpClient } from "~~/sdk/src";

export interface McpContext {
  client: Ref<FeishuMcpClient | null>;
  connected: Ref<boolean>;
  expiresAt: Ref<number | undefined>;
  readonly: Ref<boolean>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const McpContextKey = Symbol("McpContext") as InjectionKey<McpContext>;

export function useMcpContext() {
  const context = inject(McpContextKey);
  if (!context) {
    throw new Error("useMcpContext must be used within an McpProvider");
  }
  return context;
}
