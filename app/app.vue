<script setup lang="ts">
import { onMounted, shallowRef, ref, provide } from "vue";
import { createFeishuMcpClient, type FeishuMcpClient } from "@@/sdk/src";
import { McpContextKey } from "~/composables/useMcpContext";

const client = shallowRef<FeishuMcpClient | null>(null);
const connected = ref(false);
const expiresAt = ref<number | undefined>(undefined);
const readonly = ref(false);

async function refreshStatus() {
  if (!client.value) return;
  const s = await client.value.getStatus();
  connected.value = s.connected;
  expiresAt.value = s.expiresAt;
  readonly.value = Boolean(s.readonly);
}

async function connect() {
  if (!client.value) return;
  await client.value.connect();
  await refreshStatus();
}

async function disconnect() {
  if (!client.value) return;
  await client.value.disconnect();
  await refreshStatus();
}

onMounted(async () => {
  const c = createFeishuMcpClient({ backendBaseUrl: window.location.origin });
  client.value = c;
  c.onChange((isConnected) => (connected.value = isConnected));
  await refreshStatus();
});

provide(McpContextKey, {
  client,
  connected,
  expiresAt,
  readonly,
  connect,
  disconnect,
  refreshStatus,
});
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
