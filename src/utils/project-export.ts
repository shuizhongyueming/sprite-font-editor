import JSZip from "jszip";
import { dataURLToBlob } from "@/utils/download";
import { ImageStorage, C3ImageStorage, FontStorage } from "@/utils/storage";
import type { C3InstanceArray } from "@/utils/c3-parser";
import type { C3AppendedEntry } from "@/utils/c3-export";
import type { useEditorStore } from "@/stores/editor";
import { version as appVersion } from "../../package.json";

export type ProjectMode = "normal" | "c3";

export interface ProjectStateV1 {
  baseImageMimeType?: string;
  baseCellConfig: {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    padding: { top: number; right: number; bottom: number; left: number };
  };
  baseImageConfig: {
    margin: { top: number; right: number; bottom: number; left: number };
    padding: { top: number; right: number; bottom: number; left: number };
    fontSpriteWidth?: number;
    fontSpriteHeight?: number;
  };
  cellAlignment: {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "middle" | "bottom";
  };
  characterStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    outline: {
      enabled: boolean;
      color: string;
      width: number;
    };
    pixelStyle: boolean;
  };
  insertPointConfig: {
    mode: "auto" | "manual";
    startCellIndex?: number;
  };
  gridConfig: {
    enabled: boolean;
    cellBorder: boolean;
    cellBorderColor: string;
    cellBorderWidth: number;
    marginLines: boolean;
    marginLineColor: string;
    paddingLines: boolean;
    paddingLineColor: string;
  };
  canvasBg: "white" | "black" | "checkerboard";
  canvasViewMode: "fit" | "actual";
  originalImageWidth: number;
  originalImageHeight: number;
  baseImageFilename?: string;
  characterEntries?: Array<{
    char: string;
    margin: { top: number; right: number; bottom: number; left: number };
  }>;
  importedCharacterSet?: string;
  importedSpacingData?: string;
  importedCharacterSpacing?: number;
  importedLineHeight?: number;
  c3GlobalExtraSpacing?: number;
  c3AppendedEntries?: C3AppendedEntry[];
}

export interface ProjectJsonV1 {
  version: 1;
  exportedAt: string;
  appVersion: string;
  mode: ProjectMode;
  image: string;
  font?: string;
  c3Instance?: string;
  state: ProjectStateV1;
}

export interface ProjectStateV2 extends ProjectStateV1 {
  c3AppendedVerticalAlignment?: "top" | "middle" | "bottom";
}

export interface ProjectJsonV2 extends Omit<ProjectJsonV1, "version" | "state"> {
  version: 2;
  state: ProjectStateV2;
}

export interface ProjectFiles {
  projectJson: ProjectJsonV2;
  imageBlob: Blob;
  imageFilename: string;
  c3InstanceArray?: C3InstanceArray | null;
  fontBlob?: Blob;
  fontFilename?: string;
}

const RESERVED_NAMES = new Set(["project.json", "c3-instance.json"]);

function resolveAssetFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (RESERVED_NAMES.has(lower)) {
    return `asset-${filename}`;
  }
  return filename;
}

async function blobFromImageElement(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法获取 Canvas 上下文");
  }

  ctx.drawImage(image, 0, 0);
  return dataURLToBlob(canvas.toDataURL("image/png"));
}

async function getStoredImageBlob(
  store: ReturnType<typeof useEditorStore>,
): Promise<Blob> {
  if (store.isC3Mode) {
    const c3Data = await C3ImageStorage.load();
    if (c3Data) {
      return c3Data.blob;
    }
  } else {
    const imageData = await ImageStorage.load();
    if (imageData) {
      return imageData.blob;
    }
  }

  const source = store.c3ImportedImage || store.baseImage;
  if (!source) {
    throw new Error("没有可导出的图片");
  }

  return blobFromImageElement(source);
}

async function getStoredFont(
  store: ReturnType<typeof useEditorStore>,
): Promise<{ blob: Blob; filename: string } | null> {
  const fontData = await FontStorage.load();
  if (!fontData) {
    return null;
  }

  const filename =
    store.fontFilename || (fontData.name ? `${fontData.name}.ttf` : "font.ttf");
  return { blob: new Blob([fontData.data]), filename };
}

function buildProjectJson(store: ReturnType<typeof useEditorStore>): ProjectJsonV2 {
  const mode = store.isC3Mode ? "c3" : "normal";
  const imageFilename = store.isC3Mode
    ? store.c3ImportedImageFilename || "image.png"
    : store.baseImageFilename || "image.png";

  const state: ProjectStateV2 = {
    baseCellConfig: store.baseCellConfig,
    baseImageConfig: store.baseImageConfig,
    cellAlignment: store.cellAlignment,
    characterStyle: store.characterStyle,
    insertPointConfig: store.insertPointConfig,
    gridConfig: store.gridConfig,
    canvasBg: store.canvasBg,
    canvasViewMode: store.canvasViewMode,
    originalImageWidth: store.originalImageWidth,
    originalImageHeight: store.originalImageHeight,
    baseImageFilename: store.baseImageFilename,
    baseImageMimeType: store.baseImageMimeType,
  };

  if (mode === "normal") {
    state.characterEntries = store.characterEntries;
  } else {
    state.importedCharacterSet = store.importedCharacterSet;
    state.importedSpacingData = store.importedSpacingData;
    state.importedCharacterSpacing = store.importedCharacterSpacing;
    state.importedLineHeight = store.importedLineHeight;
    state.c3GlobalExtraSpacing = store.c3GlobalExtraSpacing;
    state.c3AppendedVerticalAlignment = store.c3AppendedVerticalAlignment;
    state.c3AppendedEntries = store.c3AppendedEntries;
  }

  const projectJson: ProjectJsonV2 = {
    version: 2,
    exportedAt: new Date().toISOString(),
    appVersion,
    mode,
    image: resolveAssetFilename(imageFilename),
    state,
  };

  if (mode === "c3" && store.c3InstanceArray) {
    projectJson.c3Instance = "c3-instance.json";
  }

  return projectJson;
}

export async function buildProjectFiles(
  store: ReturnType<typeof useEditorStore>,
): Promise<ProjectFiles> {
  const projectJson = buildProjectJson(store);
  const imageBlob = await getStoredImageBlob(store);

  const files: ProjectFiles = {
    projectJson,
    imageBlob,
    imageFilename: projectJson.image,
  };

  if (store.isC3Mode && store.c3InstanceArray) {
    files.c3InstanceArray = store.c3InstanceArray;
  }

  const font = await getStoredFont(store);
  if (font) {
    files.fontBlob = font.blob;
    files.fontFilename = resolveAssetFilename(font.filename);
    projectJson.font = files.fontFilename;
  }

  return files;
}

async function writeFileToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveProjectFilesToDirectory(
  store: ReturnType<typeof useEditorStore>,
  dirHandle: FileSystemDirectoryHandle,
): Promise<void> {
  const files = await buildProjectFiles(store);

  await writeFileToDirectory(
    dirHandle,
    "project.json",
    new Blob([JSON.stringify(files.projectJson, null, 2)], {
      type: "application/json",
    }),
  );
  await writeFileToDirectory(dirHandle, files.imageFilename, files.imageBlob);

  if (files.c3InstanceArray) {
    await writeFileToDirectory(
      dirHandle,
      files.projectJson.c3Instance!,
      new Blob([JSON.stringify(files.c3InstanceArray, null, 2)], {
        type: "application/json",
      }),
    );
  }

  if (files.fontBlob && files.fontFilename) {
    await writeFileToDirectory(dirHandle, files.fontFilename, files.fontBlob);
  }
}

export async function exportProjectToDirectory(
  store: ReturnType<typeof useEditorStore>,
): Promise<void> {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("File System Access API 不受支持");
  }

  const dirHandle = await window.showDirectoryPicker();
  await saveProjectFilesToDirectory(store, dirHandle);
}

export async function saveProjectToDirectory(
  store: ReturnType<typeof useEditorStore>,
  dirHandle: FileSystemDirectoryHandle,
): Promise<void> {
  await saveProjectFilesToDirectory(store, dirHandle);
}

export async function exportProjectToZip(
  store: ReturnType<typeof useEditorStore>,
): Promise<Blob> {
  const files = await buildProjectFiles(store);
  const zip = new JSZip();

  zip.file("project.json", JSON.stringify(files.projectJson, null, 2));
  zip.file(files.imageFilename, files.imageBlob);

  if (files.c3InstanceArray) {
    zip.file(
      files.projectJson.c3Instance!,
      JSON.stringify(files.c3InstanceArray, null, 2),
    );
  }

  if (files.fontBlob && files.fontFilename) {
    zip.file(files.fontFilename, files.fontBlob);
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}
