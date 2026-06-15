<script setup lang="ts">
import { ref, shallowRef, computed, onMounted } from 'vue'
import { useMcpContext } from '~/composables/useMcpContext'
import { fetchGitlabFeatureBranches } from '~/utils/gitlabClient'

interface SyncItem {
  branch: string
  workItemId: string
  info: any
}

interface SyncSnapshot {
  syncedAt: number
  items: SyncItem[]
}

type DisplayItem = SyncItem & {
  displayName: string
  displayStatus: string
  statusColor: ReturnType<typeof getStatusColor>
  weight: number
  link: string
}

const { client, connected } = useMcpContext()
const toast = useToast()

const loading = ref(false)
const snapshot = shallowRef<SyncSnapshot | null>(null)

const syncTimeText = computed(() => {
  if (!snapshot.value?.syncedAt) return '从未同步'
  const diff = Math.floor((Date.now() - snapshot.value.syncedAt) / 1000)
  if (diff < 10) return '刚刚'
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  return `${Math.floor(diff / 3600)} 小时前`
})

async function loadSnapshot() {
  try {
    const res = await fetch('/api/work-items/query', { method: 'POST' })
    const data = await res.json()
    if (data?.syncedAt != null) snapshot.value = data
  } catch {
    // 忽略加载失败
  }
}

onMounted(loadSnapshot)

// ── Helpers ───────────────────────────────────────────────

function attr(info: any) {
  return info?.work_item_attribute || {}
}
function getWorkItemName(info: any): string {
  return attr(info).work_item_name || ''
}
function getWorkItemStatus(info: any): string {
  return attr(info).work_item_status?.name || ''
}
function getWorkItemLink(info: any, workItemId: string): string {
  const simpleName = attr(info).owned_project?.simple_name
  const typeKey = attr(info).work_item_type?.key || 'story'
  return simpleName ? `https://project.feishu.cn/${simpleName}/${typeKey}/detail/${workItemId}` : ''
}

function getStatusColor(status: string): 'success' | 'info' | 'warning' | 'neutral' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
    开发中: 'success',
    测试中: 'info',
    待上线: 'warning',
    已结束: 'neutral',
  }
  return map[status] ?? 'neutral'
}

// ── Sync Logic ────────────────────────────────────────────

async function syncWorkItemsFromBranches() {
  if (!client.value?.isConnected()) {
    toast.add({ description: '请先连接飞书项目', color: 'error', icon: 'i-lucide-alert-circle' })
    return
  }
  loading.value = true
  try {
    const cfg = await client.value.getGitlabBranchesConfig()
    const branches = await fetchGitlabFeatureBranches(cfg.url)
    const prefix = cfg.branchPrefix.endsWith('/') ? cfg.branchPrefix : `${cfg.branchPrefix}/`

    const items = branches.reduce(
      (acc, b) => {
        if (b.name.toLowerCase().startsWith(prefix.toLowerCase())) {
          const rawNo = b.name.slice(prefix.length).trim()
          const workItemId = rawNo.match(/^\d+/)?.[0] || rawNo
          if (workItemId) acc.push({ branch: b.name, workItemId })
        }
        return acc
      },
      [] as { branch: string; workItemId: string }[],
    )

    if (!items.length) throw new Error('未从 feature 分支解析到任何需求单号')

    const res = await fetch('/api/work-items/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${client.value.sessionToken}`,
      },
      body: JSON.stringify({ items }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `同步失败（HTTP ${res.status}）`)

    snapshot.value = data
    toast.add({
      description: `同步完成，共 ${data.items.length} 条分支需求映射`,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (e: any) {
    toast.add({
      title: '分支需求同步失败',
      description: e.message || String(e),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    loading.value = false
  }
}

// ── Table State ───────────────────────────────────────────

const statusWeight: Record<string, number> = { 开发中: 1, 测试中: 2, 待上线: 3, 已结束: 4 }
const sort = ref({ column: 'workItemId', direction: 'desc' as 'asc' | 'desc' })
const selectedStatuses = ref<string[]>([])
const statusOptions = ['开发中', '测试中', '待上线', '已结束', '未找到']

const tableData = computed<DisplayItem[]>(() => {
  let items = (snapshot.value?.items || []).map((item) => {
    const status = getWorkItemStatus(item.info)
    const isNotFound = !item.info
    const displayStatus = status || (isNotFound ? '未找到' : '')
    const weight = status ? (statusWeight[status] ?? 5) : isNotFound ? 5 : 6

    return {
      ...item,
      displayName: getWorkItemName(item.info),
      displayStatus,
      statusColor: getStatusColor(status),
      weight,
      link: getWorkItemLink(item.info, item.workItemId),
    }
  })

  if (selectedStatuses.value.length > 0) {
    items = items.filter((item) => selectedStatuses.value.includes(item.displayStatus))
  }

  const { column, direction } = sort.value
  const dir = direction === 'asc' ? 1 : -1

  items.sort((a, b) => {
    if (column === 'workItemStatus') {
      return (a.weight - b.weight) * dir
    }
    if (column === 'workItemId') {
      const numA = Number(a.workItemId)
      const numB = Number(b.workItemId)
      if (!isNaN(numA) && !isNaN(numB)) return (numA - numB) * dir
      return a.workItemId.localeCompare(b.workItemId) * dir
    }
    return 0
  })

  return items
})

function toggleSort(column: string, defaultDir: 'asc' | 'desc') {
  if (sort.value.column === column) {
    sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.column = column
    sort.value.direction = defaultDir
  }
}

const columns = [
  { accessorKey: 'branch', header: '分支', meta: { class: { th: 'w-[35%]', td: 'w-[35%]' } } },
  {
    accessorKey: 'workItemId',
    header: '需求单号',
    sortable: true,
    meta: { class: { th: 'w-[14%] whitespace-nowrap', td: 'w-[14%] whitespace-nowrap' } },
  },
  { id: 'workItemName', header: '需求名称', meta: { class: { th: 'w-[35%]' } } },
  {
    accessorKey: 'workItemStatus',
    header: '需求状态',
    sortable: true,
    meta: { class: { th: 'w-[16%] whitespace-nowrap', td: 'w-[16%] whitespace-nowrap' } },
  },
]

const tableMeta = {
  class: {
    tr: (row: { original: DisplayItem }) => (!row.original.info || row.original.displayStatus === '已结束' ? 'opacity-55' : ''),
  },
}

// ── Delete Confirm ────────────────────────────────────────

const deleteModal = ref(false)
const deletingItem = ref<DisplayItem | null>(null)

function openDeleteConfirm(item: DisplayItem) {
  deletingItem.value = item
  deleteModal.value = true
}

function confirmDelete() {
  if (!deletingItem.value) return

  const config = useRuntimeConfig()
  if (!config.public.gitlabBaseUrl || !config.public.gitlabProjectId) {
    toast.add({
      title: '跳转失败',
      description: '未配置 GITLAB_BASE_URL 或 GITLAB_PROJECT_ID 环境变量',
      color: 'error',
    })
    return
  }

  const url = `${config.public.gitlabBaseUrl}/${decodeURIComponent(config.public.gitlabProjectId)}/-/branches/all?utf8=%E2%9C%93&search=${encodeURIComponent(deletingItem.value.branch)}`
  window.open(url, '_blank')
  deleteModal.value = false
  deletingItem.value = null
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 h-full gap-6">
    <!-- Control card -->
    <UCard :ui="{ body: 'p-0' }">
      <div class="flex items-stretch">
        <div class="flex flex-col justify-center items-center px-8 py-6">
          <UButton
            color="primary"
            size="md"
            :loading="loading"
            :disabled="!connected"
            icon="i-lucide-refresh-cw"
            :label="loading ? '同步中...' : '执行同步'"
            @click="syncWorkItemsFromBranches"
          />
        </div>

        <USeparator orientation="vertical" class="my-6" />

        <div class="flex-1 flex items-center px-8 py-6 gap-3">
          <!-- 同步时间胶囊 -->
          <UBadge
            color="neutral"
            variant="subtle"
            size="md"
            class="rounded-full px-3 py-1 font-normal"
          >
            <div class="flex items-center gap-1.5 opacity-80">
              <UIcon
                :name="snapshot?.syncedAt ? 'i-lucide-history' : 'i-lucide-clock'"
                class="size-3.5"
              />
              <span>上次同步：{{ syncTimeText }}</span>
            </div>
          </UBadge>

          <!-- 映射数量胶囊 -->
          <UBadge
            v-if="snapshot?.items.length"
            color="primary"
            variant="subtle"
            size="md"
            class="rounded-full px-3 py-1 font-normal"
          >
            <div class="flex items-center gap-1.5">
              <UIcon name="i-lucide-git-branch" class="size-3.5 opacity-80" />
              <span>共 {{ snapshot.items.length }} 条映射</span>
            </div>
          </UBadge>
        </div>
      </div>
    </UCard>

    <!-- Filter Toolbar -->
    <div v-if="snapshot?.items.length" class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <USelectMenu
          v-model="selectedStatuses"
          :items="statusOptions"
          multiple
          placeholder="按需求状态筛选"
          class="w-48"
        />
        <UButton
          v-if="selectedStatuses.length"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash"
          label="清除筛选"
          @click="selectedStatuses = []"
        />
      </div>
      <div class="text-xs text-muted">
        已筛选显示：<span class="text-highlighted font-semibold">{{ tableData.length }}</span> /
        {{ snapshot.items.length }} 条分支
      </div>
    </div>

    <!-- Mapping table -->
    <UTable
      v-model:sort="sort"
      v-if="tableData.length"
      :data="tableData"
      :columns="columns"
      :meta="tableMeta"
      sticky
      class="flex-1 min-h-0 rounded-lg border border-default overflow-auto mb-10"
    >
      <template #workItemId-header>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="-mx-2 text-highlighted font-semibold hover:bg-neutral-500/10"
          @click="toggleSort('workItemId', 'desc')"
        >
          需求单号
          <template #trailing>
            <UIcon
              v-if="sort.column === 'workItemId'"
              :name="sort.direction === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
              class="size-3.5 ml-1 text-primary shrink-0"
            />
            <UIcon v-else name="i-lucide-chevrons-up-down" class="size-3.5 ml-1 text-muted opacity-40 shrink-0" />
          </template>
        </UButton>
      </template>
      <template #workItemStatus-header>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="-mx-2 text-highlighted font-semibold hover:bg-neutral-500/10"
          @click="toggleSort('workItemStatus', 'asc')"
        >
          需求状态
          <template #trailing>
            <UIcon
              v-if="sort.column === 'workItemStatus'"
              :name="sort.direction === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
              class="size-3.5 ml-1 text-primary shrink-0"
            />
            <UIcon v-else name="i-lucide-chevrons-up-down" class="size-3.5 ml-1 text-muted opacity-40 shrink-0" />
          </template>
        </UButton>
      </template>
      <template #branch-cell="{ row }">
        <span class="inline-flex items-center gap-2 font-mono text-xs text-highlighted">
          <UIcon name="i-lucide-git-branch" class="size-3 text-muted shrink-0" />
          {{ row.original.branch }}
          <UTooltip text="删除分支">
            <UButton
              color="error"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              class="ml-1 opacity-50 hover:opacity-100"
              @click.stop="openDeleteConfirm(row.original)"
            />
          </UTooltip>
        </span>
      </template>

      <template #workItemId-cell="{ row }">
        <a
          v-if="row.original.link"
          :href="row.original.link"
          target="_blank"
          class="font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          @click.stop
        >
          {{ row.original.workItemId }}
          <UIcon name="i-lucide-external-link" class="size-3 opacity-50" />
        </a>
        <span v-else class="font-mono text-xs font-semibold text-primary">
          {{ row.original.workItemId }}
        </span>
      </template>

      <template #workItemName-cell="{ row }">
        <span v-if="row.original.displayName" class="text-highlighted">
          {{ row.original.displayName }}
        </span>
        <span v-else class="text-muted opacity-40">—</span>
      </template>

      <template #workItemStatus-cell="{ row }">
        <UBadge
          v-if="row.original.displayStatus"
          :label="row.original.displayStatus"
          :color="row.original.statusColor"
          variant="subtle"
          size="sm"
        />
        <span v-else class="text-muted opacity-40">—</span>
      </template>
    </UTable>

    <!-- Empty state -->
    <div
      v-else
      class="flex-1 flex flex-col items-center justify-center gap-3 py-16 rounded-lg border border-default border-dashed"
    >
      <UIcon name="i-lucide-git-branch" class="size-8 text-muted opacity-30" />
      <p class="text-sm text-muted">等待执行同步操作...</p>
    </div>

    <!-- 删除确认弹窗 -->
    <UModal v-model:open="deleteModal" title="确认删除分支" :ui="{ footer: 'justify-end' }">
      <template #body>
        <p class="text-sm text-muted mb-3">确认要前往 GitLab 删除以下分支吗？</p>
        <div class="rounded-lg border border-default bg-elevated px-4 py-3 flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-git-branch" class="size-3.5 text-muted shrink-0" />
            <span class="font-mono text-xs text-highlighted break-all">{{ deletingItem?.branch }}</span>
          </div>
          <div v-if="deletingItem?.displayName" class="flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="size-3.5 text-muted shrink-0" />
            <span class="text-xs text-muted">{{ deletingItem.displayName }}</span>
          </div>
          <div v-if="deletingItem?.displayStatus" class="flex items-center gap-2">
            <UIcon name="i-lucide-tag" class="size-3.5 text-muted shrink-0" />
            <UBadge :label="deletingItem.displayStatus" :color="deletingItem.statusColor" variant="subtle" size="sm" />
          </div>
        </div>
      </template>
      <template #footer="{ close }">
        <UButton color="neutral" variant="outline" label="取消" @click="close" />
        <UButton color="error" icon="i-lucide-external-link" label="前往 GitLab 删除" @click="confirmDelete" />
      </template>
    </UModal>
  </div>
</template>
