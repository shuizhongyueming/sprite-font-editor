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
import { onMounted, onUnmounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import ControlPanel from './components/ControlPanel.vue'
import CanvasArea from './components/CanvasArea.vue'
import { useEditorStore } from '@/stores/editor'
import { initLocale } from '@/utils/i18n'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'
import { parseProjectFiles, buildFileMapFromFileList, readZipProject } from '@/utils/project-import'

const editorStore = useEditorStore()

function preventDragDefault(event: DragEvent) {
  event.preventDefault()
}

async function importProjectFromFiles(files: Map<string, Blob>) {
  if (editorStore.hasProjectData) {
    const confirmed = confirm(t('confirmImportProject'))
    if (!confirmed) {
      return
    }
  }

  try {
    const projectData = await parseProjectFiles(files)
    await editorStore.applyProject(projectData)
    notify.success(t('projectImportSuccess'))
  } catch (error) {
    console.error('Project import failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    notify.error(t('projectImportFailed', { message }))
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()

  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !dataTransfer.files.length) {
    return
  }

  const files = Array.from(dataTransfer.files)
  const zipFile = files.find((file) => file.name.toLowerCase().endsWith('.zip'))

  if (zipFile) {
    try {
      const map = await readZipProject(zipFile)
      await importProjectFromFiles(map)
    } catch (error) {
      console.error('Project ZIP import failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      notify.error(t('projectImportFailed', { message }))
    }
    return
  }

  const map = buildFileMapFromFileList(dataTransfer.files)
  if (map.size > 0) {
    await importProjectFromFiles(map)
  }
}

onMounted(() => {
  initLocale()
  editorStore.loadFromLocalStorage()
  editorStore.restoreAssets()

  window.addEventListener('dragover', preventDragDefault)
  window.addEventListener('drop', handleDrop)

  setTimeout(() => {
    if (editorStore.characterEntries.length > 0 && editorStore.baseImage) {
      editorStore.renderTrigger++
    }
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('dragover', preventDragDefault)
  window.removeEventListener('drop', handleDrop)
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
