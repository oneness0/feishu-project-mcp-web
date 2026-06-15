import type { H3Event } from "h3";
import { randomToken } from "./feishuOauth";
import type { TokenResponse } from "./feishuOauth";

/**
 * 简单的内存会话存储：opaque sessionToken -> 真实飞书凭证。
 * 真实 access_token/refresh_token 永不下发给前端，前端只持有 sessionToken。
 *
 * 注意：内存存储仅适合单实例/开发环境。生产请替换为 Redis 等共享存储。
 */
export interface Session {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  expiresAt?: number; // epoch ms
  createdAt: number;
}

export async function createSession(data: {
  token: TokenResponse;
  clientId: string;
}): Promise<string> {
  const sessionToken = randomToken(32);
  const sessionData: Session = {
    accessToken: data.token.access_token,
    refreshToken: data.token.refresh_token,
    clientId: data.clientId,
    expiresAt: data.token.expires_in ? Date.now() + data.token.expires_in * 1000 : undefined,
    createdAt: Date.now(),
  };
  await useStorage("sessions").setItem(sessionToken, sessionData);
  return sessionToken;
}

export async function getMcpSession(sessionToken: string | undefined): Promise<Session | undefined> {
  if (!sessionToken) return undefined;
  const data = await useStorage("sessions").getItem<Session>(sessionToken);
  return data ?? undefined;
}

export async function updateMcpSession(sessionToken: string, token: TokenResponse): Promise<void> {
  const s = await getMcpSession(sessionToken);
  if (!s) return;
  s.accessToken = token.access_token;
  if (token.refresh_token) s.refreshToken = token.refresh_token;
  s.expiresAt = token.expires_in ? Date.now() + token.expires_in * 1000 : undefined;
  await useStorage("sessions").setItem(sessionToken, s);
}

export async function deleteSession(sessionToken: string | undefined): Promise<void> {
  if (sessionToken) {
    await useStorage("sessions").removeItem(sessionToken);
  }
}

/** 从请求头 Authorization: Bearer <sessionToken> 取出会话令牌。 */
export function getSessionTokenFromEvent(event: H3Event): string | undefined {
  const auth = getHeader(event, "authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  // 兼容 query 传参（部分场景前端难以加头时）
  const q = getQuery(event).session_token;
  return typeof q === "string" ? q : undefined;
}
