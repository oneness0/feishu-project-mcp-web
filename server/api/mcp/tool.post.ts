import { callMcpWithSession, SessionExpiredError } from "../../utils/callWithSession";
import { getMcpSession, getSessionTokenFromEvent } from "../../utils/sessionStore";
import { readonlyRejectReason } from "../../utils/policy";

/**
 * 调用单个 MCP 工具（tools/call 包装）。
 * Body: { name: string, arguments?: object }
 * 例：{ "name": "get_workitem_brief", "arguments": { "work_item_id": "...", "project_key": "..." } }
 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  if (!sessionToken || !(await getMcpSession(sessionToken))) {
    setResponseStatus(event, 401);
    return { error: "未连接，请先完成授权" };
  }

  const body = await readBody<{ name?: string; arguments?: Record<string, unknown> }>(event);
  if (!body?.name) {
    setResponseStatus(event, 400);
    return { error: "缺少 name 字段" };
  }

  const rejected = readonlyRejectReason(body.name);
  if (rejected) {
    setResponseStatus(event, 403);
    return { error: rejected };
  }

  try {
    const result = await callMcpWithSession(sessionToken, "tools/call", {
      name: body.name,
      arguments: body.arguments ?? {},
    });
    return result;
  } catch (e) {
    if (e instanceof SessionExpiredError) {
      setResponseStatus(event, 401);
      return { error: e.message };
    }
    setResponseStatus(event, 500);
    return { error: e instanceof Error ? e.message : String(e) };
  }
});
