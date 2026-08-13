/**
 * IndexedDB 存储模块
 * 用于存储图片和字体文件，支持页面刷新后恢复
 */

const DB_NAME = "sprite-font-editor-store";
const DB_VERSION = 1;
const STORE_NAME = "assets";

interface StoredAsset {
  id: string;
  type: "image" | "font";
  data: Blob | ArrayBuffer;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface C3StoredConfig {
  version: number;
  instanceArrayJson: string;
  importedCharacterSet: string;
  importedSpacingData: string;
  importedCharacterSpacing: number;
  importedLineHeight: number;
  globalExtraSpacing: number;
  c3AppendedVerticalAlignment?: "top" | "middle" | "bottom";
  appendedEntries: Array<{
    char: string;
    margin: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    autoDisplayWidth: number;
    autoGlyphHeight: number;
    extraSpacing: number;
    distributionOffset?: number;
    // 向后兼容旧数据
    displayWidth?: number;
    isDisplayWidthManual?: boolean;
  }>;
  originalImageWidth: number;
  originalImageHeight: number;
  imageFilename?: string;
  /** v3+：版本化 IndexedDB C3 图片 asset id（generation 存储的一部分） */
  imageAssetId?: string;
}

let db: IDBDatabase | null = null;

/**
 * 打开 IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      console.error("[Storage] Failed to open IndexedDB:", error);
      reject(error);
      return;
    }

    request.onerror = () => {
      console.error("[Storage] Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * 保存数据到 IndexedDB。
 * 等待 request 成功与 transaction 完成才 resolve；失败（request error / abort）则 reject。
 */
async function save(
  id: string,
  type: "image" | "font",
  data: Blob | ArrayBuffer,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const database = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const asset: StoredAsset = {
      id,
      type,
      data,
      metadata,
      createdAt: Date.now(),
    };

    let settled = false;
    const succeed = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const fail = (error: unknown) => {
      if (!settled) {
        settled = true;
        console.error("[Storage] Failed to save:", error);
        reject(error);
      }
    };

    const request = store.put(asset);
    request.onerror = () => fail(request.error ?? new Error("IDB put failed"));
    request.onsuccess = () => {
      // 等待事务完成才视为持久化成功
    };
    transaction.onerror = () =>
      fail(transaction.error ?? new Error("IDB transaction failed"));
    transaction.onabort = () =>
      fail(transaction.error ?? new Error("IDB transaction aborted"));
    transaction.oncomplete = succeed;
  });
}

/**
 * 从 IndexedDB 获取数据
 */
async function get(id: string): Promise<StoredAsset | null> {
  try {
    const database = await openDB();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onerror = () => {
        console.error("[Storage] Failed to get:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result as StoredAsset | undefined;
        resolve(result ?? null);
      };
    });
  } catch (error) {
    console.error("[Storage] Failed to get:", error);
    return null;
  }
}

/**
 * 删除数据。
 * 等待 request 成功与事务完成；失败记录日志（best-effort，不抛出）。
 */
async function remove(id: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        console.error("[Storage] Failed to remove:", request.error);
        resolve();
      };
      request.onsuccess = () => {
        // 等待事务完成
      };
      transaction.onerror = () => {
        console.error("[Storage] Failed to remove:", transaction.error);
        resolve();
      };
      transaction.onabort = () => {
        console.error("[Storage] Failed to remove:", transaction.error);
        resolve();
      };
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error("[Storage] Failed to remove:", error);
  }
}

// ==================== 图片存储 ====================

export const ImageStorage = {
  key: "image",

  async save(blob: Blob, width: number, height: number): Promise<void> {
    await save(this.key, "image", blob, { width, height, mimeType: blob.type });
  },

  async load(): Promise<{ blob: Blob; width: number; height: number; mimeType?: string } | null> {
    const result = await get(this.key);
    if (result && result.type === "image" && result.data instanceof Blob) {
      return {
        blob: result.data,
        width: (result.metadata.width as number) || 0,
        height: (result.metadata.height as number) || 0,
        mimeType: (result.metadata.mimeType as string) || undefined,
      };
    }
    return null;
  },

  async remove(): Promise<void> {
    await remove(this.key);
  },
};

// ==================== 字体存储 ====================

export const FontStorage = {
  key: "font",

  async save(name: string, data: ArrayBuffer): Promise<void> {
    await save(this.key, "font", data, { name });
  },

  async load(): Promise<{ name: string; data: ArrayBuffer } | null> {
    const result = await get(this.key);
    if (
      result &&
      result.type === "font" &&
      result.data instanceof ArrayBuffer
    ) {
      return {
        name: (result.metadata.name as string) || "",
        data: result.data,
      };
    }
    return null;
  },

  async remove(): Promise<void> {
    await remove(this.key);
  },
};

// ==================== C3 图片存储 ====================

export const C3ImageStorage = {
  key: "c3-image",

  async save(blob: Blob, width: number, height: number): Promise<void> {
    await save(this.key, "image", blob, {
      width,
      height,
      mimeType: blob.type,
    });
  },

  async load(): Promise<{ blob: Blob; width: number; height: number; mimeType?: string } | null> {
    const result = await get(this.key);
    if (result && result.type === "image" && result.data instanceof Blob) {
      return {
        blob: result.data,
        width: (result.metadata.width as number) || 0,
        height: (result.metadata.height as number) || 0,
        mimeType: (result.metadata.mimeType as string) || undefined,
      };
    }
    return null;
  },

  async remove(): Promise<void> {
    await remove(this.key);
  },
};

// ==================== C3 配置存储 ====================

const C3_CONFIG_KEY = "sprite-font-editor-c3-config";

export const C3ConfigStorage = {
  save(data: C3StoredConfig): void {
    localStorage.setItem(C3_CONFIG_KEY, JSON.stringify(data));
  },

  load(): C3StoredConfig | null {
    const saved = localStorage.getItem(C3_CONFIG_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved) as C3StoredConfig;
    } catch (error) {
      console.error("[Storage] Failed to load C3 config:", error);
      return null;
    }
  },

  remove(): void {
    localStorage.removeItem(C3_CONFIG_KEY);
  },
};

// ==================== C3 generation 存储 ====================
//
// 原子提交模型：C3 模式的通用编辑器状态、C3 配置与版本化 IndexedDB 图片 asset
// 归属同一个 generation。候选数据先 stage（写 staged keys / asset），
// 最后只更新一个 active-generation 指针（commit）作为唯一提交点。
// 无 generation 的旧固定 key 存储视为 legacy，由 store 层迁移固化。

const C3_ACTIVE_GENERATION_KEY = "sprite-font-editor-c3-active-generation";
const C3_STATE_KEY_PREFIX = "sprite-font-editor-c3-state-";
const C3_CONFIG_KEY_PREFIX = "sprite-font-editor-c3-config-";
const C3_IMAGE_ASSET_PREFIX = "c3-image-";

/** 当前 C3 本地存储 schema 版本 */
export const C3_STORAGE_VERSION = 3;

export interface C3GenerationData {
  id: string;
  /** 通用编辑器状态（与普通模式 saveToLocalStorage 的 state 对象同构） */
  generalState: unknown;
  /** v3 C3 配置 */
  c3Config: C3StoredConfig;
}

export interface C3ImageAssetData {
  assetId: string;
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/** stage 新 generation 时可选的图片候选（写入版本化 asset） */
export interface C3ImageDraft {
  blob: Blob;
  width: number;
  height: number;
}

function generationStateKey(generationId: string): string {
  return C3_STATE_KEY_PREFIX + generationId;
}

function generationConfigKey(generationId: string): string {
  return C3_CONFIG_KEY_PREFIX + generationId;
}

function generationAssetId(generationId: string): string {
  return C3_IMAGE_ASSET_PREFIX + generationId;
}

function generateGenerationId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return random;
}

function listGenerationIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(C3_CONFIG_KEY_PREFIX)) {
      ids.push(key.slice(C3_CONFIG_KEY_PREFIX.length));
    }
  }
  return ids;
}

export const C3GenerationStorage = {
  /**
   * stage 候选 generation：写 staged localStorage keys，必要时把图片写入
   * 版本化 IndexedDB asset（await 事务完成）。不更新 active 指针。
   * 任何一步失败都会 best-effort 清理本次 staged 数据并抛出。
   */
  async stage(draft: {
    generalState: unknown;
    c3Config: C3StoredConfig;
    image?: C3ImageDraft | null;
  }): Promise<string> {
    const generationId = generateGenerationId();
    const config: C3StoredConfig = { ...draft.c3Config };
    // 仅记录「本次创建」的 asset id；复用的 asset id 来自 draft.c3Config.imageAssetId，
    // 失败清理时绝不能删除被现有 active generation 复用的图片
    let createdAssetId: string | null = null;

    try {
      if (draft.image) {
        const assetId = generationAssetId(generationId);
        await save(assetId, "image", draft.image.blob, {
          width: draft.image.width,
          height: draft.image.height,
          mimeType: draft.image.blob.type || "image/png",
        });
        config.imageAssetId = assetId;
        createdAssetId = assetId;
      }

      localStorage.setItem(
        generationStateKey(generationId),
        JSON.stringify(draft.generalState),
      );
      localStorage.setItem(
        generationConfigKey(generationId),
        JSON.stringify(config),
      );
      return generationId;
    } catch (error) {
      try {
        localStorage.removeItem(generationStateKey(generationId));
        localStorage.removeItem(generationConfigKey(generationId));
        if (createdAssetId) {
          await remove(createdAssetId);
        }
      } catch (cleanupError) {
        console.error("[Storage] Failed to discard staged generation:", cleanupError);
      }
      throw error;
    }
  },

  /** 唯一提交点：更新 active-generation 指针（同步、不可失败的整体替换） */
  commit(generationId: string): void {
    localStorage.setItem(C3_ACTIVE_GENERATION_KEY, generationId);
  },

  readActiveC3GenerationId(): string | null {
    return localStorage.getItem(C3_ACTIVE_GENERATION_KEY);
  },

  readC3Generation(generationId: string): C3GenerationData | null {
    const stateRaw = localStorage.getItem(generationStateKey(generationId));
    const configRaw = localStorage.getItem(generationConfigKey(generationId));
    if (stateRaw === null || configRaw === null) {
      return null;
    }
    try {
      const generalState = JSON.parse(stateRaw);
      const c3Config = JSON.parse(configRaw) as C3StoredConfig;
      return { id: generationId, generalState, c3Config };
    } catch (error) {
      console.error("[Storage] Failed to parse generation:", error);
      return null;
    }
  },

  /** 读取 active generation 的 localStorage 数据（不含图片） */
  readActiveC3Generation(): C3GenerationData | null {
    const id = C3GenerationStorage.readActiveC3GenerationId();
    if (!id) return null;
    return C3GenerationStorage.readC3Generation(id);
  },

  /** 解析 active generation 的版本化图片 asset（IndexedDB） */
  async loadActiveC3ImageAsset(): Promise<C3ImageAssetData | null> {
    const generation = this.readActiveC3Generation();
    if (!generation?.c3Config.imageAssetId) {
      return null;
    }
    const result = await get(generation.c3Config.imageAssetId);
    if (!result || result.type !== "image" || !(result.data instanceof Blob)) {
      return null;
    }
    return {
      assetId: generation.c3Config.imageAssetId,
      blob: result.data,
      width: (result.metadata.width as number) || 0,
      height: (result.metadata.height as number) || 0,
      mimeType: (result.metadata.mimeType as string) || result.data.type,
    };
  },

  /**
   * pre-commit 失败时丢弃 staged generation：
   * 删除该 generation 的 localStorage keys 与其自有的 asset（best-effort，不抛出）。
   */
  async discard(generationId: string): Promise<void> {
    try {
      localStorage.removeItem(generationStateKey(generationId));
      localStorage.removeItem(generationConfigKey(generationId));
    } catch (error) {
      console.error("[Storage] Failed to discard generation keys:", error);
    }
    await remove(generationAssetId(generationId));
  },

  /**
   * post-commit 后清理单个旧 generation（best-effort，绝不抛出）：
   * 删除 keys 前读取该 generation 实际引用的 imageAssetId（而非按 generation id 推导）；
   * 删除 keys 后扫描剩余引用，无人引用才删除这个实际 asset。
   */
  cleanup(generationId: string): void {
    if (!generationId) return;

    let actualAssetId: string | null = null;
    try {
      actualAssetId =
        C3GenerationStorage.readC3Generation(generationId)?.c3Config.imageAssetId ??
        null;
    } catch (error) {
      console.error("[Storage] Failed to read generation for cleanup:", error);
    }

    try {
      localStorage.removeItem(generationStateKey(generationId));
      localStorage.removeItem(generationConfigKey(generationId));
    } catch (error) {
      console.error("[Storage] Failed to remove generation keys:", error);
    }

    let referenced = new Set<string>();
    let scanFailed = false;
    try {
      referenced = new Set(
        listGenerationIds()
          .map((id) => C3GenerationStorage.readC3Generation(id)?.c3Config.imageAssetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
      );
    } catch (error) {
      scanFailed = true;
      console.error("[Storage] Failed to scan generation references:", error);
    }

    // 引用扫描失败时 fail-safe：宁可保留 asset（泄漏），也不误删仍被引用的图片
    if (actualAssetId && !scanFailed && !referenced.has(actualAssetId)) {
      void remove(actualAssetId);
    }
  },

  /**
   * 清理所有非 active 的 generation（keys + 无引用 asset，best-effort）。
   * commit 后调用，保证不依赖调用方捕获的旧 active id，杜绝孤儿 generation。
   */
  prune(): void {
    const activeId = C3GenerationStorage.readActiveC3GenerationId();
    for (const id of listGenerationIds()) {
      if (id !== activeId) {
        C3GenerationStorage.cleanup(id);
      }
    }
  },

  /** 清除所有 generation（active 指针 + keys + assets，best-effort 不抛出） */
  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(C3_ACTIVE_GENERATION_KEY);
    } catch (error) {
      console.error("[Storage] Failed to clear active generation pointer:", error);
    }

    let ids: string[] = [];
    try {
      ids = listGenerationIds();
    } catch (error) {
      console.error("[Storage] Failed to list generations:", error);
      return;
    }

    // 先收集现存 config 实际引用的 asset id（去重），再删除 keys 与 assets；
    // 单个 key 删除失败不中止其余清理（best-effort）
    const assetIds = new Set<string>();
    for (const id of ids) {
      try {
        const generation = C3GenerationStorage.readC3Generation(id);
        if (generation?.c3Config.imageAssetId) {
          assetIds.add(generation.c3Config.imageAssetId);
        }
        localStorage.removeItem(generationStateKey(id));
        localStorage.removeItem(generationConfigKey(id));
      } catch (error) {
        console.error("[Storage] Failed to clear generation:", id, error);
      }
    }
    await Promise.all([...assetIds].map((assetId) => remove(assetId)));
  },
};

// ==================== 清除所有缓存 ====================

export async function clearAll(): Promise<void> {
  await Promise.all([
    ImageStorage.remove(),
    FontStorage.remove(),
    C3ImageStorage.remove(),
    C3ConfigStorage.remove(),
    C3GenerationStorage.clearAll(),
  ]);
}
