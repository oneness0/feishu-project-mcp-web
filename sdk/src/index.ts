/**
 * 飞书项目 MCP 前端 SDK
 *
 * 在任意前端项目中引入即可：
 *   1) connect() 通过 popup 拉起飞书授权（不离开宿主页）
 *   2) callTool()/listTools()/call() 用会话令牌经由后端调用 MCP 工具
 *
 * 真实 access_token/refresh_token 始终保存在后端，前端仅持有不可逆的 sessionToken。
 */

export interface FeishuMcpClientOptions {
  /** 后端服务地址，例如 http://localhost:3000 */
  backendBaseUrl: string;
  /** localStorage 中保存 sessionToken 的键名，默认 feishu_mcp_session */
  storageKey?: string;
  /** popup 窗口尺寸 */
  popup?: { width?: number; height?: number };
  /** connect 等待授权完成的超时时间（毫秒），默认 5 分钟 */
  authTimeoutMs?: number;
}

export interface AuthStatus {
  connected: boolean;
  expiresAt?: number;
  hasRefreshToken?: boolean;
  /** 后端是否开启了只读模式（写类工具会被拦截） */
  readonly?: boolean;
}

export interface McpToolResult {
  /** MCP 返回的 JSON-RPC 响应体（含 result 或 error） */
  result: unknown;
}

/** 按工作项单号批量查询的响应；data 值为 content[0].text 反序列化后的工作项对象 */
export interface WorkItemsResponse {
  data: Record<string, unknown>;
  errors?: Record<string, string>;
}

export interface GitlabBranchesConfig {
  url: string;
  branchPrefix: string;
}

export class NotConnectedError extends Error {
  constructor(message = "尚未连接，请先调用 connect() 完成授权") {
    super(message);
    this.name = "NotConnectedError";
  }
}

type ChangeListener = (connected: boolean) => void;

export interface AuthMessage {
  type: "token";
  token: string;
}

export interface GitlabBranchesConfig {
  url: string;
  branchPrefix: string;
}

export class FeishuMcpClient {
  private readonly base: string;
  private readonly backendOrigin: string;
  private readonly storageKey: string;
  private readonly popupSize: { width: number; height: number };
  private readonly authTimeoutMs: number;
  private listeners = new Set<ChangeListener>();

  constructor(options: FeishuMcpClientOptions) {
    if (!options?.backendBaseUrl) throw new Error("backendBaseUrl 不能为空");
    this.base = options.backendBaseUrl.replace(/\/$/, "");
    this.backendOrigin = new URL(this.base).origin;
    this.storageKey = options.storageKey || "feishu_mcp_session";
    this.popupSize = {
      width: options.popup?.width ?? 520,
      height: options.popup?.height ?? 720,
    };
    this.authTimeoutMs = options.authTimeoutMs ?? 5 * 60 * 1000;
  }

  /** 当前会话令牌（不可逆，仅用于和本后端通信）。 */
  get sessionToken(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(this.storageKey);
  }

  isConnected(): boolean {
    return Boolean(this.sessionToken);
  }

  /** 监听连接状态变化，返回取消订阅函数。 */
  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setToken(token: string | null) {
    if (typeof localStorage === "undefined") return;
    if (token) localStorage.setItem(this.storageKey, token);
    else localStorage.removeItem(this.storageKey);
    this.listeners.forEach((l) => l(Boolean(token)));
  }

  /**
   * 通过 popup 拉起授权。授权成功后保存 sessionToken 并 resolve。
   */
  connect(): Promise<void> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("connect() 只能在浏览器环境调用"));
    }

    const url =
      `${this.base}/api/oauth/start?return_origin=` +
      encodeURIComponent(window.location.origin);

    const { width, height } = this.popupSize;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      url,
      "feishu-mcp-auth",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      return Promise.reject(new Error("弹窗被浏览器拦截，请允许弹窗后重试"));
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        clearInterval(timer);
        clearTimeout(timeout);
      };
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const onMessage = (e: MessageEvent) => {
        if (e.origin !== this.backendOrigin) return;
        const data = e.data as AuthMessage | undefined;
        if (!data || data.type !== "feishu-mcp-auth") return;
        if (data.ok && data.sessionToken) {
          this.setToken(data.sessionToken);
          finish(resolve);
        } else {
          finish(() => reject(new Error(data.error || "授权失败")));
        }
      };

      const timer = setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new Error("授权窗口已关闭")));
        }
      }, 500);

      const timeout = setTimeout(() => {
        try {
          popup.close();
        } catch {
          /* noop */
        }
        finish(() => reject(new Error("授权超时")));
      }, this.authTimeoutMs);

      window.addEventListener("message", onMessage);
    });
  }

  /** 断开连接并清除本地会话令牌。 */
  async disconnect(): Promise<void> {
    const token = this.sessionToken;
    if (token) {
      await fetch(`${this.base}/api/oauth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    this.setToken(null);
  }

  /** 查询授权状态。 */
  async getStatus(): Promise<AuthStatus> {
    const token = this.sessionToken;
    if (!token) return { connected: false };
    const res = await fetch(`${this.base}/api/oauth/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as AuthStatus;
  }

  /** 列出可用工具（tools/list）。 */
  listTools(): Promise<unknown> {
    return this.request("/api/mcp/tools", { method: "GET" });
  }

  /** 调用单个工具（tools/call）。 */
  callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.request("/api/mcp/tool", {
      method: "POST",
      body: JSON.stringify({ name, arguments: args }),
    });
  }

  /** 通用 JSON-RPC 调用。 */
  call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.request("/api/mcp/rpc", {
      method: "POST",
      body: JSON.stringify({ method, params }),
    });
  }

  /**
   * 按工作项单号（可多个）查询工作项信息（主业务接口）。
   * 需先 connect() 完成飞书授权。
   */
  async queryWorkItems(workItemIds: string[]): Promise<WorkItemsResponse> {
    const token = this.sessionToken;
    if (!token) throw new NotConnectedError();

    const res = await fetch(`${this.base}/api/work-items/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workItemIds }),
    });

    const json = (await res.json().catch(() => ({}))) as WorkItemsResponse & {
      error?: string;
    };

    if (res.status === 401) {
      this.setToken(null);
      throw new NotConnectedError(json.error || "会话已失效，请重新连接");
    }
    if (!res.ok) {
      throw new Error(json.error || `请求失败（HTTP ${res.status}）`);
    }
    return json;
  }
  /** 获取内网 GitLab 分支列表 URL（含 token，供浏览器直连 GitLab）。 */
  async getGitlabBranchesConfig(): Promise<GitlabBranchesConfig> {
    const token = this.sessionToken;
    if (!token) throw new NotConnectedError();

    const res = await fetch(`${this.base}/api/gitlab/branches-config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as GitlabBranchesConfig & {
      error?: string;
    };
    if (!res.ok)
      throw new Error(json.error || `请求分支配置失败 (HTTP ${res.status})`);
    return json;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const token = this.sessionToken;
    if (!token) throw new NotConnectedError();

    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    const json = (await res.json().catch(() => ({}))) as {
      result?: unknown;
      error?: string;
    };

    if (res.status === 401) {
      // 会话失效，清理本地令牌
      this.setToken(null);
      throw new NotConnectedError(json.error || "会话已失效，请重新连接");
    }
    if (!res.ok) {
      throw new Error(json.error || `请求失败（HTTP ${res.status}）`);
    }
    return json.result;
  }
}

export function createFeishuMcpClient(
  options: FeishuMcpClientOptions,
): FeishuMcpClient {
  return new FeishuMcpClient(options);
}
