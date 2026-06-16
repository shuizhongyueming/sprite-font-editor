/**
 * 图片格式相关工具函数
 */

export interface ImageExportFormat {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
}

const MIME_TYPE_MAP: Record<string, ImageExportFormat["mimeType"]> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
};

const EXTENSION_MAP: Record<string, ImageExportFormat["extension"]> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  webp: "webp",
};

/**
 * 根据文件名推断 MIME type
 */
export function getImageMimeTypeFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

/**
 * 根据文件名和 MIME type 推断导出格式
 * 不支持的格式默认回退到 PNG
 */
export function getImageExportFormat(
  filename: string,
  mimeType?: string,
): ImageExportFormat {
  if (mimeType && MIME_TYPE_MAP[mimeType]) {
    return {
      mimeType: MIME_TYPE_MAP[mimeType],
      extension: getExtensionFromMimeType(mimeType),
    };
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension && EXTENSION_MAP[extension]) {
    return {
      mimeType: getMimeTypeFromExtension(extension),
      extension: EXTENSION_MAP[extension],
    };
  }

  return { mimeType: "image/png", extension: "png" };
}

function getExtensionFromMimeType(mimeType: string): ImageExportFormat["extension"] {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

function getMimeTypeFromExtension(
  extension: string,
): ImageExportFormat["mimeType"] {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

/**
 * 替换文件名扩展名
 */
export function replaceExtension(filename: string, extension: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${filename}.${extension}`;
  }
  return `${filename.slice(0, dotIndex)}.${extension}`;
}

/**
 * 构建 File System Access API 的文件类型过滤器
 */
export function buildFilePickerType(format: ImageExportFormat): FilePickerAcceptType {
  const accept: FilePickerAcceptType["accept"] = {};
  switch (format.mimeType) {
    case "image/jpeg":
      accept["image/jpeg"] = [".jpg", ".jpeg"];
      break;
    case "image/webp":
      accept["image/webp"] = [".webp"];
      break;
    case "image/png":
    default:
      accept["image/png"] = [".png"];
      break;
  }

  return {
    description: `${format.extension.toUpperCase()} Image`,
    accept,
  };
}
