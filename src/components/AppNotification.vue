<template>
  <div
    v-if="visible"
    class="notification"
    :class="`notification-${type}`"
    @click="hide"
  >
    <span class="notification-message">{{ message }}</span>
    <button
      v-if="duration === 0"
      class="notification-close"
      @click.stop="hide"
    >
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Props {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number // 0 表示不自动关闭
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
})

const emit = defineEmits<{
  hide: []
}>()

const visible = ref(false)
let timer: number | null = null

function show() {
  visible.value = true
  
  if (props.duration > 0) {
    timer = window.setTimeout(() => {
      hide()
    }, props.duration)
  }
}

function hide() {
  visible.value = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  emit('hide')
}

onMounted(() => {
  show()
})

// 监听 message 变化，重新显示
watch(() => props.message, () => {
  if (props.message) {
    hide()
    // 稍微延迟再显示，以便触发过渡效果
    setTimeout(() => {
      show()
    }, 10)
  }
})

// 暴露方法给父组件
defineExpose({
  show,
  hide,
})
</script>

<style scoped>
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 250px;
  max-width: 400px;
  animation: slideIn 0.3s ease-out;
  cursor: pointer;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-info {
  background-color: #17a2b8;
}

.notification-success {
  background-color: #28a745;
}

.notification-warning {
  background-color: #ffc107;
  color: #333;
}

.notification-error {
  background-color: #dc3545;
}

.notification-message {
  flex: 1;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  color: currentColor;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.notification-close:hover {
  opacity: 1;
}
</style>
