// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-06-15',
  devtools: { enabled: false },
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  // 仅作为 SDK 后端 + demo 演示，运行时配置从环境变量注入
  // 运行时配置从环境变量注入，这里只定义类型兜底（空值/false）
  // 实际值在 .env（共享配置）或 .env.local（本地覆盖）中维护
  runtimeConfig: {
    oauthRedirectUri: process.env.OAUTH_REDIRECT_URI || '',
    feishuMcpClientId: process.env.FEISHU_MCP_CLIENT_ID || '',
    // 允许调用后端的来源（SDK 嵌入的宿主页 origin），逗号分隔；* 表示全部放行
    allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
    // 只读模式：开启后后端拦截所有写类工具调用
    mcpReadonly: process.env.MCP_READONLY === 'true',
    // 只读模式下额外放行的工具名（逗号分隔）
    mcpReadonlyAllow: process.env.MCP_READONLY_ALLOW || '',
    // 飞书项目空间 key
    feishuProjectKey: process.env.FEISHU_PROJECT_KEY || '',

    public: {
      gitlabBaseUrl: process.env.GITLAB_BASE_URL || '',
      gitlabProjectId: process.env.GITLAB_PROJECT_ID || '',
    },

    // 仅限服务端的敏感配置
    gitlabBranchesUrl: process.env.GITLAB_BRANCHES_URL || '',
    gitlabPrivateToken: process.env.GITLAB_PRIVATE_TOKEN || '',
    gitlabBranchPrefix: process.env.GITLAB_BRANCH_PREFIX || 'feature/',
  },
  nitro: {
    storage: {
      sessions: {
        driver: 'fs',
        base: './.data/sessions',
      },
      'work-items': {
        driver: 'fs',
        base: './.data/work-items',
      },
    },
  },
  vite: {
    optimizeDeps: {
      include: ['monaco-editor', '@guolao/vue-monaco-editor']
    }
  }
})
