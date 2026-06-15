import { callMcpWithSession, SessionExpiredError } from "../../utils/callWithSession";
import { getMcpSession, getSessionTokenFromEvent } from "../../utils/sessionStore";

/** 列出可用工具（tools/list）。 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  if (!sessionToken || !(await getMcpSession(sessionToken))) {
    setResponseStatus(event, 401);
    return { error: "未连接，请先完成授权" };
  }

  try {
    const result = await callMcpWithSession(sessionToken, "tools/list");
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
