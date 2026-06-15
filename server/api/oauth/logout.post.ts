import { deleteSession, getSessionTokenFromEvent } from "../../utils/sessionStore";

/** 断开连接：销毁服务端会话。 */
export default defineEventHandler(async (event) => {
  await deleteSession(getSessionTokenFromEvent(event));
  return { ok: true };
});
