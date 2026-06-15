import JSZip from "jszip";
import { parseC3InstanceArray, type C3ParsedData } from "@/utils/c3-parser";
import type { C3InstanceArray } from "@/utils/c3-parser";
import type { C3AppendedEntry } from "@/utils/c3-export";
import type {
  ProjectJsonV1,
  ProjectJsonV2,
  ProjectMode,
  ProjectStateV1,
  ProjectStateV2,
} from "@/utils/project-export";

export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectImportError";
  }
}

export interface ProjectFontData {
  data: ArrayBuffer;
  filename: string;
}

export interface ProjectData {
  mode: ProjectMode;
  state: ProjectStateV2;
  image: HTMLImageElement;
  imageBlob: Blob;
  imageFilename: string;
  c3InstanceArray?: C3InstanceArray | null;
  c3ParsedData?: C3ParsedData;
  font?: ProjectFontData;
}

async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    return blob.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ProjectImportError("图片加载失败"));
    };

    img.src = url;
  });
}

function findEntry<T>(map: Map<string, T>, name: string): T | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of map.entries()) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
}

function assertProjectShape(raw: unknown): asserts raw is ProjectJsonV1 | ProjectJsonV2 {
  if (!raw || typeof raw !== "object") {
    throw new ProjectImportError("project.json 格式无效");
  }

  const data = raw as Record<string, unknown>;

  if (typeof data.version !== "number") {
    throw new ProjectImportError("project.json 缺少版本号");
  }

  if (data.version < 1) {
    throw new ProjectImportError(`不支持的旧版本项目: ${data.version}`);
  }

  if (data.version > 2) {
    throw new ProjectImportError(`不支持的项目版本: ${data.version}`);
  }

  if (data.mode !== "normal" && data.mode !== "c3") {
    throw new ProjectImportError("project.json 模式字段无效");
  }

  if (typeof data.image !== "string" || !data.image) {
    throw new ProjectImportError("project.json 缺少图片文件名");
  }

  if (!data.state || typeof data.state !== "object") {
    throw new ProjectImportError("project.json 缺少状态数据");
  }

  const state = data.state as Record<string, unknown>;

  if (
    !state.baseCellConfig ||
    !state.baseImageConfig ||
    !state.cellAlignment ||
    !state.characterStyle ||
    !state.insertPointConfig ||
    !state.gridConfig ||
    typeof state.canvasBg !== "string" ||
    typeof state.canvasViewMode !== "string" ||
    typeof state.originalImageWidth !== "number" ||
    typeof state.originalImageHeight !== "number"
  ) {
    throw new ProjectImportError("project.json 状态数据不完整");
  }
}

function migrateProjectState(
  state: ProjectStateV1 | ProjectStateV2,
): ProjectStateV2 {
  const v2: ProjectStateV2 = { ...state };

  if (v2.c3AppendedVerticalAlignment === undefined) {
    v2.c3AppendedVerticalAlignment = "middle";
  }

  if (v2.c3AppendedEntries && v2.c3AppendedEntries.length > 0) {
    const entries = migrateAppendedEntries(v2.c3AppendedEntries).map(
      (entry) => ({
        ...entry,
        margin: { ...entry.margin, top: 0 },
      }),
    );

    const maxHeight = Math.max(
      ...entries.map((entry) => entry.autoGlyphHeight),
      0,
    );
    for (const entry of entries) {
      entry.distributionOffset = Math.round(
        (maxHeight - entry.autoGlyphHeight) / 2,
      );
    }

    v2.c3AppendedEntries = entries;
  }

  return v2;
}

export async function parseProjectFiles(
  files: Map<string, Blob>,
  imageLoader: (blob: Blob) => Promise<HTMLImageElement> = loadImageFromBlob,
): Promise<ProjectData> {
  const projectFile = findEntry(files, "project.json");
  if (!projectFile) {
    throw new ProjectImportError("缺少 project.json");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await blobToText(projectFile));
  } catch {
    throw new ProjectImportError("project.json 不是有效的 JSON");
  }

  assertProjectShape(raw);
  const projectJson = raw as ProjectJsonV1 | ProjectJsonV2;
  const state = migrateProjectState(projectJson.state);

  const imageFile = findEntry(files, projectJson.image);
  if (!imageFile) {
    throw new ProjectImportError(`缺少底图文件: ${projectJson.image}`);
  }

  if (!state.baseImageMimeType && imageFile.type) {
    state.baseImageMimeType = imageFile.type;
  }

  const image = await imageLoader(imageFile);

  if (
    image.naturalWidth !== state.originalImageWidth ||
    image.naturalHeight !== state.originalImageHeight
  ) {
    throw new ProjectImportError(
      `图片尺寸 (${image.naturalWidth}x${image.naturalHeight}) 与项目元数据 (${state.originalImageWidth}x${state.originalImageHeight}) 不匹配`,
    );
  }

  let c3InstanceArray: C3InstanceArray | null = null;
  let c3ParsedData: C3ParsedData | undefined;

  if (projectJson.mode === "c3") {
    const c3FileName = projectJson.c3Instance || "c3-instance.json";
    const c3File = findEntry(files, c3FileName);
    if (!c3File) {
      throw new ProjectImportError("缺少 c3-instance.json");
    }

    let c3Text: string;
    try {
      c3Text = await blobToText(c3File);
    } catch {
      throw new ProjectImportError("无法读取 c3-instance.json");
    }

    try {
      c3ParsedData = parseC3InstanceArray(c3Text);
      c3InstanceArray = JSON.parse(c3Text) as C3InstanceArray;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProjectImportError(`c3-instance.json 无效: ${message}`);
    }
  }

  let font: ProjectFontData | undefined;
  if (projectJson.font) {
    const fontFile = findEntry(files, projectJson.font);
    if (fontFile) {
      try {
        const data = await blobToArrayBuffer(fontFile);
        font = { data, filename: projectJson.font };
      } catch (error) {
        console.warn("项目字体文件读取失败，将使用系统字体:", error);
      }
    } else {
      console.warn("项目引用的字体文件不存在:", projectJson.font);
    }
  }

  return {
    mode: projectJson.mode,
    state,
    image,
    imageBlob: imageFile,
    imageFilename: projectJson.image,
    c3InstanceArray,
    c3ParsedData,
    font,
  };
}

export function buildFileMapFromFileList(fileList: FileList): Map<string, File> {
  const map = new Map<string, File>();

  for (const file of Array.from(fileList)) {
    const path = file.webkitRelativePath || file.name;
    const parts = path.split("/");

    // 忽略不在文件夹内的文件或嵌套文件
    if (parts.length < 2 || parts.slice(2).some((part) => part)) {
      continue;
    }

    const relative = parts[1];
    if (relative) {
      map.set(relative, file);
    }
  }

  return map;
}

export async function readZipProject(zipFile: Blob): Promise<Map<string, Blob>> {
  const zip = await JSZip.loadAsync(zipFile);
  const map = new Map<string, Blob>();

  const entries = Object.entries(zip.files).filter(
    ([name, entry]) =>
      !entry.dir &&
      !name.startsWith("__MACOSX/") &&
      !name.startsWith("._"),
  );

  if (entries.length === 0) {
    return map;
  }

  // 检测顶层公共文件夹前缀
  const firstParts = entries[0][0].split("/");
  let commonPrefix = "";
  if (firstParts.length > 1) {
    const candidate = `${firstParts[0]}/`;
    if (entries.every(([name]) => name.startsWith(candidate))) {
      commonPrefix = candidate;
    }
  }

  for (const [name, entry] of entries) {
    const relative = name.slice(commonPrefix.length);
    if (!relative || relative.includes("/")) {
      continue;
    }

    const blob = await entry.async("blob");
    map.set(relative, blob);
  }

  return map;
}

export function migrateAppendedEntries(
  entries: Array<{
    char: string;
    margin: { top: number; right: number; bottom: number; left: number };
    autoDisplayWidth: number;
    autoGlyphHeight?: number;
    extraSpacing?: number;
    distributionOffset?: number;
    displayWidth?: number;
    isDisplayWidthManual?: boolean;
  }>,
): C3AppendedEntry[] {
  return entries.map((entry) => {
    const extraSpacing =
      typeof entry.extraSpacing === "number"
        ? entry.extraSpacing
        : deriveExtraSpacing(entry);

    return {
      char: entry.char,
      margin: entry.margin,
      autoDisplayWidth: entry.autoDisplayWidth,
      autoGlyphHeight: entry.autoGlyphHeight ?? 0,
      extraSpacing,
      distributionOffset: entry.distributionOffset ?? 0,
    };
  });
}

function deriveExtraSpacing(
  entry: {
    displayWidth?: number;
    autoDisplayWidth?: number;
  },
): number {
  if (
    typeof entry.displayWidth === "number" &&
    typeof entry.autoDisplayWidth === "number" &&
    entry.displayWidth !== entry.autoDisplayWidth
  ) {
    return entry.displayWidth - entry.autoDisplayWidth;
  }

  return 0;
}
