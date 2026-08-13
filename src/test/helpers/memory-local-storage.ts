/**
 * 内存 localStorage 实现，覆盖 setup.ts 的 vi.fn mock，
 * 供需要断言 localStorage 内容的测试使用。
 * 支持注入 setItem 失败（模拟浏览器 localStorage 写入异常）。
 */
export interface MemoryLocalStorage {
  get(key: string): string | null
  raw: Map<string, string>
  /** 注入下一次 setItem 失败（可限定 key 前缀；不传则任何 key 都失败） */
  failNextSetItem(keyPrefix?: string): void
  /** 注入下一次 removeItem 失败（可限定 key 前缀；不传则任何 key 都失败） */
  failNextRemoveItem(keyPrefix?: string): void
}

export function installMemoryLocalStorage(): MemoryLocalStorage {
  const memory = new Map<string, string>()
  let failSetPrefix: string | null = null
  let failRemovePrefix: string | null = null

  const store = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failSetPrefix !== null && key.startsWith(failSetPrefix)) {
        failSetPrefix = null
        throw new Error(`localStorage write failed for key: ${key}`)
      }
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      if (failRemovePrefix !== null && key.startsWith(failRemovePrefix)) {
        failRemovePrefix = null
        throw new Error(`localStorage remove failed for key: ${key}`)
      }
      memory.delete(key)
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  })

  return {
    get: (key: string) => memory.get(key) ?? null,
    raw: memory,
    failNextSetItem(keyPrefix?: string) {
      failSetPrefix = keyPrefix ?? ''
    },
    failNextRemoveItem(keyPrefix?: string) {
      failRemovePrefix = keyPrefix ?? ''
    },
  }
}
