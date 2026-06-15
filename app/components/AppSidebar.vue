<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useMcpContext } from '~/composables/useMcpContext'

const collapsed = defineModel<boolean>('collapsed', { default: false })
const { connected, readonly, connect, disconnect } = useMcpContext()
const toast = useToast()

const loading = ref(false)

async function handleConnect() {
  loading.value = true
  try {
    await connect()
    toast.add({
      description: '成功连接飞书项目',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.add({
      title: '连接失败',
      description: msg,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    loading.value = false
  }
}

async function handleDisconnect() {
  loading.value = true
  try {
    await disconnect()
    toast.add({ description: '已断开飞书项目连接' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.add({
      title: '断开连接失败',
      description: msg,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    loading.value = false
  }
}

const navItems: NavigationMenuItem[] = [
  { label: '分支需求同步', icon: 'i-lucide-git-branch', to: '/' },
  {
    label: '测试',
    icon: 'i-lucide-beaker',
    defaultOpen: true,
    children: [
      { label: '测试 MCP', icon: 'i-lucide-zap', to: '/mcp' },
      { label: '测试 GitLab', icon: 'i-lucide-gitlab', to: '/gitlab' },
    ],
  },
]
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- Logo + Title -->
    <div class="sidebar-header">
      <img
        src="https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20251121-114942.png"
        alt="Feishu Project Logo"
        width="36"
        height="36"
        class="shrink-0"
      />
      <div v-if="!collapsed" class="app-title">
        <div>飞书项目</div>
        <div>MCP SDK</div>
      </div>
    </div>

    <!-- Connection status + button -->
    <div class="px-1 mb-3 flex flex-col gap-2">
      <UTooltip
        :text="connected ? '已成功连接到飞书项目 MCP 服务' : '尚未连接到飞书项目 MCP 服务'"
        :content="{ side: 'right' }"
      >
        <div :class="['status-badge', connected ? 'ok' : 'off']">
          <span v-if="connected" class="relative flex size-[7px] shrink-0">
            <span class="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
            <span class="relative inline-flex size-[7px] rounded-full bg-current" />
          </span>
          <span v-else class="status-dot" />
          <span v-if="!collapsed" class="text-xs font-semibold">
            {{ connected ? '已连接' : '未连接' }}
          </span>
        </div>
      </UTooltip>
      <UTooltip v-if="readonly && !collapsed" text="只读模式：写类工具调用已被后端拦截" :content="{ side: 'right' }">
        <div class="status-badge readonly">
          <span class="status-dot" />
          <span class="text-xs font-semibold">只读</span>
        </div>
      </UTooltip>
      <UButton
        :color="connected ? 'neutral' : 'primary'"
        :variant="connected ? 'outline' : 'solid'"
        :icon="connected ? 'i-lucide-power' : 'i-lucide-arrow-right'"
        :label="collapsed ? undefined : connected ? '断开' : '连接'"
        :loading="loading"
        :block="!collapsed"
        size="sm"
        :ui="{ base: collapsed ? 'justify-center' : '' }"
        @click="connected ? handleDisconnect() : handleConnect()"
      />
    </div>

    <USeparator class="mb-3" />

    <!-- Navigation -->
    <div class="flex-1 overflow-hidden">
      <UNavigationMenu
        variant="pill"
        orientation="vertical"
        :collapsed="collapsed"
        :tooltip="collapsed ? { delayDuration: 100, content: { side: 'right' } } : false"
        :items="navItems"
        highlight
        class="w-full"
        :ui="{
          link: 'hover:before:bg-neutral-500/10 data-[active]:before:bg-primary/10 data-[active]:hover:before:bg-primary/20',
        }"
      />
    </div>

    <!-- Footer: collapse -->
    <div class="pt-3 border-t border-default flex items-center justify-end">
      <UButton
        :icon="collapsed ? 'i-lucide-chevrons-right' : 'i-lucide-chevrons-left'"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="collapsed = !collapsed"
      />
    </div>
  </aside>
</template>

<style scoped lang="scss">
.sidebar {
  width: 220px;
  background-color: var(--app-bg-green-gray);
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  padding: 20px 12px;

  &.collapsed {
    width: 64px;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 20px;
}

.app-title {
  font-size: 15px;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
}

/* ── Connection Status ── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: help;

  &.ok {
    background: color-mix(in srgb, var(--ui-color-success-500) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--ui-color-success-500) 25%, transparent);
    color: var(--ui-color-success-500);
  }

  &.off {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-muted);
  }

  &.readonly {
    background: color-mix(in srgb, var(--ui-color-error-500) 10%, transparent);
    color: var(--ui-color-error-500);
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  min-width: 7px;
  border-radius: 50%;
  background: currentColor;
}
</style>
