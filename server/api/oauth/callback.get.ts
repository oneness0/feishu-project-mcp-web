import { discoverMetadata, exchangeCodeForToken } from "../../utils/feishuOauth";
import { TEMP_COOKIE, clearTempCookies, resolveRedirectUri } from "../../utils/constants";
import { createSession } from "../../utils/sessionStore";

/**
 * 授权回调（popup 流程）：校验 state -> 换 token -> 建会话 ->
 * 返回一个 HTML 页面，通过 postMessage 把 sessionToken 回传给宿主页(opener)并关闭弹窗。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string | undefined;
  const state = query.state as string | undefined;
  const oauthError = query.error as string | undefined;

  const expectedState = getCookie(event, TEMP_COOKIE.state);
  const verifier = getCookie(event, TEMP_COOKIE.pkceVerifier);
  const clientId = getCookie(event, TEMP_COOKIE.clientId);
  const returnOrigin = getCookie(event, TEMP_COOKIE.returnOrigin) || "";

  clearTempCookies(event);
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");

  if (oauthError) {
    return renderResult(returnOrigin, {
      ok: false,
      error: (query.error_description as string) || oauthError,
    });
  }

  if (!code || !state || !expectedState || state !== expectedState || !verifier || !clientId) {
    return renderResult(returnOrigin, {
      ok: false,
      error: "state 校验失败或缺少必要参数，请重新发起授权",
    });
  }

  try {
    const config = useRuntimeConfig();
    const redirectUri = resolveRedirectUri(event, config.oauthRedirectUri);
    const metadata = await discoverMetadata();
    const token = await exchangeCodeForToken({
      metadata,
      clientId,
      redirectUri,
      code,
      codeVerifier: verifier,
    });
    const sessionToken = await createSession({ token, clientId });
    return renderResult(returnOrigin, { ok: true, sessionToken });
  } catch (e) {
    return renderResult(returnOrigin, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

function renderResult(
  returnOrigin: string,
  payload: { ok: boolean; sessionToken?: string; error?: string },
): string {
  const target = returnOrigin ? JSON.stringify(returnOrigin) : '"*"';
  const data = JSON.stringify({ type: "feishu-mcp-auth", ...payload });
  const tip = payload.ok ? "授权成功，正在返回…" : `授权失败：${payload.error ?? ""}`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>飞书项目授权</title>
<style>body{font-family:-apple-system,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:#0b1020;color:#e6e9f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center;padding:24px 32px;border:1px solid #273049;border-radius:12px;background:#151b2e}</style>
</head><body>
<div class="box"><p>${tip}</p><p style="color:#9aa3b8;font-size:13px">可关闭此窗口</p></div>
<script>
(function(){
  var data = ${data};
  try { if (window.opener) { window.opener.postMessage(data, ${target}); } } catch (e) {}
  setTimeout(function(){ try { window.close(); } catch(e){} }, 300);
})();
</script>
</body></html>`;
}
