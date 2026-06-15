<script setup lang="ts">
const collapsed = ref(false)

const route = useRoute()
const pageTitle = computed(() => {
  const map: Record<string, string> = {
    '/': '分支需求同步',
    '/mcp': '测试 MCP',
    '/gitlab': '测试 GitLab',
  }
  return map[route.path] ?? ''
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <AppSidebar v-model:collapsed="collapsed" />

    <div
      class="flex flex-col flex-1 min-w-0"
      :style="{
        marginLeft: collapsed ? '64px' : '220px',
        transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
      }"
    >
      <!-- Topbar -->
      <header class="h-[60px] min-h-[60px] flex items-center px-10 bg-green-gray border-b border-default">
        <p class="text-sm text-muted">
          飞书项目 MCP SDK &gt;
          <span class="text-highlighted">{{ pageTitle }}</span>
        </p>
      </header>

      <!-- Main content -->
      <main class="flex-1 overflow-auto p-10 flex flex-col bg-background">
        <div class="flex-1 flex flex-col min-h-0">
          <slot />
        </div>

        <footer class="mt-12 pt-5 border-t border-default">
          <p class="text-muted text-sm">
            其他前端项目集成：<code class="bg-elevated border border-default px-1.5 py-0.5 rounded text-xs font-mono"
              >npm run build:sdk</code
            >
            后引入
            <code class="bg-elevated border border-default px-1.5 py-0.5 rounded text-xs font-mono"
              >sdk/dist/feishu-mcp-sdk.mjs</code
            >，调用
            <code class="bg-elevated border border-default px-1.5 py-0.5 rounded text-xs font-mono"
              >createFeishuMcpClient({ backendBaseUrl })</code
            >。
          </p>
        </footer>
      </main>
    </div>
  </div>
</template>
