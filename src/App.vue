<template>
  <div id="app">
    <Toolbar />
    <div class="main-content">
      <ControlPanel />
      <CanvasArea />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import ControlPanel from './components/ControlPanel.vue'
import CanvasArea from './components/CanvasArea.vue'
import { useEditorStore } from '@/stores/editor'
import { initLocale } from '@/utils/i18n'

const editorStore = useEditorStore()

onMounted(() => {
  initLocale()
  editorStore.loadFromLocalStorage()
  editorStore.restoreAssets()

  setTimeout(() => {
    if (editorStore.characterEntries.length > 0 && editorStore.baseImage) {
      editorStore.renderTrigger++
    }
  }, 100)
})
</script>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  height: 100vh;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}

.main-content {
  display: flex;
  height: calc(100vh - 64px);
}
</style>
