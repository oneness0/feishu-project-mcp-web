import { callMcpWithSession, SessionExpiredError } from "../../utils/callWithSession";
import { getMcpSession, getSessionTokenFromEvent } from "../../utils/sessionStore";
import { readonlyRejectReason } from "../../utils/policy";

/**
 * 通用 JSON-RPC 透传：Body { method: string, params?: object }。
 * 适用于 SDK 调用任意 MCP 方法。
 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  if (!sessionToken || !(await getMcpSession(sessionToken))) {
    setResponseStatus(event, 401);
    return { error: "未连接，请先完成授权" };
  }

  const body = await readBody<{ method?: string; params?: Record<string, unknown> }>(event);
  if (!body?.method) {
    setResponseStatus(event, 400);
    return { error: "缺少 method 字段" };
  }

  // 通用通道里走 tools/call 的写工具同样受只读护栏拦截
  if (body.method === "tools/call") {
    const name = (body.params as { name?: string } | undefined)?.name ?? "";
    const rejected = readonlyRejectReason(name);
    if (rejected) {
      setResponseStatus(event, 403);
      return { error: rejected };
    }
  }

  try {
    const result = await callMcpWithSession(sessionToken, body.method, body.params ?? {});
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
