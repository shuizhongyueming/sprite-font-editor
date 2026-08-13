/**
 * jsdom 里 HTMLImageElement 的 onload 不会自动触发；
 * 用 src setter 触发 onload 的 fake，供恢复/导入流程测试使用。
 */
export class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 0
  height = 0
  naturalWidth = 0
  naturalHeight = 0

  constructor(width = 0, height = 0) {
    this.width = width
    this.height = height
    this.naturalWidth = width
    this.naturalHeight = height
  }

  set src(_url: string) {
    queueMicrotask(() => this.onload?.())
  }

  get src() {
    return ''
  }
}

export function flushImageLoads(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
