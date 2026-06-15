import { getMcpSession, getSessionTokenFromEvent } from "../../utils/sessionStore";
import { isReadOnlyMode } from "../../utils/policy";

/** 查询会话状态。前端通过 Authorization: Bearer <sessionToken> 携带令牌。 */
export default defineEventHandler(async (event) => {
  const sessionToken = getSessionTokenFromEvent(event);
  const session = await getMcpSession(sessionToken);
  return {
    connected: Boolean(session),
    expiresAt: session?.expiresAt,
    hasRefreshToken: Boolean(session?.refreshToken),
    readonly: isReadOnlyMode(),
  };
});
