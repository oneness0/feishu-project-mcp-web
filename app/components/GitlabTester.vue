<script setup lang="ts">
import { ref, onMounted } from 'vue'

const toast = useToast()

const gitlabOrigin = ref('')
const loading = ref(false)
const output = ref('')
const lastApiName = ref('')

onMounted(async () => {
  try {
    const res = await $fetch<{ origin?: string; error?: string }>('/api/gitlab/config')
    if (res.origin) gitlabOrigin.value = res.origin
  } catch {
    // 忽略
  }
})

const MonacoEditor = defineAsyncComponent(() => import("monaco-editor-vue3"))

const editorOptions = {
  minimap: { enabled: false },
  wordWrap: 'on',
  formatOnPaste: true,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
}

async function fetchGitlabBranches() {
  loading.value = true
  output.value = ''
  lastApiName.value = 'GET /api/v4/projects/.../branches'

  try {
    const data = await $fetch(
      'http://172.16.1.134/api/v4/projects/coreproject%2Fprjc/repository/branches?search=%5Efeature%2F&private_token=h_bd1qnRaBfF7x9rFsFx',
    )
    output.value = JSON.stringify(tryParseJsonStrings(data), null, 2)
    toast.add({
      description: '成功获取 GitLab 分支信息',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.add({
      title: '调用失败',
      description: msg,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
    output.value = JSON.stringify({ error: msg }, null, 2)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 h-full">
    <!-- Control card -->
    <UCard class="mb-6">
      <div class="flex items-stretch">
        <!-- Left: field + action -->
        <div class="flex flex-col gap-4 p-8 w-[45%]">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted font-medium">GitLab 地址</label>
            <UInput model-value="http://172.16.1.134" disabled />
          </div>
          <UButton
            color="primary"
            :loading="loading"
            :disabled="loading"
            icon="i-lucide-git-branch"
            :label="loading ? '请求中...' : '获取分支信息'"
            @click="fetchGitlabBranches"
          />
        </div>

        <USeparator orientation="vertical" class="my-6" />

        <!-- Right: status + API info -->
        <div class="flex-1 flex flex-col justify-center px-8 py-6 gap-4">
          <div class="flex items-center gap-2">
            <span :class="['w-3 h-3 rounded-full', output ? 'bg-success' : 'bg-neutral-500']" />
            <span class="text-sm text-muted"> 上次调用：{{ lastApiName || '无' }} </span>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <UBadge label="GET" color="primary" variant="subtle" size="xs" class="font-mono font-bold" />
              <code class="text-sm text-highlighted break-all"
                >/api/v4/projects/coreproject%2Fprjc/repository/branches</code
              >
            </div>
            <p class="text-xs text-muted leading-relaxed">
              直接请求目标接口获取分支信息，URL 中包含了
              <code class="bg-elevated border border-default px-1 py-0.5 rounded text-[11px] font-mono"
                >private_token</code
              >
              进行鉴权。
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- JSON output -->
    <div class="flex-1 rounded-xl border border-default overflow-hidden min-h-[400px] flex flex-col">
      <div v-if="output" class="flex-1 w-full h-full">
        <ClientOnly>
          <MonacoEditor
            :value="output"
            language="json"
            theme="vs-light"
            :options="{ ...editorOptions, readOnly: true }"
            class="w-full h-full"
          />
        </ClientOnly>
      </div>
      <div v-else class="flex-1 flex flex-col items-center justify-center gap-3 py-16">
        <UIcon name="i-lucide-git-branch" class="size-8 text-muted opacity-30" />
        <p class="text-sm text-muted">GitLab 分支信息将以 JSON 格式显示在此处</p>
      </div>
    </div>
  </div>
</template>
