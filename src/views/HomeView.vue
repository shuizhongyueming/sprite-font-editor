<template>
  <div class="home">
    <Toolbar />
    <div class="main-content">
      <CanvasArea />
      <ControlPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import Toolbar from '@/components/Toolbar.vue'
import CanvasArea from '@/components/CanvasArea.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import { onMounted } from 'vue'
import { useEditorStore } from '@/stores/editor'

const editorStore = useEditorStore()

onMounted(() => {
  // 从 localStorage 恢复状态
  editorStore.loadFromLocalStorage()
})
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>