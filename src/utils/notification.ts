import AppNotification from '@/components/AppNotification.vue'
import { createApp, h } from 'vue'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface NotificationOptions {
  message: string
  type?: NotificationType
  duration?: number // 0 表示不自动关闭
}

// 使用函数式调用显示通知
export function showNotification(options: NotificationOptions) {
  const { message, type = 'info', duration = 3000 } = options

  // 创建容器
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 创建关闭回调
  const onHide = () => {
    app.unmount()
    document.body.removeChild(container)
  }

  // 创建组件
  const app = createApp({
    setup() {
      return () => h(AppNotification, {
        message,
        type,
        duration,
        onHide,
      })
    },
  })

  app.mount(container)
}

// 快捷方法
export const notify = {
  info: (message: string, duration?: number) => 
    showNotification({ message, type: 'info', duration }),
  
  success: (message: string, duration?: number) => 
    showNotification({ message, type: 'success', duration }),
  
  warning: (message: string, duration?: number) => 
    showNotification({ message, type: 'warning', duration }),
  
  error: (message: string, duration?: number) => 
    showNotification({ message, type: 'error', duration }),
}

export default notify
