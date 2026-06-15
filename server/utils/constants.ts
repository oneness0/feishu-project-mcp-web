import type { H3Event } from "h3";

/** 授权进行中使用的临时 httpOnly Cookie 名称（仅存活于后端域内的 popup 流程）。 */
export const TEMP_COOKIE = {
  pkceVerifier: "fs_pkce_verifier",
  state: "fs_oauth_state",
  clientId: "fs_client_id",
  returnOrigin: "fs_return_origin",
} as const;

export function tempCookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getRequestProtocol(event) === "https",
    path: "/",
    maxAge: 60 * 10,
  };
}

export function clearTempCookies(event: H3Event) {
  const opts = { ...tempCookieOptions(event), maxAge: 0 };
  setCookie(event, TEMP_COOKIE.pkceVerifier, "", opts);
  setCookie(event, TEMP_COOKIE.state, "", opts);
  setCookie(event, TEMP_COOKIE.clientId, "", opts);
  setCookie(event, TEMP_COOKIE.returnOrigin, "", opts);
}

/** 默认回调地址：未配置 OAUTH_REDIRECT_URI 时，按当前请求推断。 */
export function resolveRedirectUri(event: H3Event, configured: string): string {
  if (configured) return configured;
  const proto = getRequestProtocol(event);
  const host = getRequestHost(event);
  return `${proto}://${host}/api/oauth/callback`;
}
