/**
 * 下载相关工具函数
 */

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
}

/**
 * 触发文件下载
 */
export function triggerDownload(dataURL: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 导出 Canvas 为 PNG
 */
export function exportCanvasToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {},
): void {
  const { filename = "sprite-font.png" } = options;

  try {
    const dataURL = canvas.toDataURL("image/png");
    triggerDownload(dataURL, filename);
  } catch (error) {
    console.error("Failed to export canvas:", error);
    throw new Error("导出失败，请检查 Canvas 状态");
  }
}

/**
 * 导出 Canvas 为 JPEG
 */
export function exportCanvasToJPEG(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {},
): void {
  const { filename = "sprite-font.jpg", quality = 0.9 } = options;

  try {
    const dataURL = canvas.toDataURL("image/jpeg", quality);
    triggerDownload(dataURL, filename);
  } catch (error) {
    console.error("Failed to export canvas:", error);
    throw new Error("导出失败，请检查 Canvas 状态");
  }
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
): Promise<void> {
  try {
    // 动态导入 char-renderer
    const { renderCharacterToCell } = await import("./char-renderer");

    // 创建与原始图片尺寸相同的 canvas
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = originalImage.width;
    exportCanvas.height = originalImage.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法获取 Canvas 上下文");
    }

    // 绘制原始图片
    ctx.drawImage(originalImage, 0, 0);

    // 如果有字符需要渲染
    if (characterEntries.length === 0) {
      // 没有字符，只导出图片
      const dataURL = exportCanvas.toDataURL("image/png");
      triggerDownload(dataURL, filename);
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

    // 导出
    const dataURL = exportCanvas.toDataURL("image/png");
    triggerDownload(dataURL, filename);
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
