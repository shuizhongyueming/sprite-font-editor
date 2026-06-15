import { CanvasSpace } from "@/utils/canvas";
import { renderC3AppendedCharacter } from "@/utils/c3-char-renderer";
import { splitGraphemes } from "@/utils/grapheme";
import type { C3InstanceArray } from "@/utils/c3-parser";

/**
 * Build C3 spacingData JSON string from a display-width map.
 *
 * Characters are grouped by display width. Groups whose display width equals
 * `characterWidth` are skipped, matching C3's own behavior.
 */
export function buildSpacingData(
  displayWidthMap: Map<string, number>,
  characterWidth: number,
  characterSet: string[],
): string {
  const groups = new Map<number, string[]>();

  for (const char of characterSet) {
    const width = displayWidthMap.get(char);
    if (width === undefined || width === characterWidth) {
      continue;
    }

    if (!groups.has(width)) {
      groups.set(width, []);
    }
    groups.get(width)!.push(char);
  }

  const result: Array<[number, string]> = [];
  for (const [width, chars] of groups.entries()) {
    result.push([width, chars.join("")]);
  }

  return JSON.stringify(result);
}

/**
 * Clone the original C3 instance array and update only the exported font fields.
 *
 * - Index 4 (`_characterSet`) becomes the joined characterSet string.
 * - Index 5 (`spacingData`) becomes the exported spacingData string.
 * - All other fields are preserved exactly as in the original array.
 */
export function buildC3InstanceArray(
  originalArray: C3InstanceArray,
  characterSet: string[],
  spacingData: string,
): C3InstanceArray {
  const cloned = [...originalArray] as unknown as C3InstanceArray;
  cloned[4] = characterSet.join("");
  cloned[5] = spacingData;
  return cloned;
}

export interface C3AppendedEntry {
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
  distributionOffset: number;
}

export interface ExportC3Options {
  originalArray: C3InstanceArray;
  importedCharacterSet: string;
  characterSet: string[];
  spacingData: string;
  baseImage: HTMLImageElement;
  c3ImportedImage: HTMLImageElement | null;
  baseCellConfig: {
    width: number;
    height: number;
    margin: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    padding: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  baseImageConfig: {
    margin: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    padding: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    fontSpriteWidth?: number;
    fontSpriteHeight?: number;
  };
  appendedEntries: C3AppendedEntry[];
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
  currentFontFamily?: string;
  filename: string;
  onDownload?: () => void;
}

/**
 * Build the updated C3 instance array, render appended characters at original
 * size, and trigger a PNG download.
 */
export function exportC3SpriteFont(options: ExportC3Options): C3InstanceArray {
  const {
    originalArray,
    importedCharacterSet,
    characterSet,
    spacingData,
    baseImage,
    c3ImportedImage,
    baseCellConfig,
    baseImageConfig,
    appendedEntries,
    characterStyle,
    currentFontFamily,
    filename,
    onDownload,
  } = options;

  const updatedArray = buildC3InstanceArray(
    originalArray,
    characterSet,
    spacingData,
  );

  const sourceImage = c3ImportedImage || baseImage;
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法获取 Canvas 上下文");
  }

  ctx.drawImage(sourceImage, 0, 0);

  if (appendedEntries.length > 0) {
    const canvasSpace = new CanvasSpace(
      canvas.width,
      canvas.height,
      baseCellConfig.width,
      baseCellConfig.height,
      { top: 0, right: 0, bottom: 0, left: 0 },
      baseImageConfig.margin,
      baseImageConfig.padding,
      baseImageConfig.fontSpriteWidth,
      baseImageConfig.fontSpriteHeight,
    );

    const importedCount = splitGraphemes(importedCharacterSet).length;
    const fontFamily = currentFontFamily || characterStyle.fontFamily;

    for (let i = 0; i < appendedEntries.length; i++) {
      const entry = appendedEntries[i];
      const cellIndex = importedCount + i;
      const { row, col } = canvasSpace.indexToRowCol(cellIndex);
      const position = canvasSpace.getCellPosition(row, col);

      renderC3AppendedCharacter({
        char: entry.char,
        targetCtx: ctx,
        baseCellX: position.x,
        baseCellY: position.y,
        baseCellWidth: baseCellConfig.width,
        baseCellHeight: baseCellConfig.height,
        renderScale: 1,
        charMargin: {
          ...entry.margin,
          top: entry.distributionOffset + entry.margin.top,
        },
        cellPadding: baseCellConfig.padding,
        fontFamily,
        fontSize: characterStyle.fontSize,
        color: characterStyle.color,
        outline: characterStyle.outline,
        pixelStyle: characterStyle.pixelStyle,
        alignment: { horizontal: "left", vertical: "top" },
      });
    }
  }

  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  onDownload?.();

  return updatedArray;
}
