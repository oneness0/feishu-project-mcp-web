import { defineEventHandler, getHeader, setResponseHeader, sendNoContent } from "h3";

declare const useRuntimeConfig: () => any;

/**
 * 为 /api/** 开启 CORS。
 * SDK 调用后端只用 Authorization: Bearer <sessionToken>（不依赖 Cookie），
 * 因此可安全地按来源回显 Access-Control-Allow-Origin。
 */
export default defineEventHandler((event) => {
  const path = event.path || "";
  if (!path.startsWith("/api/")) return;

  const { allowedOrigins } = useRuntimeConfig() as { allowedOrigins?: string };
  const origin = getHeader(event, "origin");

  let allowOrigin = "*";
  if (allowedOrigins && allowedOrigins !== "*") {
    const list = allowedOrigins.split(",").map((s) => s.trim()).filter(Boolean);
    allowOrigin = origin && list.includes(origin) ? origin : list[0] ?? "*";
  } else if (origin) {
    allowOrigin = origin;
  }

  setResponseHeader(event, "Access-Control-Allow-Origin", allowOrigin);
  setResponseHeader(event, "Vary", "Origin");
  setResponseHeader(event, "Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  setResponseHeader(event, "Access-Control-Allow-Headers", "Content-Type, Authorization");
  setResponseHeader(event, "Access-Control-Max-Age", 86400);

  if (event.method === "OPTIONS") {
    return sendNoContent(event, 204);
  }
});
