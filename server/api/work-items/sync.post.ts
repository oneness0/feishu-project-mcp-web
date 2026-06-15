import { SessionExpiredError } from "../../utils/callWithSession";
import { fetchWorkItemsByNos } from "../../utils/work-items";
import {
  getMcpSession,
  getSessionTokenFromEvent,
} from "../../utils/sessionStore";

export interface SyncItem {
  branch: string;
  workItemId: string;
  info: unknown;
}

export interface SyncSnapshot {
  syncedAt: number;
  items: SyncItem[];
}

/**
 * 分支同步写入接口：接收前端已解析的分支→工作项单号映射，
 * 实时查询飞书工作项详情，将同步快照覆盖写入存储。
 *
 * Body: { items: Array<{ branch: string; workItemId: string }> }
 * Response: SyncSnapshot
 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  if (!sessionToken || !(await getMcpSession(sessionToken))) {
    setResponseStatus(event, 401);
    return { error: "未连接，请先完成飞书项目授权" };
  }

  const config = useRuntimeConfig();
  const projectKey = config.feishuProjectKey;
  if (!projectKey) {
    setResponseStatus(event, 500);
    return { error: "服务端未配置 FEISHU_PROJECT_KEY" };
  }

  const body = await readBody<{
    items?: Array<{ branch: string; workItemId: string }>;
  }>(event);
  const inputItems = body?.items;

  if (!Array.isArray(inputItems) || inputItems.length === 0) {
    setResponseStatus(event, 400);
    return { error: "items 必须为非空数组" };
  }

  const workItemIds = [
    ...new Set(inputItems.map((i) => i.workItemId).filter(Boolean)),
  ];

  try {
    const { items: results, errors } = await fetchWorkItemsByNos(
      sessionToken,
      projectKey,
      workItemIds,
    );

    const infoMap = new Map<string, unknown>();
    for (const { workItemId, info } of results) {
      infoMap.set(workItemId, info);
    }

    const syncItems: SyncItem[] = inputItems.map((i) => ({
      branch: i.branch,
      workItemId: i.workItemId,
      info: infoMap.get(i.workItemId) ?? null,
    }));

    const snapshot: SyncSnapshot = {
      syncedAt: Date.now(),
      items: syncItems,
    };

    await useStorage("work-items").setItem("latest", snapshot);

    return snapshot;
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      setResponseStatus(event, 401);
      return { error: e.message };
    }
    setResponseStatus(event, 500);
    return { error: e instanceof Error ? e.message : String(e) };
  }
});
