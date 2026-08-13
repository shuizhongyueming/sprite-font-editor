import { describe, it, expect, beforeEach } from 'vitest'
import {
  C3GenerationStorage,
  C3_STORAGE_VERSION,
  type C3StoredConfig,
} from '@/utils/storage'
import {
  resetFakeIndexedDB,
  failNextIndexedDBPut,
  failNextIndexedDBTransaction,
  getFakeIndexedDBAssetIds,
} from './fake-indexeddb'
import { installMemoryLocalStorage, type MemoryLocalStorage } from './helpers/memory-local-storage'
import { makePngBlob } from './helpers/c3-fixtures'

const ACTIVE_KEY = 'sprite-font-editor-c3-active-generation'

function makeConfig(overrides: Partial<C3StoredConfig> = {}): C3StoredConfig {
  return {
    version: C3_STORAGE_VERSION,
    instanceArrayJson: '["",true,16,16,"AB","[]",1,0,0,0,0,0,true,null,false]',
    importedCharacterSet: 'AB',
    importedSpacingData: '[]',
    importedCharacterSpacing: 0,
    importedLineHeight: 0,
    globalExtraSpacing: 0,
    appendedEntries: [],
    originalImageWidth: 64,
    originalImageHeight: 64,
    imageFilename: 'c3-sprite.png',
    ...overrides,
  }
}

describe('C3GenerationStorage', () => {
  let ls: MemoryLocalStorage

  beforeEach(() => {
    resetFakeIndexedDB()
    ls = installMemoryLocalStorage()
  })

  it('stages and commits a generation, then loads it back', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, canvasBg: 'black' },
      c3Config: makeConfig(),
      image: null,
    })

    // stage 不更新 active 指针
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()

    C3GenerationStorage.commit(genId)

    const activeId = C3GenerationStorage.readActiveC3GenerationId()
    expect(activeId).toBe(genId)

    const generation = C3GenerationStorage.readActiveC3Generation()
    expect(generation?.generalState).toEqual({ isC3Mode: true, canvasBg: 'black' })
    expect(generation?.c3Config.version).toBe(C3_STORAGE_VERSION)
    expect(generation?.c3Config.importedCharacterSet).toBe('AB')
  })

  it('stages image asset into versioned IndexedDB key before commit resolves', async () => {
    const draft = {
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    }

    const genId = await C3GenerationStorage.stage(draft)
    C3GenerationStorage.commit(genId)

    const asset = await C3GenerationStorage.loadActiveC3ImageAsset()
    expect(asset).not.toBeNull()
    expect(asset!.blob).toEqual(draft.image!.blob)
    expect(asset!.width).toBe(32)
    expect(asset!.height).toBe(32)

    // config 记录了 asset id
    const generation = C3GenerationStorage.readActiveC3Generation()
    expect(generation?.c3Config.imageAssetId).toContain('c3-image-')
  })

  it('keeps the previous active pointer untouched until commit', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 1 },
      c3Config: makeConfig(),
      image: null,
    })
    C3GenerationStorage.commit(genA)

    await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 2 },
      c3Config: makeConfig(),
      image: null,
    })

    // 未 commit 前 active 仍是 A
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(genA)
    expect(C3GenerationStorage.readActiveC3Generation()?.generalState).toEqual({
      isC3Mode: true,
      n: 1,
    })
  })

  it('fails closed when IndexedDB put fails and removes staged data', async () => {
    failNextIndexedDBPut()

    await expect(
      C3GenerationStorage.stage({
        generalState: { isC3Mode: true },
        c3Config: makeConfig(),
        image: { blob: makePngBlob(), width: 32, height: 32 },
      }),
    ).rejects.toThrow()

    // staged keys 被清理，active 指针未变
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
    const localStorage = globalThis.localStorage as unknown as {
      getItem(key: string): string | null
      key(index: number): string | null
      length: number
    }
    let stagedKeys = 0
    for (let i = 0; i < localStorage.length; i++) {
      if ((localStorage.key(i) ?? '').startsWith('sprite-font-editor-c3-')) {
        stagedKeys++
      }
    }
    expect(stagedKeys).toBe(0)
  })

  it('fails when the IndexedDB transaction aborts', async () => {
    failNextIndexedDBTransaction()

    await expect(
      C3GenerationStorage.stage({
        generalState: { isC3Mode: true },
        c3Config: makeConfig(),
        image: { blob: makePngBlob(), width: 32, height: 32 },
      }),
    ).rejects.toThrow()
  })

  it('discards a staged generation and its asset', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })

    await C3GenerationStorage.discard(genId)

    expect(C3GenerationStorage.readC3Generation(genId)).toBeNull()
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).toBeNull()
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
  })

  it('cleanup keeps a reused asset referenced by the new active generation', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 1 },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genA)

    // 新 generation 复用 A 的 asset（image: null 且 config.imageAssetId 沿用）
    const genB = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 2 },
      c3Config: makeConfig({ imageAssetId: 'c3-image-' + genA }),
      image: null,
    })
    C3GenerationStorage.commit(genB)
    C3GenerationStorage.cleanup(genA)

    // B 引用的 asset 仍可读取
    const generation = C3GenerationStorage.readActiveC3Generation()
    expect(generation?.c3Config.imageAssetId).toBe('c3-image-' + genA)
    expect(generation?.id).toBe(genB)
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).not.toBeNull()
    // A 的 keys 已清理
    expect(C3GenerationStorage.readC3Generation(genA)).toBeNull()
  })

  it('cleanup removes an unreferenced old generation asset (no leak)', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 1 },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genA)

    // 新 generation 写入自己的全新 asset（apply 精简的场景）
    const genB = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 2 },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 9 },
    })
    C3GenerationStorage.commit(genB)
    C3GenerationStorage.cleanup(genA)
    // asset 删除是 best-effort 异步，等待完成
    await new Promise((resolve) => setTimeout(resolve, 0))

    // A 的 keys 与 asset 都被清理；只剩 B 的 asset
    expect(C3GenerationStorage.readC3Generation(genA)).toBeNull()
    expect(getFakeIndexedDBAssetIds().sort()).toEqual(['c3-image-' + genB])
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).not.toBeNull()
  })

  it('fails closed when localStorage setItem throws during stage and cleans up', async () => {
    const ls = installMemoryLocalStorage()
    ls.failNextSetItem('sprite-font-editor-c3-state-')

    await expect(
      C3GenerationStorage.stage({
        generalState: { isC3Mode: true },
        c3Config: makeConfig(),
        image: null,
      }),
    ).rejects.toThrow('localStorage write failed')

    // 无残留 staged keys、无 active 指针
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
    let staged = 0
    for (const key of ls.raw.keys()) {
      if (key.startsWith('sprite-font-editor-c3-')) {
        staged++
      }
    }
    expect(staged).toBe(0)
  })

  it('commit writes the active pointer as the single commit point (localStorage failure throws)', async () => {
    const ls = installMemoryLocalStorage()
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: null,
    })

    ls.failNextSetItem('sprite-font-editor-c3-active-generation')
    expect(() => C3GenerationStorage.commit(genId)).toThrow('localStorage write failed')

    // 指针未写入
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
  })

  it('clearAll removes the active pointer, keys and assets', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genId)

    await C3GenerationStorage.clearAll()

    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
    expect(C3GenerationStorage.readC3Generation(genId)).toBeNull()
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).toBeNull()
  })

  it('cleanup tolerates localStorage removeItem failures (best-effort)', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: null,
    })
    C3GenerationStorage.commit(genId)

    ls.failNextRemoveItem('sprite-font-editor-c3-state-')
    expect(() => C3GenerationStorage.cleanup(genId)).not.toThrow()
    // 删除失败不抛；generation 仍可读（部分残留由 best-effort 容忍）
    expect(C3GenerationStorage.readC3Generation(genId)).not.toBeNull()
  })

  it('prune keeps only the active generation and removes orphans', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 1 },
      c3Config: makeConfig(),
      image: null,
    })
    C3GenerationStorage.commit(genA)

    // 两个并存的 generation（模拟并发提交留下的 B、C 都曾 active 的场景）
    const genB = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 2 },
      c3Config: makeConfig(),
      image: null,
    })
    C3GenerationStorage.commit(genB)
    const genC = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 3 },
      c3Config: makeConfig(),
      image: null,
    })
    C3GenerationStorage.commit(genC)

    C3GenerationStorage.prune()

    // 只剩 active（genC），A/B 均被清理
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(genC)
    expect(C3GenerationStorage.readC3Generation(genA)).toBeNull()
    expect(C3GenerationStorage.readC3Generation(genB)).toBeNull()
    expect(C3GenerationStorage.readC3Generation(genC)).not.toBeNull()
  })

  it('clearAll removes reused assets by config reference (no leak)', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genA)

    // B 复用 A 的 asset；cleanup A 后 asset 保留（被 B 引用）
    const genB = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig({ imageAssetId: 'c3-image-' + genA }),
      image: null,
    })
    C3GenerationStorage.commit(genB)
    C3GenerationStorage.cleanup(genA)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getFakeIndexedDBAssetIds()).toEqual(['c3-image-' + genA])

    await C3GenerationStorage.clearAll()

    // 复用 asset（c3-image-A，非现存 generation id）也必须被清除
    expect(getFakeIndexedDBAssetIds()).toEqual([])
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
    void genB
  })

  it('stage failure does not remove a reused active asset', async () => {
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genA)

    // autosave 复用 A 的 asset，但 localStorage 写失败 → stage reject
    ls.failNextSetItem('sprite-font-editor-c3-state-')
    await expect(
      C3GenerationStorage.stage({
        generalState: { isC3Mode: true },
        c3Config: makeConfig({ imageAssetId: 'c3-image-' + genA }),
        image: null,
      }),
    ).rejects.toThrow()

    // active 仍是 A，A 的 asset 未被误删
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBe(genA)
    expect(await C3GenerationStorage.loadActiveC3ImageAsset()).not.toBeNull()
    expect(getFakeIndexedDBAssetIds()).toEqual(['c3-image-' + genA])
  })

  it('cleanup removes the actual referenced asset once the last reference is gone', async () => {
    // A 创建 asset A
    const genA = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 1 },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genA)

    // B 无图保存复用 asset A；cleanup A 后 asset 保留（B 引用）
    const genB = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 2 },
      c3Config: makeConfig({ imageAssetId: 'c3-image-' + genA }),
      image: null,
    })
    C3GenerationStorage.commit(genB)
    C3GenerationStorage.cleanup(genA)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getFakeIndexedDBAssetIds()).toEqual(['c3-image-' + genA])

    // D 精简创建 asset D；prune 清理 B —— 应删除 B 实际引用的 asset A
    const genD = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true, n: 3 },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 9 },
    })
    C3GenerationStorage.commit(genD)
    C3GenerationStorage.prune()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(C3GenerationStorage.readC3Generation(genB)).toBeNull()
    expect(getFakeIndexedDBAssetIds()).toEqual(['c3-image-' + genD])

    // clearAll 后 IDB 为空
    await C3GenerationStorage.clearAll()
    expect(getFakeIndexedDBAssetIds()).toEqual([])
  })

  it('clearAll tolerates localStorage failures (best-effort)', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: { blob: makePngBlob(), width: 32, height: 32 },
    })
    C3GenerationStorage.commit(genId)

    ls.failNextRemoveItem('sprite-font-editor-c3-state-')
    await expect(C3GenerationStorage.clearAll()).resolves.toBeUndefined()
    // 指针已尽力清理（removeItem 失败发生在 state key，指针删除先执行）
    expect(C3GenerationStorage.readActiveC3GenerationId()).toBeNull()
  })

  it('stores the general state and config under distinct versioned keys', async () => {
    const genId = await C3GenerationStorage.stage({
      generalState: { isC3Mode: true },
      c3Config: makeConfig(),
      image: null,
    })

    const stateKey = `sprite-font-editor-c3-state-${genId}`
    const configKey = `sprite-font-editor-c3-config-${genId}`

    expect(JSON.parse((globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(stateKey)!) ).toEqual({ isC3Mode: true })
    const config = JSON.parse((globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(configKey)!) as C3StoredConfig
    expect(config.version).toBe(C3_STORAGE_VERSION)

    // active 指针是独立的单一 key
    const pointer = (globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(ACTIVE_KEY)
    expect(pointer).toBeNull()
  })
})
