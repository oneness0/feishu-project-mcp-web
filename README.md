# 飞书项目 MCP · OAuth 接入（Nuxt3 后端 + 可分发 JS SDK）

在网页中以标准 **MCP OAuth 2.1（授权码 + PKCE）** 接入飞书项目 MCP，全程**无需 plugin_secret**。

- **后端**：Nuxt 3（Nitro server 路由），处理 OAuth 与 MCP 代理，真实 `access_token`/`refresh_token` 只留服务端。
- **SDK**：框架无关的 TS 库（Vite 库模式打包成单文件），可引入任意前端项目，`popup` 拉起授权 + 调用工具。
- **会话模型**：SDK 拿到不可逆的 `sessionToken`（存 localStorage），调后端时放 `Authorization: Bearer`，跨域友好、不依赖第三方 Cookie。

## 为什么必须有后端

实测飞书项目的 `token` / `register` / `mcp_server/v1` 端点**均未开启 CORS**（预检无 `Access-Control-Allow-Origin`），浏览器无法直接跨域换 token / 调 MCP。因此换 token、调 MCP 必须经后端中转。

## 架构与流程

```
宿主前端 (引入 SDK)
   │  sdk.connect()  ── popup ──►  后端 /api/oauth/start ──► 飞书授权页(登录/同意)
   │                                          │
   │            popup 回调 /api/oauth/callback ◄┘  换 token → 建会话(sessionToken)
   │   ◄── postMessage(sessionToken) ──────────┘
   │  保存 sessionToken 到 localStorage
   │
   │  sdk.callTool(name,args)  ──►  后端 /api/mcp/tool (Bearer sessionToken)
   │                                   └─► 取真实 access_token → 调 MCP (401 自动 refresh) → 回传结果
```

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `server/utils/feishuOauth.ts` | 元数据发现、DCR、PKCE、token 换取/刷新 |
| `server/utils/mcpClient.ts` | MCP JSON-RPC 调用（initialize 握手 + SSE/JSON 解析） |
| `server/utils/sessionStore.ts` | 内存会话存储（sessionToken → 真实凭证） |
| `server/utils/callWithSession.ts` | 按会话调用 MCP，401 自动刷新重试 |
| `server/middleware/cors.ts` | 为 `/api/**` 开启 CORS |
| `server/api/oauth/*` | start / callback / status / logout |
| `server/api/mcp/*` | tools(list) / tool(call) / rpc(通用) |
| `sdk/src/index.ts` | SDK 源码 |
| `sdk/vite.config.ts` | SDK 库打包配置 |
| `app.vue` | Vue3 demo 页（引入 SDK 演示） |

## 快速开始

```bash
npm install
npm run dev        # http://localhost:3000 打开 demo，点「连接飞书项目」
```

`.env`（已提供，按需改）：

```
OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/callback
FEISHU_MCP_CLIENT_ID=feishu-project-mcp-web
ALLOWED_ORIGINS=*
MCP_READONLY=true            # 只读模式：后端拦截所有写类工具
MCP_READONLY_ALLOW=          # 只读模式下额外放行的工具名（逗号分隔）
```

## 只读护栏（在后端禁用写操作）

飞书侧的 MCP 开关 / 数据授权范围对管理员身份的 `user_access_token` 往往不起实际限制（token = 用户本人权限）。因此本项目在**后端**提供确定性的只读护栏：

- `MCP_READONLY=true` 时，`/api/mcp/tool` 与 `/api/mcp/rpc` 的 `tools/call` 只放行**读类工具**，写类工具直接返回 `403`，不会发给 MCP。
- 读类判定：工具名以 `get_` / `list_` / `search_` 开头；个别例外可用 `MCP_READONLY_ALLOW` 显式补充放行。
- 写类（被拦截）：`create_*` / `update_*` / `edit_*` / `transition_*` / `publish_*` / `reset_*` / `upload_*` 等。
- `/api/oauth/status` 返回 `readonly` 字段，SDK 的 `getStatus()` 可读取。

这是不依赖飞书行为、你能 100% 掌控的写操作拦截点。

## 打包 SDK 并在其他项目中使用

```bash
npm run build:sdk
# 产物：sdk/dist/feishu-mcp-sdk.mjs (ESM) / .umd.cjs (UMD) / index.d.ts
```

在其他前端项目中引入：

```ts
import { createFeishuMcpClient } from "./feishu-mcp-sdk.mjs";

const sdk = createFeishuMcpClient({ backendBaseUrl: "https://你的后端域名" });

// 1) 拉起授权（popup）
await sdk.connect();

// 2) 列出工具
const tools = await sdk.listTools();

// 3) 调用工具（等价于你给的 tools/call get_workitem_brief）
const brief = await sdk.callTool("get_workitem_brief", {
  work_item_id: "6995496915",
  project_key: "69c9c9c6b8272239b50a67a1",
});

// 4) 通用调用
await sdk.call("tools/call", { name: "xxx", arguments: { /* ... */ } });

// 状态 / 断开
sdk.isConnected();
await sdk.getStatus();
await sdk.disconnect();
```

UMD（`<script>` 直接引入）方式：

```html
<script src="./feishu-mcp-sdk.umd.cjs"></script>
<script>
  const sdk = FeishuMcpSDK.createFeishuMcpClient({ backendBaseUrl: "https://你的后端域名" });
  sdk.connect().then(() => sdk.listTools()).then(console.log);
</script>
```

### 跨域注意

SDK 与后端不同源时，把宿主页 origin 加入后端 `ALLOWED_ORIGINS`（逗号分隔；`*` 放行全部）。会话用 Bearer 头而非 Cookie，不受第三方 Cookie 限制。

## 工作项批量查询（主业务接口）

流程：

1. 页面点击 **「同步分支对应工作项信息」**（需先连接飞书）。
2. **浏览器**请求内网 GitLab 分支列表（URL 与 `private_token` 由后端 `/api/gitlab/branches-config` 下发，token 配置在环境变量 `GITLAB_PRIVATE_TOKEN`）。
3. 从 `feature/*` 分支名解析工作项单号（默认 `feature/<单号>`）。
4. **浏览器**调用 `POST /api/work-items/query`，传入 `workItemIds` 数组，后端用 MCP `get_workitem_brief` 查询并返回。

### `POST /api/work-items/query`

- Header：`Authorization: Bearer <sessionToken>`
- Body：`{ "workItemIds": ["6995496915", "xxx"] }`
- Response：

```json
{
  "data": {
    "6995496915": { "work_item_attribute": { "...": "..." } },
    "xxx": null
  },
  "errors": {
    "xxx": "查询失败原因"
  }
}
```

`data` 中每个单号对应 MCP `get_workitem_brief` 返回里 `result.content[0].text` 反序列化后的对象（不再是整段 JSON-RPC 包装）。

纯数字单号按 `work_item_id` 查询，否则按 `name` 查询。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `FEISHU_PROJECT_KEY` | 飞书项目空间 key |
| `GITLAB_BRANCHES_URL` | GitLab 分支 API（不含 token） |
| `GITLAB_PRIVATE_TOKEN` | GitLab private_token（仅服务端配置，通过 branches-config 下发给已授权浏览器） |
| `GITLAB_BRANCH_PREFIX` | 分支前缀，默认 `feature/` |

SDK 调用示例：

```ts
const sdk = createFeishuMcpClient({ backendBaseUrl: "http://localhost:3000" });
await sdk.connect();
const { data, errors } = await sdk.queryWorkItems(["6995496915"]);
```

## 后端接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/oauth/start?return_origin=` | 发起授权，302 跳转授权页（popup 打开） |
| GET | `/api/oauth/callback` | 回调换 token，postMessage 回传 sessionToken |
| GET | `/api/oauth/status` | 查询连接状态（Bearer） |
| POST | `/api/oauth/logout` | 断开会话（Bearer） |
| GET | `/api/mcp/tools` | tools/list（Bearer） |
| POST | `/api/mcp/tool` | tools/call，body `{ name, arguments }`（Bearer） |
| POST | `/api/mcp/rpc` | 通用 JSON-RPC，body `{ method, params }`（Bearer） |
| GET | `/api/gitlab/branches-config` | 下发内网 GitLab 分支 URL（含 token，浏览器直连） |
| POST | `/api/work-items/query` | **主接口**：按工作项单号数组返回工作项信息 |

## 生产注意

- 内存会话仅适合单实例/开发，生产请用 Redis 等共享存储替换 `sessionStore`。
- 部署在 HTTPS 后，临时授权 Cookie 会自动带 `Secure`。
- 收紧 `ALLOWED_ORIGINS` 到你信任的宿主域名。
