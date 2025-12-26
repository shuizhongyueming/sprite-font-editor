<template>
  <div class="toolbar-container">
    <div class="toolbar-left">
      <button
        class="btn btn-primary"
        @click="uploadImage"
      >
        {{ t('uploadImage') }}
      </button>
      <button
        class="btn btn-secondary"
        @click="uploadFont"
      >
        {{ t('uploadFont') }}
      </button>
      <button
        class="btn btn-info"
        :disabled="!canExport"
        @click="exportImage"
      >
        {{ t('exportPNG') }}
      </button>
    </div>

    <div class="toolbar-center">
      <div class="insert-point-control">
        <span>{{ t('insertPoint') }}</span>
        <label class="radio-label">
          <input
            v-model="insertPointMode"
            type="radio"
            value="auto"
          >
          {{ t('autoMode') }}
        </label>
        <label class="radio-label">
          <input
            v-model="insertPointMode"
            type="radio"
            value="manual"
          >
          {{ t('manualMode') }}
        </label>
      </div>
    </div>

    <div class="toolbar-right">
      <button
        class="btn btn-language"
        @click="toggleLanguage"
        :title="currentLocale === 'zh-CN' ? 'Switch to English' : '切换到中文'"
      >
        {{ currentLocale === 'zh-CN' ? 'EN' : '中文' }}
      </button>
      <button
        class="btn btn-danger"
        @click="clearAll"
      >
        {{ t('clearAll') }}
      </button>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageUpload"
    >
    <input
      ref="fontInput"
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      style="display: none"
      @change="handleFontUpload"
    >
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { isValidImageFile, isValidFontFile } from '@/utils/file'
import { exportWithOriginalSize } from '@/utils/download'
import { notify } from '@/utils/notification'
import { t, getLocale, toggleLocale } from '@/utils/i18n'

const editorStore = useEditorStore()

const imageInput = ref<HTMLInputElement>()
const fontInput = ref<HTMLInputElement>()
const currentLocale = computed(() => getLocale())

const insertPointMode = computed({
  get: () => editorStore.insertPointConfig.mode,
  set: (value: 'auto' | 'manual') => {
    editorStore.insertPointConfig.mode = value
    editorStore.saveToLocalStorage()
    
    // 如果切换到自动模式，触发插入点检测
    if (value === 'auto' && editorStore.canvasLayer) {
      console.log('[Toolbar] 切换到自动模式，开始检测插入点')
      setTimeout(() => {
        if (editorStore.canvasLayer) {
          editorStore.detectInsertPoints(editorStore.canvasLayer)
        }
      }, 50)
    }
  }
})

const canRender = computed(() => {
  return editorStore.baseImage &&
         editorStore.currentFont &&
         editorStore.characterEntries.length > 0
})

const canExport = computed(() => {
  return editorStore.baseImage !== null
})

function uploadImage() {
  imageInput.value?.click()
}

function uploadFont() {
  fontInput.value?.click()
}

function toggleLanguage() {
  toggleLocale()
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!isValidImageFile(file)) {
    notify.warning(t('invalidImageFile'))
    return
  }

  try {
    const blob = file.slice(0, file.size, file.type)
    const image = new Image()
    image.onload = () => {
      // 传递 blob 以便保存到 IndexedDB
      editorStore.setBaseImage(image, blob)
      editorStore.saveToLocalStorage()
    };
    image.onerror = (error) => {
      console.error('Failed to load image:', error)
    };
    image.src = URL.createObjectURL(blob)
  } catch (error) {
    console.error('Failed to load image:', error)
    notify.error(t('imageLoadFailed'))
  }
}

async function handleFontUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!isValidFontFile(file)) {
    notify.warning(t('invalidFontFile'))
    return
  }

  try {
    const data = await file.arrayBuffer()
    // 使用不带扩展名的名称作为 font family
    const fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')
    const fontFace = new FontFace(fontName, data)
    await fontFace.load()

    // 注册字体
    document.fonts.add(fontFace)

    // 传递数据以便保存到 IndexedDB
    editorStore.setFont(fontFace, data)
    editorStore.saveToLocalStorage()

    notify.success(t('fontLoadSuccess'))
  } catch (error) {
    console.error('Failed to load font:', error)
    notify.error(t('fontLoadFailed'))
  }
}

async function exportImage() {
  try {
    if (!editorStore.baseImage) {
      notify.warning(t('pleaseUploadImage'))
      return
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `sprite-font-${timestamp}.png`

    // 使用原始尺寸导出，直接使用 base 配置
    await exportWithOriginalSize(
      editorStore.baseImage,
      editorStore.baseCellConfig,
      editorStore.baseImageConfig,
      editorStore.characterEntries,
      editorStore.characterStyle,
      editorStore.cellAlignment,
      editorStore.insertPointConfig,
      filename
    )

    notify.success(t('exportSuccess'))
    console.log('Image exported successfully', filename)
  } catch (error) {
    console.error('Export failed:', error)
    notify.error(t('exportFailed'))
  }
}

function clearAll() {
  if (confirm(t('confirmClear'))) {
    editorStore.clearAllData()
    notify.info(t('cleared'))
  }
}
</script>

<style scoped>
.toolbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  gap: 1rem;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
  border-color: #545b62;
}

.btn-language {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
  min-width: 60px;
}

.btn-language:hover {
  background-color: #545b62;
  border-color: #545b62;
}

.btn-success {
  background-color: #28a745;
  color: white;
  border-color: #28a745;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
  border-color: #1e7e34;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.btn-info:hover:not(:disabled) {
  background-color: #117a8b;
  border-color: #117a8b;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #bd2130;
  border-color: #bd2130;
}

.insert-point-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}
</style>
