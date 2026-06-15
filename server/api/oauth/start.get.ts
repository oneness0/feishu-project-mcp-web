import {
  buildAuthorizeUrl,
  createPkce,
  discoverMetadata,
  randomToken,
  resolveClientId,
} from "../../utils/feishuOauth";
import { TEMP_COOKIE, resolveRedirectUri, tempCookieOptions } from "../../utils/constants";

/**
 * 发起授权（popup 流程）：
 * 发现元数据 -> 解析 client_id（DCR 优先）-> 生成 PKCE/state ->
 * 把 verifier/state/client_id/return_origin 存入临时 httpOnly Cookie ->
 * 302 跳转飞书项目授权页。
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const redirectUri = resolveRedirectUri(event, config.oauthRedirectUri);
  const returnOrigin = (getQuery(event).return_origin as string) || "";

  const metadata = await discoverMetadata();
  const clientId = await resolveClientId(metadata, redirectUri, config.feishuMcpClientId);

  const { verifier, challenge } = createPkce();
  const state = randomToken(16);

  const opts = tempCookieOptions(event);
  setCookie(event, TEMP_COOKIE.pkceVerifier, verifier, opts);
  setCookie(event, TEMP_COOKIE.state, state, opts);
  setCookie(event, TEMP_COOKIE.clientId, clientId, opts);
  setCookie(event, TEMP_COOKIE.returnOrigin, returnOrigin, opts);

  const authorizeUrl = buildAuthorizeUrl({
    metadata,
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return sendRedirect(event, authorizeUrl, 302);
});
