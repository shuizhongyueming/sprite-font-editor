<template>
  <div class="toolbar-container">
    <div class="toolbar-left">
      <button
        class="btn btn-primary"
        @click="uploadImage"
      >
        上传图片
      </button>
      <button
        class="btn btn-secondary"
        @click="uploadFont"
      >
        上传字体
      </button>
      <button
        class="btn btn-info"
        :disabled="!canExport"
        @click="exportImage"
      >
        导出PNG
      </button>
    </div>

    <div class="toolbar-center">
      <div class="insert-point-control">
        <span>插入点:</span>
        <label class="radio-label">
          <input
            v-model="insertPointMode"
            type="radio"
            value="auto"
          >
          自动
        </label>
        <label class="radio-label">
          <input
            v-model="insertPointMode"
            type="radio"
            value="manual"
          >
          手动
        </label>
      </div>
    </div>

    <div class="toolbar-right">
      <button
        class="btn btn-danger"
        @click="clearAll"
      >
        清空
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


const editorStore = useEditorStore()

const imageInput = ref<HTMLInputElement>()
const fontInput = ref<HTMLInputElement>()

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

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  console.log('handleImageUpload', file);
  if (!file) return

  if (!isValidImageFile(file)) {
    notify.warning('请选择有效的图片文件 (PNG, JPG, GIF, WebP)')
    return
  }

  try {
    const image = new Image()
    image.onload = () => {
      console.log('Image loaded successfully');
      editorStore.setBaseImage(image)
      editorStore.saveToLocalStorage()
    };
    image.onerror = (error) => {
      console.error('Failed to load image:', error)
    };
    image.src = URL.createObjectURL(file)
    console.log('start image load with url', image.src);
  } catch (error) {
    console.error('Failed to load image:', error)
    notify.error('图片加载失败')
  }
}

async function handleFontUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!isValidFontFile(file)) {
    notify.warning('请选择有效的字体文件 (TTF, OTF, WOFF)')
    return
  }

  try {
    const buffer = await file.arrayBuffer()
    // 使用不带扩展名的名称作为 font family
    const fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')
    const fontFace = new FontFace(fontName, buffer)
    await fontFace.load()

    // 注册字体
    document.fonts.add(fontFace)

    editorStore.setFont(fontFace)
    editorStore.saveToLocalStorage()

    notify.success('字体上传成功！')
  } catch (error) {
    console.error('Failed to load font:', error)
    notify.error('字体加载失败')
  }
}

async function exportImage() {
  try {
    if (!editorStore.baseImage) {
      notify.warning('请先上传图片')
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

    notify.success('图片导出成功！')
    console.log('Image exported successfully', filename)
  } catch (error) {
    console.error('Export failed:', error)
    notify.error('导出失败，请重试')
  }
}

function clearAll() {
  if (confirm('确定要清空所有内容吗？')) {
    editorStore.clearState()
    notify.info('已清空所有内容')
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
