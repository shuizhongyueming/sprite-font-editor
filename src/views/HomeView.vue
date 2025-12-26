<template>
  <div class="home">
    <Toolbar />
    <div class="main-content">
      <CanvasArea @showMarginPopup="handleShowMarginPopup" />
      <ControlPanel ref="controlPanelRef" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Toolbar from '@/components/Toolbar.vue'
import CanvasArea from '@/components/CanvasArea.vue'
import ControlPanel from '@/components/ControlPanel.vue'
import { onMounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { initLocale } from '@/utils/i18n'

const editorStore = useEditorStore()
const controlPanelRef = ref()

onMounted(() => {
  // 初始化语言设置（从 localStorage 恢复或使用浏览器推荐语言）
  initLocale()
  // 从 localStorage 恢复状态
  editorStore.loadFromLocalStorage()
  // 从 IndexedDB 恢复图片和字体
  editorStore.restoreAssets()
})

function handleShowMarginPopup(data: { index: number; left: number; top: number }) {
  console.log('[HomeView] 接收到 showMarginPopup 事件:', data)
  // 调用 CharacterInput 的 showMarginEditorAt 方法
  if (controlPanelRef.value && controlPanelRef.value.characterInputRef) {
    console.log('[HomeView] 调用 characterInputRef.showMarginEditorAt')
    controlPanelRef.value.characterInputRef.showMarginEditorAt(data.left, data.top)
  } else {
    console.error('[HomeView] characterInputRef 为 null')
  }
}
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