import type { SyncSnapshot } from "./sync.post";

/**
 * 同步快照读取接口：返回最近一次分支同步写入的快照。
 * 无需鉴权，供内网其他应用直接调用。
 *
 * Response: SyncSnapshot | { syncedAt: null; items: [] }
 */
export default defineEventHandler(async () => {
  const snapshot =
    await useStorage("work-items").getItem<SyncSnapshot>("latest");
  if (!snapshot) {
    return { syncedAt: null, items: [] };
  }
  return snapshot;
});
