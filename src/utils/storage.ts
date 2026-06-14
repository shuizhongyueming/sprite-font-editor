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
    // 向后兼容旧数据
    displayWidth?: number;
    isDisplayWidthManual?: boolean;
  }>;
  originalImageWidth: number;
  originalImageHeight: number;
  imageFilename?: string;
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

    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
 * 保存数据到 IndexedDB
 */
async function save(
  id: string,
  type: "image" | "font",
  data: Blob | ArrayBuffer,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const asset: StoredAsset = {
      id,
      type,
      data,
      metadata,
      createdAt: Date.now(),
    };

    store.put(asset);
  } catch (error) {
    console.error("[Storage] Failed to save:", error);
    throw error;
  }
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
 * 删除数据
 */
async function remove(id: string): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
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

  async load(): Promise<{ blob: Blob; width: number; height: number } | null> {
    const result = await get(this.key);
    if (result && result.type === "image" && result.data instanceof Blob) {
      return {
        blob: result.data,
        width: (result.metadata.width as number) || 0,
        height: (result.metadata.height as number) || 0,
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

  async load(): Promise<{ blob: Blob; width: number; height: number } | null> {
    const result = await get(this.key);
    if (result && result.type === "image" && result.data instanceof Blob) {
      return {
        blob: result.data,
        width: (result.metadata.width as number) || 0,
        height: (result.metadata.height as number) || 0,
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

// ==================== 清除所有缓存 ====================

export async function clearAll(): Promise<void> {
  await Promise.all([
    ImageStorage.remove(),
    FontStorage.remove(),
    C3ImageStorage.remove(),
    C3ConfigStorage.remove(),
  ]);
}
