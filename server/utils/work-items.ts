import { callMcpWithSession } from "./callWithSession";
import pLimit from "p-limit";

/** MCP tools/call 返回体中 result.content[0].text 解析后的工作项对象 */
export function parseMcpContentText(raw: unknown): unknown {
  if (raw == null) {
    throw new Error("MCP 返回为空");
  }

  const root = raw as Record<string, unknown>;
  // 兼容已包一层 jsonrpc 或未包一层
  const result =
    (root.result as Record<string, unknown> | undefined) ??
    (root as Record<string, unknown>);

  const content = result?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("MCP 返回缺少 result.content");
  }

  const first = content[0] as { type?: string; text?: string } | undefined;
  const text = first?.text;
  if (text == null || text === "") {
    throw new Error("MCP 返回 content[0].text 为空");
  }

  if (typeof text === "string") {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("content[0].text 不是合法 JSON");
    }
  }

  return text;
}

export interface WorkItemInfoResult {
  workItemId: string;
  info: unknown;
}

export interface WorkItemInfoError {
  workItemId: string;
  error: string;
}

/**
 * 按工作项单号批量查询飞书项目工作项概况（get_workitem_brief）。
 * 纯数字单号按 work_item_id 查，否则按 name 查。
 */
export async function fetchWorkItemsByNos(
  sessionToken: string,
  projectKey: string,
  workItemIds: string[],
): Promise<{ items: WorkItemInfoResult[]; errors: WorkItemInfoError[] }> {
  const unique = [...new Set(workItemIds.map((s) => s.trim()).filter(Boolean))];
  const items: WorkItemInfoResult[] = [];
  const errors: WorkItemInfoError[] = [];

  const limit = pLimit(5);

  await Promise.all(
    unique.map((workItemId) => limit(async () => {
      try {
        const args: Record<string, unknown> = { project_key: projectKey };
        if (/^\d+$/.test(workItemId)) {
          args.work_item_id = workItemId;
        } else {
          args.name = workItemId;
        }
        const raw = await callMcpWithSession(sessionToken, "tools/call", {
          name: "get_workitem_brief",
          arguments: args,
        });
        const info = parseMcpContentText(raw);
        items.push({ workItemId, info });
      } catch (e) {
        errors.push({
          workItemId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })),
  );

  return { items, errors };
}
