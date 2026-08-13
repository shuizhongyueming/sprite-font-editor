/**
 * 轻量内存 IndexedDB fake，用于 jsdom 测试环境。
 *
 * 覆盖 storage.ts 使用的 open / transaction / objectStore(put|get|delete)，
 * 并支持写/读失败注入（模拟请求失败与事务中止），
 * 以便验证「IndexedDB 写入必须等待 request/transaction 完成」的持久化契约。
 */

interface FakeStoreMap {
  [key: string]: unknown;
}

interface FakeDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, options?: { keyPath?: string }): void;
  transaction(name: string, mode?: IDBTransactionMode): IDBTransaction;
}

const STORE_NAME = "assets";

let storeMap: FakeStoreMap = {};
let database: FakeDatabase | null = null;
const fail = {
  put: false,
  get: false,
  delete: false,
  transaction: false,
};

function schedule(fn: () => void): void {
  queueMicrotask(fn);
}

function createRequest<T>(result: T | undefined, error: Error | null): IDBRequest<T> {
  const request = {
    result: error ? undefined : result,
    error,
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<T>;
  schedule(() => {
    if (error) {
      request.onerror?.(new Event("error") as unknown as Event);
    } else {
      request.onsuccess?.(new Event("success") as unknown as Event);
    }
  });
  return request;
}

function createTransaction(store: FakeStoreMap): IDBTransaction {
  const transaction: {
    error: DOMException | null;
    oncomplete: ((ev: Event) => void) | null;
    onabort: ((ev: Event) => void) | null;
    onerror: ((ev: Event) => void) | null;
    objectStore(name: string): IDBObjectStore;
  } = {
    error: null,
    oncomplete: null,
    onabort: null,
    onerror: null,
    objectStore(name: string) {
      if (name !== STORE_NAME) {
        throw new Error(`Object store not found: ${name}`);
      }
      return {
        put(value: { id: string }) {
          if (fail.put) {
            return createRequest(undefined, new Error("fake put failed"));
          }
          store[value.id] = value;
          return createRequest(undefined, null);
        },
        get(id: string) {
          if (fail.get) {
            return createRequest(undefined, new Error("fake get failed"));
          }
          return createRequest(store[id], null);
        },
        delete(id: string) {
          if (fail.delete) {
            return createRequest(undefined, new Error("fake delete failed"));
          }
          delete store[id];
          return createRequest(undefined, null);
        },
      } as unknown as IDBObjectStore;
    },
  };

  // 事务完成/中止用宏任务调度，保证先处理所有请求（put/get/delete）的
  // 微任务事件，再结算事务 —— 与真实 IndexedDB 的时序一致。
  setTimeout(() => {
    if (fail.transaction) {
      transaction.error = new DOMException("fake transaction aborted");
      transaction.onerror?.(new Event("error") as unknown as Event);
      transaction.onabort?.(new Event("abort") as unknown as Event);
    } else {
      transaction.oncomplete?.(new Event("complete") as unknown as Event);
    }
  }, 0);

  return transaction as unknown as IDBTransaction;
}

export function installFakeIndexedDB(): void {
  if (globalThis.indexedDB) {
    return;
  }

  const open = (
    name: string,
  ): IDBOpenDBRequest => {
    const request: {
      result: unknown;
      error: Error | null;
      onupgradeneeded: ((ev: Event) => void) | null;
      onsuccess: ((ev: Event) => void) | null;
      onerror: ((ev: Event) => void) | null;
    } = {
      result: undefined,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };

    schedule(() => {
      if (!database) {
        storeMap = {};
        database = {
          objectStoreNames: {
            contains(storeName: string) {
              return storeName === STORE_NAME;
            },
          },
          createObjectStore() {
            // store 由 fake 预创建，no-op
          },
          transaction(storeName: string, mode?: IDBTransactionMode) {
            if (storeName !== STORE_NAME) {
              throw new Error(`Object store not found: ${storeName}`);
            }
            void mode;
            return createTransaction(storeMap);
          },
        };
      }
      request.result = database;
      request.onsuccess?.(new Event("success") as unknown as Event);
    });

    void name;
    return request as unknown as IDBOpenDBRequest;
  };

  Object.defineProperty(globalThis, "indexedDB", {
    value: { open },
    configurable: true,
    writable: true,
  });
}

/** 清空数据与失败注入标志（不重建 database 句柄，保留 storage 的 db 缓存有效） */
export function resetFakeIndexedDB(): void {
  storeMap = {};
  fail.put = false;
  fail.get = false;
  fail.delete = false;
  fail.transaction = false;
}

/** 注入下一次 put 失败 */
export function failNextIndexedDBPut(): void {
  fail.put = true;
}

/** 注入下一次 get 失败 */
export function failNextIndexedDBGet(): void {
  fail.get = true;
}

/** 注入下一次事务中止 */
export function failNextIndexedDBTransaction(): void {
  fail.transaction = true;
}

/** 返回当前 fake 存储中所有 asset id（供清理行为断言） */
export function getFakeIndexedDBAssetIds(): string[] {
  return Object.keys(storeMap);
}
