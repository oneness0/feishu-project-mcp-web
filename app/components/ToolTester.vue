<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMcpContext } from "~/composables/useMcpContext";

const MonacoEditor = defineAsyncComponent(() => import("monaco-editor-vue3"));

const { client, connected } = useMcpContext();
const toast = useToast();

const loading = ref(false);
const output = ref("");

const tools = ref<any[]>([]);
const selectedToolName = ref("");
const toolArgs = ref("{\n  \n}");

const editorOptions = {
  minimap: { enabled: false },
  wordWrap: "on",
  formatOnPaste: true,
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

const toolNames = computed(() => tools.value.map(t => t.name));

const selectedTool = computed(() => tools.value.find(t => t.name === selectedToolName.value));

watch(selectedToolName, () => {
  const schema = selectedTool.value?.inputSchema;
  if (schema && schema.properties) {
    const template: Record<string, any> = {};
    for (const [key, val] of Object.entries<any>(schema.properties)) {
      const type = val.type;
      if (type === "string") template[key] = "";
      else if (type === "number") template[key] = 0;
      else if (type === "boolean") template[key] = false;
      else if (type === "array") template[key] = [];
      else if (type === "object") template[key] = {};
      else template[key] = null;
    }
    toolArgs.value = JSON.stringify(template, null, 2);
  } else {
    toolArgs.value = "{\n  \n}";
  }
});

async function run(
  apiName: string,
  fn: () => Promise<unknown>,
  successMsg = "调用成功",
) {
  loading.value = true;
  output.value = "";
  try {
    const result = await fn();
    const parsedResult = tryParseJsonStrings(result);
    output.value = JSON.stringify(parsedResult, null, 2);
    toast.add({
      description: successMsg,
      color: "success",
      icon: "i-lucide-check-circle",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.add({
      title: "调用失败",
      description: msg,
      color: "error",
      icon: "i-lucide-alert-circle",
    });
    output.value = JSON.stringify({ error: msg }, null, 2);
  } finally {
    loading.value = false;
  }
}

async function handleListTools() {
  await run("tools/list", async () => {
    const res: any = await client.value!.listTools();
    
    const toolsArray = res?.tools || res?.result?.tools || res?.result?.result?.tools || res?.data?.tools;
    
    if (Array.isArray(toolsArray)) {
      tools.value = toolsArray;
      if (tools.value.length > 0 && !selectedToolName.value) {
        selectedToolName.value = tools.value[0].name;
      }
    } else {
      console.warn("Could not find tools array in response:", res);
    }
    return res;
  }, "成功获取 Tools 列表");
}

async function handleCallTool() {
  if (!selectedToolName.value) {
    toast.add({ title: "提示", description: "请先获取并选择工具", color: "warning" });
    return;
  }
  let parsedArgs = {};
  if (toolArgs.value.trim()) {
    try {
      parsedArgs = JSON.parse(toolArgs.value);
    } catch (e) {
      toast.add({ title: "参数错误", description: "请输入合法的 JSON 格式", color: "error" });
      return;
    }
  }

  await run(
    `call_tool(${selectedToolName.value})`,
    () => client.value!.callTool(selectedToolName.value, parsedArgs),
    `成功调用工具 ${selectedToolName.value}`
  );
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 h-full">
    <!-- Control card -->
    <UCard class="mb-6">
      <div class="flex items-stretch h-96">
        <!-- Left: inputs + action -->
        <div class="flex flex-col gap-4 p-6 w-[45%] border-r border-default overflow-y-auto">
          <UButton
            color="neutral"
            variant="outline"
            label="1. 获取可用 Tools 列表"
            :disabled="!connected || loading"
            @click="handleListTools"
          />
          <div class="flex flex-col gap-3">
            <USelectMenu
              v-model="selectedToolName"
              :items="toolNames"
              placeholder="2. 请选择要调用的工具"
              :disabled="!connected || tools.length === 0"
            />
          </div>
          <div class="h-[300px] border border-default rounded-md overflow-hidden relative">
            <ClientOnly>
              <MonacoEditor
                v-model:value="toolArgs"
                language="json"
                theme="vs-light"
                :options="editorOptions"
                class="w-full h-full"
              />
              <template #fallback>
                <div class="w-full h-full flex items-center justify-center bg-surface/50">
                  <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
                </div>
              </template>
            </ClientOnly>
          </div>
          <UButton
            color="primary"
            icon="i-lucide-play"
            label="4. 执行工具调用"
            :loading="loading"
            :disabled="!connected || !selectedToolName"
            @click="handleCallTool"
          />
        </div>

        <!-- Right: selected tool description and schema -->
        <div class="flex-1 p-6 bg-surface/30 flex flex-col gap-6 overflow-y-auto">
          <div v-if="!selectedTool" class="flex flex-col items-center justify-center h-full text-muted opacity-50">
            <UIcon name="i-lucide-mouse-pointer-click" class="size-8 mb-2" />
            <p>在左侧选择工具以查看说明</p>
          </div>

          <template v-else>
            <!-- 工具说明 -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2 text-sm text-highlighted font-semibold">
                <UIcon name="i-lucide-info" class="size-4" />
                工具说明
              </div>
              <p class="text-xs text-muted leading-relaxed break-all whitespace-pre-wrap">
                {{ selectedTool.description || '暂无说明' }}
              </p>
            </div>

            <!-- 参数说明 (Schema) -->
            <div v-if="selectedTool.inputSchema" class="flex flex-col gap-2 flex-1 min-h-0">
              <div class="flex items-center gap-2 text-sm text-highlighted font-semibold">
                <UIcon name="i-lucide-file-json" class="size-4" />
                参数定义 (Input Schema)
              </div>
              <div class="flex-1 overflow-y-auto rounded border border-default bg-surface/50 p-3">
                <pre class="text-xs text-muted font-mono whitespace-pre-wrap break-all">{{ JSON.stringify(selectedTool.inputSchema, null, 2) }}</pre>
              </div>
            </div>
          </template>
        </div>
      </div>
    </UCard>

    <!-- JSON output -->
    <div
      class="flex-1 rounded-xl border border-default overflow-hidden min-h-[400px] flex flex-col"
    >
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
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center gap-3 py-16"
      >
        <UIcon name="i-lucide-code-2" class="size-8 text-muted opacity-30" />
        <p class="text-sm text-muted">测试结果将以 JSON 数据格式显示在此处</p>
      </div>
    </div>
  </div>
</template>
