<template>
  <div class="character-input">
    <div class="form-group">
      <label>{{ t('inputText') }}</label>
      <textarea
        v-model="textInput"
        class="form-control text-input"
        :placeholder="t('inputTextPlaceholder')"
        rows="3"
        @input="handleTextInput"
      />
    </div>
    
    <!-- 字符列表和按钮 -->
    <div
      v-if="characterEntries.length > 0"
      class="character-controls"
    >
      <!-- 紧凑的字符列表（单行） -->
      <div class="character-scroll-container">
        <div class="character-items">
          <div
            v-for="(entry, index) in characterEntries"
            :key="index"
            class="character-item"
            :class="{ active: editorStore.selectedCharIndex === index }"
            :title="`${t('clickToHighlight')}: ${entry.char}`"
            @click="selectCharacter(index)"
          >
            <span class="character-char">{{ entry.char }}</span>
            <span class="character-index">{{ index + 1 }}</span>
            
            <!-- 边距显示（只读） -->
            <div class="margin-preview">
              <div class="margin-icon">
                <span
                  class="margin-value"
                  :style="{ top: `${entry.margin.top}px` }"
                >{{ entry.margin.top }}</span>
                <span
                  class="margin-value"
                  :style="{ right: `${entry.margin.right}px` }"
                >{{ entry.margin.right }}</span>
                <span
                  class="margin-value"
                  :style="{ bottom: `${entry.margin.bottom}px` }"
                >{{ entry.margin.bottom }}</span>
                <span
                  class="margin-value"
                  :style="{ left: `${entry.margin.left}px` }"
                >{{ entry.margin.left }}</span>
                <div class="char-box">
                  {{ entry.char }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 按钮组 -->
      <div class="button-group">
        <span class="character-count">{{ t('charCount', { count: characterEntries.length }) }}</span>
        <button 
          class="btn btn-sm btn-outline-danger" 
          @click="clearCharacters"
        >
          {{ t('clear') }}
        </button>
        <button
          class="btn btn-sm btn-success"
          :disabled="!canRender"
          @click="renderCharacters"
        >
          {{ t('renderText') }}
        </button>
      </div>
    </div>
    
    <!-- 边距编辑弹窗 -->
    <div
      v-if="showMarginPopup && editorStore.selectedCharIndex !== null"
      ref="marginPopup"
      class="margin-popup"
      :style="popupPosition"
    >
      <div class="popup-header">
        <span>{{ t('editMargin') }} "{{ selectedChar }}"</span>
        <button
          class="close-btn"
          @click="closeMarginPopup"
        >
          ×
        </button>
      </div>
      <SpacingInput
        v-model="selectedCharMargin"
        :label="t('marginLabel')"
        @change="saveMargin"
      />
      <div class="popup-actions">
        <button
          class="btn btn-sm btn-primary"
          @click="closeMarginPopup"
        >
          {{ t('confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import SpacingInput from './SpacingInput.vue'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

const textInput = ref('')
const showMarginPopup = ref(false)
const marginPopup = ref<HTMLElement>()

const characterEntries = computed(() => editorStore.characterEntries)

const selectedChar = computed(() => {
  if (editorStore.selectedCharIndex === null) return ''
  return characterEntries.value[editorStore.selectedCharIndex]?.char || ''
})

const selectedCharMargin = computed({
  get: () => {
    if (editorStore.selectedCharIndex === null) return { top: 0, right: 0, bottom: 0, left: 0 }
    return characterEntries.value[editorStore.selectedCharIndex]?.margin || { top: 0, right: 0, bottom: 0, left: 0 }
  },
  set: (value) => {
    if (editorStore.selectedCharIndex !== null) {
      editorStore.characterEntries[editorStore.selectedCharIndex].margin = value
    }
  }
})

const canRender = computed(() => {
  return editorStore.baseImage &&
         editorStore.currentFont &&
         editorStore.characterEntries.length > 0
})

const popupPosition = computed(() => {
  if (editorStore.selectedCharIndex === null) return {}
  
  // 计算弹窗位置（相对于viewport）
  const charElement = document.querySelector(`[data-char-index="${editorStore.selectedCharIndex}"]`)
  if (!charElement) return {}
  
  const rect = charElement.getBoundingClientRect()
  return {
    left: `${rect.right + 10}px`,
    top: `${rect.top}px`,
  }
})

function handleTextInput() {
  editorStore.updateCharacters(textInput.value)
  editorStore.saveToLocalStorage()
  editorStore.selectedCharIndex = null
  showMarginPopup.value = false
}

function clearCharacters() {
  textInput.value = ''
  editorStore.updateCharacters('')
  editorStore.saveToLocalStorage()
  editorStore.selectedCharIndex = null
  showMarginPopup.value = false
}

// 显示边距编辑弹窗（带边界检查）
function showMarginEditorAt(left: number, top: number) {
  console.log('[CharacterInput] showMarginEditorAt called:', { left, top })
  
  // 获取视口尺寸
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // 预估弹窗尺寸
  const estimatedWidth = 250
  const estimatedHeight = 180
  
  let adjustedLeft = Math.max(10, Math.min(left, viewportWidth - estimatedWidth - 10))
  let adjustedTop = Math.max(10, Math.min(top, viewportHeight - estimatedHeight - 10))
  
  console.log('[CharacterInput] 调整后位置:', { adjustedLeft, adjustedTop })
  
  // 先设置位置再显示弹窗
  nextTick(() => {
    if (marginPopup.value) {
      marginPopup.value.style.left = `${adjustedLeft}px`
      marginPopup.value.style.top = `${adjustedTop}px`
      console.log('[CharacterInput] 设置弹窗位置完成')
    }
  })
  
  // 显示弹窗
  showMarginPopup.value = true
  console.log('[CharacterInput] showMarginPopup 设置为 true')
}

function selectCharacter(index: number) {
  // 这个函数现在只在点击字符列表时调用
  // 不在画布上弹出
  editorStore.selectedCharIndex = index
}

function closeMarginPopup() {
  showMarginPopup.value = false
  editorStore.selectedCharIndex = null
  editorStore.saveToLocalStorage()
}

function saveMargin() {
  editorStore.saveToLocalStorage()
  
  // 重新渲染
  if (editorStore.baseImage && editorStore.characterEntries.length > 0) {
    editorStore.renderTrigger++
  }
}

function renderCharacters() {
  // 触发字符渲染，使用当前插入点开始排版
  console.log('Rendering characters from insert point:', editorStore.insertPointConfig.startCellIndex)
  
  // 触发渲染
  editorStore.renderTrigger++
  editorStore.saveToLocalStorage()
  
  notify.success(t('renderComplete'))
}

// 点击外部关闭弹窗
function handleClickOutside(event: MouseEvent) {
  if (showMarginPopup.value && marginPopup.value) {
    const target = event.target as Node
    if (!marginPopup.value.contains(target)) {
      const charElements = document.querySelectorAll('.character-item')
      let clickedOnChar = false
      
      charElements.forEach(el => {
        if (el.contains(target)) {
          clickedOnChar = true
        }
      })
      
      if (!clickedOnChar) {
        closeMarginPopup()
      }
    }
  }
}

// Esc键关闭弹窗
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showMarginPopup.value) {
    closeMarginPopup()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  showMarginEditorAt
})

// 监听字符变化，更新data-*属性
watch(characterEntries, () => {
  nextTick(() => {
    const charElements = document.querySelectorAll('.character-item')
    charElements.forEach((el, index) => {
      el.setAttribute('data-char-index', index.toString())
    })
  })
}, { deep: true })
</script>

<style scoped>
.character-input {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

.text-input {
  resize: vertical;
  min-height: 80px;
}

.character-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.character-scroll-container {
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
}

.character-items {
  display: flex;
  gap: 0.5rem;
  min-width: max-content;
}

.character-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  min-width: 60px;
  transition: all 0.2s;
}

.character-item:hover {
  border-color: #007bff;
  transform: translateY(-2px);
}

.character-item.active {
  border-color: #28a745;
  background-color: #d4edda;
  box-shadow: 0 0 8px rgba(40, 167, 69, 0.3);
}

.character-char {
  font-size: 1.25rem;
  font-weight: 500;
  color: #495057;
  line-height: 1;
}

.character-index {
  font-size: 0.625rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.margin-preview {
  margin-top: 0.25rem;
}

.margin-icon {
  position: relative;
  width: 24px;
  height: 24px;
  border: 1px solid #dee2e6;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.margin-value {
  position: absolute;
  font-size: 0.5rem;
  color: #6c757d;
  background: white;
  padding: 0 2px;
  border-radius: 2px;
}

.margin-value:nth-child(1) { top: -6px; left: 50%; transform: translateX(-50%); }
.margin-value:nth-child(2) { right: -8px; top: 50%; transform: translateY(-50%); }
.margin-value:nth-child(3) { bottom: -6px; left: 50%; transform: translateX(-50%); }
.margin-value:nth-child(4) { left: -8px; top: 50%; transform: translateY(-50%); }

.char-box {
  font-size: 0.5rem;
  color: #495057;
  font-weight: bold;
}

.button-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.character-count {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.margin-popup {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  z-index: 1500;
  min-width: 200px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #495057;
}

.popup-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
}

:deep(.spacing-input) {
  font-size: 0.75rem;
}

:deep(.spacing-input input) {
  padding: 0.25rem;
  font-size: 0.75rem;
}

.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
}

.btn-outline-danger {
  background-color: transparent;
  color: #dc3545;
  border-color: #dc3545;
}

.btn-outline-danger:hover:not(:disabled) {
  background-color: #dc3545;
  color: white;
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
</style>