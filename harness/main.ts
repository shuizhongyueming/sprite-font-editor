/**
 * 无头导出入口（仅开发/自动化用，不进生产构建）。
 *
 * 由 `<editor>/node_modules/.bin/vite` 提供页面，`c3-project.mjs export`
 * 启动一个本地服务器喂入项目文件并回收结果。
 *
 * 走的是编辑器真实的导出链路：applyProject 应用保存下来的项目，
 * 再调用 Toolbar 里那个 exportC3SpriteFont，所以像素结果与手动导出一致。
 */
import { createPinia, setActivePinia } from "pinia";
import { parseProjectFiles } from "@/utils/project-import";
import { useEditorStore } from "@/stores/editor";
import { exportC3SpriteFont } from "@/utils/c3-export";
import type { C3AppendedEntry } from "@/utils/c3-export";

interface HarnessInput {
  files: string[];
}

interface HarnessResult {
  ok: boolean;
  filename?: string;
  mimeType?: string;
  image?: string;
  instanceArray?: unknown;
  error?: string;
}

const params = new URLSearchParams(location.search);
const server = params.get("server");
const statusEl = document.getElementById("status");

function setStatus(text: string) {
  if (statusEl) statusEl.textContent = text;
}

function base64FromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function postResult(result: HarnessResult) {
  if (!server) return;
  await fetch(`${server}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
}

async function loadFiles(input: HarnessInput): Promise<Map<string, Blob>> {
  const files = new Map<string, Blob>();

  for (const name of input.files) {
    const response = await fetch(`${server}/file/${encodeURIComponent(name)}`);
    if (!response.ok) {
      throw new Error(`无法读取项目文件: ${name} (${response.status})`);
    }
    files.set(name, await response.blob());
  }

  return files;
}

async function run() {
  if (!server) {
    throw new Error("缺少 ?server= 参数");
  }

  setStatus("读取项目");
  const input = (await (
    await fetch(`${server}/input.json`)
  ).json()) as HarnessInput;

  const files = await loadFiles(input);
  const projectData = await parseProjectFiles(files);

  setStatus("应用项目");
  setActivePinia(createPinia());
  const store = useEditorStore();
  await store.applyProject(projectData);

  if (!store.isC3Mode || !store.c3InstanceArray || !store.baseImage) {
    throw new Error("项目不是 C3 模式，或缺少图片/实例数据");
  }

  // 拦截保存对话框，直接拿到编辑器要写盘的 blob 与文件名
  let capturedBlob: Blob | null = null;
  let capturedName = "";
  (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker =
    async (options?: { suggestedName?: string }) => {
      capturedName = options?.suggestedName ?? "c3-sprite-font.png";
      return {
        createWritable: async () => ({
          write: async (blob: Blob) => {
            capturedBlob = blob;
          },
          close: async () => {},
        }),
      };
    };

  setStatus("渲染导出");
  const filename =
    store.c3ImportedImageFilename || capturedName || "c3-sprite-font.png";

  const updatedArray = await exportC3SpriteFont({
    originalArray: store.c3InstanceArray,
    importedCharacterSet: store.importedCharacterSet,
    characterSet: [...store.c3EffectiveCharacterSet],
    spacingData: store.c3EffectiveSpacingData,
    baseImage: store.baseImage,
    c3ImportedImage: store.c3ImportedImage,
    baseCellConfig: store.baseCellConfig,
    baseImageConfig: store.baseImageConfig,
    appendedEntries: store.c3AppendedEntries as C3AppendedEntry[],
    characterStyle: store.characterStyle,
    currentFontFamily: store.currentFont?.family,
    filename,
    sourceMimeType: store.baseImageMimeType,
  });

  if (!capturedBlob) {
    throw new Error("导出没有产出图片 blob");
  }

  const imageBlob = capturedBlob as Blob;
  setStatus("回传结果");
  await postResult({
    ok: true,
    filename: capturedName || filename,
    mimeType: imageBlob.type,
    image: await base64FromBlob(imageBlob),
    instanceArray: updatedArray,
  });
  setStatus("完成");
}

run().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  setStatus(`失败: ${message}`);
  await postResult({ ok: false, error: message });
});
