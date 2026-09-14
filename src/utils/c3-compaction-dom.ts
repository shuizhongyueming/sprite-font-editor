/**
 * C3 精简/重排的 DOM 包装 seam：图片编码 / 解码 / 像素读取。
 *
 * 与纯算法模块 src/utils/c3-compaction.ts 分离：本模块只负责
 * ImageData → 图片 Blob → 可加载 HTMLImageElement 的往返，
 * 以及从 HTMLImageElement 提取 ImageData，不包含任何像素分析 /
 * 重排 / spacing 逻辑。失败一律返回 null 或抛出，由调用方
 * （store 原子应用 / 分析 seam）做 fail-closed 处理。
 */

/** 从 HTMLImageElement 读取自然尺寸的 ImageData（失败返回 null） */
export function imageToImageData(
  image: HTMLImageElement,
): ImageData | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (canvas.width <= 0 || canvas.height <= 0) {
      return null;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    console.error("[C3Compaction] Failed to read image pixels:", error);
    return null;
  }
}

/**
 * 把精简重排后的 ImageData 编码为图片 Blob。
 * putImageData 精确保留 alpha（不做合成）；PNG 无损，WebP 有损
 * （取质量上限 1，alpha 通道独立无损存储）。
 */
export async function encodeC3RepackedImage(
  imageData: ImageData,
  mimeType: "image/png" | "image/webp" = "image/png",
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.putImageData(imageData, 0, 0);
    const quality = mimeType === "image/webp" ? 1 : undefined;
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });
  } catch (error) {
    console.error("[C3Compaction] Failed to encode repacked image:", error);
    return null;
  }
}

/**
 * 把图片 Blob（PNG/WebP 等浏览器可解码格式）解码为可加载的
 * HTMLImageElement。失败返回 null（图片损坏、解码超时等）。
 */
export async function decodeC3PngBlob(
  blob: Blob,
): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image decode failed"));
      image.src = url;
    });
    return image;
  } catch (error) {
    console.error("[C3Compaction] Failed to decode repacked image:", error);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 把 HTMLImageElement 无损导出为 PNG Blob（兜底路径：
 * 导入时没有原始文件 Blob 时用于建立 generation 图片 asset）。
 */
export async function imageElementToPngBlob(
  image: HTMLImageElement,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width || 1;
    canvas.height = image.naturalHeight || image.height || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
  } catch (error) {
    console.error("[C3Compaction] Failed to encode image element:", error);
    return null;
  }
}
