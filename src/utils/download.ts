/**
 * 下载相关工具函数
 */

import {
  getImageExportFormat,
  replaceExtension,
  buildFilePickerType,
} from "@/utils/image-format";

export interface CharacterEntry {
  char: string;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ExportOptions {
  filename?: string;
  quality?: number;
  sourceMimeType?: string;
}

export interface FilePickerSaveOptions {
  filename?: string;
  types?: FilePickerAcceptType[];
}

/**
 * 使用 File System Access API 保存文件到用户选择的位置
 * @returns 是否成功保存（用户取消也返回 true，表示不需要 fallback）
 */
export async function saveWithFilePicker(
  blob: Blob,
  filename: string,
  types?: FilePickerAcceptType[],
): Promise<boolean> {
  if (typeof window.showSaveFilePicker !== "function") {
    return false;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types,
    });
    if (!handle) {
      return false;
    }
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    console.error("File picker save failed:", error);
    return false;
  }
}

/**
 * 触发文件下载
 */
export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 根据原图格式导出 Canvas 为图片
 */
export async function exportCanvasToImage(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {},
): Promise<void> {
  const {
    filename = "sprite-font.png",
    sourceMimeType = "image/png",
    quality = 0.9,
  } = options;

  const format = getImageExportFormat(filename, sourceMimeType);
  const exportFilename = replaceExtension(filename, format.extension);

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        format.mimeType,
        format.mimeType === "image/jpeg" ? quality : undefined,
      );
    });
    if (!blob) {
      throw new Error("无法将 Canvas 转换为 Blob");
    }

    const saved = await saveWithFilePicker(blob, exportFilename, [
      buildFilePickerType(format),
    ]);

    if (!saved) {
      const dataURL = canvas.toDataURL(
        format.mimeType,
        format.mimeType === "image/jpeg" ? quality : undefined,
      );
      triggerDownload(dataURL, exportFilename);
    }
  } catch (error) {
    console.error("Failed to export canvas:", error);
    throw new Error("导出失败，请检查 Canvas 状态");
  }
}

/**
 * 导出 Canvas 为 PNG（兼容旧代码，实际按原图格式导出）
 */
export async function exportCanvasToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {},
): Promise<void> {
  return exportCanvasToImage(canvas, options);
}

/**
 * 导出 Canvas 为 JPEG（兼容旧代码，实际按原图格式导出）
 */
export async function exportCanvasToJPEG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {},
): Promise<void> {
  return exportCanvasToImage(canvas, options);
}

/**
 * 使用原始图片尺寸导出
 * @param originalImage 原始图片
 * @param baseCellConfig 单元格基础配置（基于原始图片尺寸）
 * @param baseImageConfig 图片基础配置（基于原始图片尺寸）
 * @param characterEntries 字符条目列表
 * @param characterStyle 字符样式
 * @param cellAlignment 对齐方式
 * @param insertPointConfig 插入点配置
 * @param filename 导出文件名
 */
export interface ExportWithOriginalSizeOptions {
  sourceMimeType?: string;
}

export async function exportWithOriginalSize(
  originalImage: HTMLImageElement,
  baseCellConfig: {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    padding: { top: number; right: number; bottom: number; left: number };
  },
  baseImageConfig: {
    margin: { top: number; right: number; bottom: number; left: number };
    padding: { top: number; right: number; bottom: number; left: number };
  },
  characterEntries: CharacterEntry[],
  characterStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    outline: { enabled: boolean; color: string; width: number };
    pixelStyle: boolean;
  },
  cellAlignment: {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "middle" | "bottom";
  },
  insertPointConfig: { mode: "auto" | "manual"; startCellIndex?: number },
  filename: string = "sprite-font.png",
  options: ExportWithOriginalSizeOptions = {},
): Promise<void> {
  const { sourceMimeType = "image/png" } = options;

  return exportImageWithCanvas(
    originalImage,
    async (_canvas, ctx) => {
      // 动态导入 char-renderer
      const { renderCharacterToCell } = await import("./char-renderer");

      // 绘制原始图片
      ctx.drawImage(originalImage, 0, 0);

      if (characterEntries.length === 0) {
        return;
      }

      // 计算网格行列数
      const cellTotalWidth =
        baseCellConfig.width +
        baseCellConfig.margin.left +
        baseCellConfig.margin.right;
      const cellTotalHeight =
        baseCellConfig.height +
        baseCellConfig.margin.top +
        baseCellConfig.margin.bottom;
      const usableWidth =
        originalImage.width -
        baseImageConfig.margin.left -
        baseImageConfig.margin.right -
        baseImageConfig.padding.left -
        baseImageConfig.padding.right;
      const usableHeight =
        originalImage.height -
        baseImageConfig.margin.top -
        baseImageConfig.margin.bottom -
        baseImageConfig.padding.top -
        baseImageConfig.padding.bottom;
      const cols = Math.floor(usableWidth / cellTotalWidth);
      const rows = Math.floor(usableHeight / cellTotalHeight);

      // 确定起始单元格
      const startIndex = insertPointConfig.startCellIndex || 0;
      let currentIndex = startIndex;

      // 遍历所有字符
      for (const charEntry of characterEntries) {
        if (currentIndex >= rows * cols) break;

        const row = Math.floor(currentIndex / cols);
        const col = currentIndex % cols;

        // 计算单元格位置
        const cellX =
          baseImageConfig.margin.left +
          baseImageConfig.padding.left +
          col * cellTotalWidth +
          baseCellConfig.margin.left;
        const cellY =
          baseImageConfig.margin.top +
          baseImageConfig.padding.top +
          row * cellTotalHeight +
          baseCellConfig.margin.top;

        // 渲染字符
        renderCharacterToCell(
          charEntry.char,
          ctx,
          cellX,
          cellY,
          baseCellConfig.width,
          baseCellConfig.height,
          charEntry.margin || { top: 0, right: 0, bottom: 0, left: 0 },
          baseCellConfig.padding,
          {
            fontFamily: characterStyle.fontFamily,
            fontSize: characterStyle.fontSize,
            color: characterStyle.color,
            outline: characterStyle.outline,
            alignment: cellAlignment,
          },
          characterStyle.pixelStyle,
        );

        currentIndex++;
      }
    },
    filename,
    sourceMimeType,
  );
}

async function exportImageWithCanvas(
  originalImage: HTMLImageElement,
  draw: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ) => Promise<void> | void,
  filename: string,
  sourceMimeType: string = "image/png",
): Promise<void> {
  try {
    const format = getImageExportFormat(filename, sourceMimeType);
    const exportFilename = replaceExtension(filename, format.extension);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = originalImage.width;
    exportCanvas.height = originalImage.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法获取 Canvas 上下文");
    }

    await draw(exportCanvas, ctx);

    const quality = format.mimeType === "image/jpeg" ? 0.92 : undefined;
    const blob = await new Promise<Blob | null>((resolve) => {
      exportCanvas.toBlob(resolve, format.mimeType, quality);
    });
    if (!blob) {
      throw new Error("无法将 Canvas 转换为 Blob");
    }

    const saved = await saveWithFilePicker(blob, exportFilename, [
      buildFilePickerType(format),
    ]);

    if (!saved) {
      const dataURL = exportCanvas.toDataURL(format.mimeType, quality);
      triggerDownload(dataURL, exportFilename);
    }
  } catch (error) {
    console.error("Failed to export with original size:", error);
    throw new Error("导出失败，请检查配置");
  }
}

/**
 * 将 Blob 转换为 DataURL
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 DataURL 转换为 Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], { type: mime });
}
