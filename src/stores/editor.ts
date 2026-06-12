import { defineStore } from "pinia";
import { ref, computed, nextTick } from "vue";
import {
  ImageStorage,
  FontStorage,
  C3ImageStorage,
  C3ConfigStorage,
} from "@/utils/storage";
import { detectGridFast } from "@/utils/grid-detector";
import { notify } from "@/utils/notification";
import { t } from "@/utils/i18n";
import { splitGraphemes } from "@/utils/grapheme";
import { measureGlyphDisplayWidth } from "@/utils/c3-char-renderer";
import { buildC3InstanceArray } from "@/utils/c3-export";
import type { C3InstanceArray, C3ParsedData } from "@/utils/c3-parser";

// 单元格信息接口（用于插入点检测）
export interface GridCellInfo {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 基于原始图片尺寸的绝对配置（用于持久化）
export interface BaseCellConfig {
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
}

export interface BaseImageConfig {
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
}

// 显示用的配置（基于当前 canvas 尺寸，用于 UI 渲染）
export interface ImageConfig {
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  width?: number;
  height?: number;
}

export interface CellConfig {
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
}

export interface CellAlignmentConfig {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
}

export interface GlobalCharacterStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  outline: {
    enabled: boolean;
    color: string;
    width: number;
  };
  pixelStyle: boolean;
}

export interface CharacterEntry {
  char: string;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface C3AppendedEntry extends CharacterEntry {
  displayWidth: number;
  autoDisplayWidth: number;
  isDisplayWidthManual?: boolean;
}

export interface InsertPointConfig {
  mode: "auto" | "manual";
  startCellIndex?: number;
}

export const useEditorStore = defineStore("editor", () => {
  // 基于原始图片尺寸的绝对配置（用于持久化）
  const baseCellConfig = ref<BaseCellConfig>({
    width: 32,
    height: 32,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const baseImageConfig = ref<BaseImageConfig>({
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    fontSpriteWidth: undefined,
    fontSpriteHeight: undefined,
  });

  const effectiveSpriteWidth = computed(() => {
    return (
      baseImageConfig.value.fontSpriteWidth || originalImageWidth.value || 0
    );
  });

  const effectiveSpriteHeight = computed(() => {
    return (
      baseImageConfig.value.fontSpriteHeight || originalImageHeight.value || 0
    );
  });

  // 计算当前缩放比例
  const canvasScale = computed(() => {
    if (!originalImageWidth.value || !originalImageHeight.value) return 1;
    if (displayedCanvasWidth.value === 0) return 1;
    return displayedCanvasWidth.value / originalImageWidth.value;
  });

  // 显示用的配置（基于当前 canvas 尺寸，用于 UI 渲染）
  const cellConfig = computed<CellConfig>(() => {
    const scale = canvasScale.value;

    return {
      width: Math.round(baseCellConfig.value.width * scale),
      height: Math.round(baseCellConfig.value.height * scale),
      margin: {
        top: Math.round(baseCellConfig.value.margin.top * scale),
        right: Math.round(baseCellConfig.value.margin.right * scale),
        bottom: Math.round(baseCellConfig.value.margin.bottom * scale),
        left: Math.round(baseCellConfig.value.margin.left * scale),
      },
      padding: {
        top: Math.round(baseCellConfig.value.padding.top * scale),
        right: Math.round(baseCellConfig.value.padding.right * scale),
        bottom: Math.round(baseCellConfig.value.padding.bottom * scale),
        left: Math.round(baseCellConfig.value.padding.left * scale),
      },
    };
  });

  const imageConfig = computed<ImageConfig>(() => {
    const scale = canvasScale.value;

    return {
      margin: {
        top: Math.round(baseImageConfig.value.margin.top * scale),
        right: Math.round(baseImageConfig.value.margin.right * scale),
        bottom: Math.round(baseImageConfig.value.margin.bottom * scale),
        left: Math.round(baseImageConfig.value.margin.left * scale),
      },
      padding: {
        top: Math.round(baseImageConfig.value.padding.top * scale),
        right: Math.round(baseImageConfig.value.padding.right * scale),
        bottom: Math.round(baseImageConfig.value.padding.bottom * scale),
        left: Math.round(baseImageConfig.value.padding.left * scale),
      },
    };
  });

  // 网格显示配置
  const gridConfig = ref({
    enabled: true,
    cellBorder: true,
    cellBorderColor: "rgba(0, 255, 0, 0.5)",
    cellBorderWidth: 1,
    marginLines: false,
    marginLineColor: "rgba(255, 0, 0, 0.3)",
    paddingLines: false,
    paddingLineColor: "rgba(0, 0, 255, 0.3)",
  });

  // Canvas 背景颜色配置
  type CanvasBgType = "white" | "black" | "checkerboard";
  const canvasBg = ref<CanvasBgType>("white");

  // 画布视图模式
  const canvasViewMode = ref<"fit" | "actual">("fit");

  // 对齐配置
  const cellAlignment = ref<CellAlignmentConfig>({
    horizontal: "center",
    vertical: "middle",
  });

  // 字符样式
  const characterStyle = ref<GlobalCharacterStyle>({
    fontFamily: "Arial",
    fontSize: 16,
    color: "#000000",
    outline: {
      enabled: false,
      color: "#ffffff",
      width: 1,
    },
    pixelStyle: false,
  });

  // 插入点配置
  const insertPointConfig = ref<InsertPointConfig>({
    mode: "auto",
    startCellIndex: 0,
  });

  // 字符输入
  const characterEntries = ref<CharacterEntry[]>([]);

  // C3 模式状态
  const isC3Mode = ref(false);
  const c3InstanceArray = ref<C3InstanceArray | null>(null);
  const importedCharacterSet = ref("");
  const importedSpacingData = ref("");
  const importedCharacterSpacing = ref(0);
  const importedLineHeight = ref(0);
  const c3ImportedImage = ref<HTMLImageElement | null>(null);
  const c3ImportedImageFilename = ref("");
  const c3AppendedEntries = ref<C3AppendedEntry[]>([]);

  // C3 模式派生数据
  const c3EffectiveCharacterSet = computed(() => {
    return (
      importedCharacterSet.value +
      c3AppendedEntries.value.map((entry) => entry.char).join("")
    );
  });

  const c3EffectiveSpacingData = computed(() => {
    if (!isC3Mode.value) {
      return importedSpacingData.value;
    }

    const characterWidth = baseCellConfig.value.width;
    const displayWidthMap = new Map<string, number>();

    try {
      if (importedSpacingData.value) {
        const tuples = JSON.parse(importedSpacingData.value) as Array<
          [number, string]
        >;
        for (const [width, chars] of tuples) {
          if (width === characterWidth) continue;
          for (const char of splitGraphemes(chars)) {
            displayWidthMap.set(char, width);
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse imported spacing data:", error);
    }

    for (const entry of c3AppendedEntries.value) {
      displayWidthMap.set(entry.char, entry.displayWidth);
    }

    const groups = new Map<number, string[]>();
    for (const [char, width] of displayWidthMap.entries()) {
      if (width === characterWidth) continue;
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
  });

  const c3ExportInstanceArray = computed<C3InstanceArray | null>(() => {
    if (!isC3Mode.value || !c3InstanceArray.value) {
      return null;
    }

    return buildC3InstanceArray(
      c3InstanceArray.value,
      [...c3EffectiveCharacterSet.value],
      c3EffectiveSpacingData.value,
    );
  });

  // 渲染触发器（用于从Toolbar触发Canvas重绘）
  const renderTrigger = ref(0);

  // Canvas 和底图相关
  const baseImage = ref<HTMLImageElement | null>(null);
  const originalImageWidth = ref(0);
  const originalImageHeight = ref(0);
  const displayedCanvasWidth = ref(0);
  const displayedCanvasHeight = ref(0);
  const maxCanvasWidth = ref(1000);
  const maxCanvasHeight = ref(700);
  const currentFont = ref<FontFace | null>(null);
  const canvasLayer = ref<HTMLCanvasElement | null>(null);

  // 缩放百分比
  const zoomPercentage = computed(() => {
    if (!originalImageWidth.value || displayedCanvasWidth.value === 0) return 100;
    return Math.round(
      (displayedCanvasWidth.value / originalImageWidth.value) * 100,
    );
  });

  // 设置画布视图模式
  function setCanvasViewMode(mode: "fit" | "actual") {
    if (mode === canvasViewMode.value || !baseImage.value) return;

    const canvasArea = document.querySelector(
      ".canvas-area",
    ) as HTMLElement | null;
    let centerRatioX = 0.5;
    let centerRatioY = 0.5;

    if (
      canvasArea &&
      displayedCanvasWidth.value > 0 &&
      displayedCanvasHeight.value > 0
    ) {
      const viewportWidth = canvasArea.clientWidth;
      const viewportHeight = canvasArea.clientHeight;
      centerRatioX =
        (canvasArea.scrollLeft + viewportWidth / 2) / displayedCanvasWidth.value;
      centerRatioY =
        (canvasArea.scrollTop + viewportHeight / 2) /
        displayedCanvasHeight.value;
    }

    canvasViewMode.value = mode;
    setBaseImage(baseImage.value);

    nextTick(() => {
      if (
        canvasArea &&
        displayedCanvasWidth.value > 0 &&
        displayedCanvasHeight.value > 0
      ) {
        const viewportWidth = canvasArea.clientWidth;
        const viewportHeight = canvasArea.clientHeight;
        canvasArea.scrollLeft =
          centerRatioX * displayedCanvasWidth.value - viewportWidth / 2;
        canvasArea.scrollTop =
          centerRatioY * displayedCanvasHeight.value - viewportHeight / 2;
      }
    });
  }

  // 插入点检测结果
  const detectedInsertPoints = ref<number[]>([]);
  const currentInsertPoint = ref<number>(0);

  // 字符选择状态
  const selectedCharIndex = ref<number | null>(null);

  // 设置图片
  async function setBaseImage(image: HTMLImageElement, blob?: Blob) {
    baseImage.value = image;
    originalImageWidth.value = image.width;
    originalImageHeight.value = image.height;

    // 缩放计算使用原图尺寸（Canvas 始终显示整张图片）
    let scale = 1;
    if (canvasViewMode.value === "fit") {
      const widthRatio = maxCanvasWidth.value / image.width;
      const heightRatio = maxCanvasHeight.value / image.height;

      if (
        image.width > maxCanvasWidth.value ||
        image.height > maxCanvasHeight.value
      ) {
        scale = Math.min(widthRatio, heightRatio);
      }
    }

    displayedCanvasWidth.value = Math.floor(image.width * scale);
    displayedCanvasHeight.value = Math.floor(image.height * scale);

    // 保存到 IndexedDB
    if (blob) {
      await ImageStorage.save(blob, image.width, image.height);
    }
  }

  // 设置字体
  async function setFont(font: FontFace, data?: ArrayBuffer) {
    currentFont.value = font;
    characterStyle.value.fontFamily = font.family;

    // 保存到 IndexedDB
    if (data) {
      await FontStorage.save(font.family, data);
    }
  }

  // 设置 Canvas 引用
  function setCanvas(canvas: HTMLCanvasElement | null) {
    canvasLayer.value = canvas;
  }

  // 更新字符输入
  function updateCharacters(input: string) {
    characterEntries.value = [...input].map((char) => ({
      char,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
  }

  // 设置 C3 导入的图片（不保存到普通图片存储）
  function setC3ImportedImage(image: HTMLImageElement) {
    c3ImportedImage.value = image;
    setBaseImage(image);
  }

  // 进入或退出 C3 模式
  function setC3Mode(value: boolean) {
    isC3Mode.value = value;
  }

  // 清空 C3 状态
  function clearC3State() {
    isC3Mode.value = false;
    c3InstanceArray.value = null;
    importedCharacterSet.value = "";
    importedSpacingData.value = "";
    importedCharacterSpacing.value = 0;
    importedLineHeight.value = 0;
    c3ImportedImage.value = null;
    c3ImportedImageFilename.value = "";
    c3AppendedEntries.value = [];
  }

  // 导入 C3 Sprite Font
  function importC3SpriteFont(
    image: HTMLImageElement,
    array: C3InstanceArray,
    parsed: C3ParsedData,
    imageFilename?: string,
    fontSpriteWidth?: number,
    fontSpriteHeight?: number,
  ) {
    // 重置为干净状态，避免与普通模式数据混合
    clearState();

    isC3Mode.value = true;
    c3InstanceArray.value = array;
    importedCharacterSet.value = parsed.characterSet.join("");
    importedSpacingData.value = parsed.spacingData;
    importedCharacterSpacing.value = parsed.characterSpacing;
    importedLineHeight.value = parsed.lineHeight;
    c3ImportedImage.value = image;
    c3ImportedImageFilename.value = imageFilename || "";
    c3AppendedEntries.value = [];

    setBaseImage(image);

    baseCellConfig.value = {
      ...baseCellConfig.value,
      width: parsed.characterWidth,
      height: parsed.characterHeight,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };

    baseImageConfig.value = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      fontSpriteWidth: fontSpriteWidth ?? image.width,
      fontSpriteHeight: fontSpriteHeight ?? image.height,
    };

    cellAlignment.value = { horizontal: "left", vertical: "top" };

    renderTrigger.value++;
    saveToLocalStorage();
  }

  // 追加 C3 字符（自动计算显示宽度）
  function appendC3Characters(chars: string[]) {
    if (!isC3Mode.value) return;

    const fontFamily = currentFont.value?.family || characterStyle.value.fontFamily;
    const newEntries: C3AppendedEntry[] = chars.map((char) => {
      const autoWidth = measureGlyphDisplayWidth({
        text: char,
        fontFamily,
        fontSize: characterStyle.value.fontSize,
        characterWidth: baseCellConfig.value.width,
        characterHeight: baseCellConfig.value.height,
        padding: baseCellConfig.value.padding,
        color: characterStyle.value.color,
        outline: characterStyle.value.outline,
      });

      return {
        char,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        displayWidth: autoWidth,
        autoDisplayWidth: autoWidth,
      };
    });

    c3AppendedEntries.value.push(...newEntries);
    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 移除单个追加的 C3 字符
  function removeC3AppendedCharacter(index: number) {
    if (!isC3Mode.value) return;

    c3AppendedEntries.value.splice(index, 1);

    if (selectedCharIndex.value === index) {
      selectedCharIndex.value = null;
    } else if (
      selectedCharIndex.value !== null &&
      selectedCharIndex.value > index
    ) {
      selectedCharIndex.value--;
    }

    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 更新追加字符的显示宽度
  function updateC3AppendedDisplayWidth(
    index: number,
    width: number | "auto",
  ) {
    if (!isC3Mode.value || index < 0 || index >= c3AppendedEntries.value.length) {
      return;
    }

    const entry = c3AppendedEntries.value[index];
    entry.displayWidth = width === "auto" ? entry.autoDisplayWidth : width;
    entry.isDisplayWidthManual = width !== "auto";

    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 清空所有追加的 C3 字符
  function clearC3AppendedCharacters() {
    if (!isC3Mode.value) return;

    c3AppendedEntries.value = [];
    selectedCharIndex.value = null;

    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 重新计算所有追加字符的自动显示宽度
  function recalculateC3AppendedDisplayWidths() {
    if (!isC3Mode.value) return;

    const fontFamily = currentFont.value?.family || characterStyle.value.fontFamily;

    for (const entry of c3AppendedEntries.value) {
      const autoWidth = measureGlyphDisplayWidth({
        text: entry.char,
        fontFamily,
        fontSize: characterStyle.value.fontSize,
        characterWidth: baseCellConfig.value.width,
        characterHeight: baseCellConfig.value.height,
        padding: baseCellConfig.value.padding,
        color: characterStyle.value.color,
        outline: characterStyle.value.outline,
      });

      entry.autoDisplayWidth = autoWidth;
      if (!entry.isDisplayWidthManual) {
        entry.displayWidth = autoWidth;
      }
    }

    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 检测插入点（基于透明度）
  // cells 参数可选，传入时使用传入的 cells，否则使用内部计算
  function detectInsertPoints(
    canvas: HTMLCanvasElement,
    cells?: GridCellInfo[],
  ) {
    console.log("[detectInsertPoints] 开始检测插入点...", cells);

    if (!baseImage.value) {
      console.log("[detectInsertPoints] 没有底图，清空检测结果");
      detectedInsertPoints.value = [];
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("[detectInsertPoints] 无法获取Canvas上下文");
      detectedInsertPoints.value = [];
      return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const emptyCells: number[] = [];

    if (cells) {
      // 使用传入的 cells
      console.log(
        `[detectInsertPoints] Canvas尺寸: ${canvas.width}x${canvas.height}, 待检测单元格: ${cells.length}`,
      );
      for (const cell of cells) {
        const isEmpty = isCellEmpty(
          imageData,
          cell.x,
          cell.y,
          cell.width,
          cell.height,
        );
        if (isEmpty) {
          emptyCells.push(cell.index);
        }
      }
    } else {
      // 内部计算 cells（向后兼容）
      const currentCellConfig = cellConfig.value;
      const currentImageConfig = imageConfig.value;

      const cellTotalWidth =
        currentCellConfig.width +
        currentCellConfig.margin.left +
        currentCellConfig.margin.right;
      const cellTotalHeight =
        currentCellConfig.height +
        currentCellConfig.margin.top +
        currentCellConfig.margin.bottom;

      const startX =
        currentImageConfig.margin.left + currentImageConfig.padding.left;
      const startY =
        currentImageConfig.margin.top + currentImageConfig.padding.top;

      const effectiveSpriteWidth =
        baseImageConfig.value.fontSpriteWidth || originalImageWidth.value || 0;
      const effectiveSpriteHeight =
        baseImageConfig.value.fontSpriteHeight ||
        originalImageHeight.value ||
        0;

      const availableWidth =
        effectiveSpriteWidth - startX - currentImageConfig.padding.right;
      const availableHeight =
        effectiveSpriteHeight - startY - currentImageConfig.padding.bottom;

      const cols =
        availableWidth >= cellTotalWidth
          ? Math.floor(
              (availableWidth - currentCellConfig.width) / cellTotalWidth,
            ) + 1
          : 0;
      const rows =
        availableHeight >= cellTotalHeight
          ? Math.floor(
              (availableHeight - currentCellConfig.height) / cellTotalHeight,
            ) + 1
          : 0;

      console.log(
        `[detectInsertPoints] Canvas尺寸: ${canvas.width}x${canvas.height}, 网格: ${rows}行×${cols}列`,
      );

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cellX =
            startX + col * cellTotalWidth + currentCellConfig.margin.left;
          const cellY =
            startY + row * cellTotalHeight + currentCellConfig.margin.top;
          const cellWidth = currentCellConfig.width;
          const cellHeight = currentCellConfig.height;
          const index = row * cols + col;

          const isEmpty = isCellEmpty(
            imageData,
            cellX,
            cellY,
            cellWidth,
            cellHeight,
          );
          if (isEmpty) {
            emptyCells.push(index);
          }
        }
      }
    }

    console.log(
      `[detectInsertPoints] 检测完成！找到 ${emptyCells.length} 个空单元格: [${emptyCells.join(", ")}]`,
    );

    detectedInsertPoints.value = emptyCells;

    if (insertPointConfig.value.mode === "auto" && emptyCells.length > 0) {
      insertPointConfig.value.startCellIndex = emptyCells[0];
      currentInsertPoint.value = 0;
      console.log(`[detectInsertPoints] 设置起始插入点为: ${emptyCells[0]}`);
    } else if (emptyCells.length === 0) {
      console.log("[detectInsertPoints] 没有找到空单元格");
    }
  }

  // 检查单元格是否为空（基于透明度）
  function isCellEmpty(
    imageData: ImageData,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    threshold: number = 10,
  ): boolean {
    const { data, width } = imageData;

    // 边界检查
    if (cellX + cellWidth > width || cellY + cellHeight > imageData.height) {
      console.log(
        `[isCellEmpty] 单元格超出边界: (${cellX}, ${cellY}) ${cellWidth}x${cellHeight} > ${width}x${imageData.height}`,
      );
      return false;
    }

    let nonTransparentPixels = 0;
    for (let y = cellY; y < cellY + cellHeight; y++) {
      for (let x = cellX; x < cellX + cellWidth; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > threshold) {
          nonTransparentPixels++;
        }
      }
    }

    const isEmpty = nonTransparentPixels === 0;

    return isEmpty;
  }

  // 保存到 localStorage（保存基础配置）
  function saveToLocalStorage() {
    const state = {
      baseCellConfig: baseCellConfig.value,
      baseImageConfig: baseImageConfig.value,
      cellAlignment: cellAlignment.value,
      characterStyle: characterStyle.value,
      insertPointConfig: insertPointConfig.value,
      characterEntries: characterEntries.value,
      gridConfig: gridConfig.value,
      canvasBg: canvasBg.value,
      canvasViewMode: canvasViewMode.value,
      isC3Mode: isC3Mode.value,
    };
    localStorage.setItem("sprite-font-editor-state", JSON.stringify(state));

    C3ConfigStorage.save({
      version: 1,
      instanceArrayJson: c3InstanceArray.value
        ? JSON.stringify(c3InstanceArray.value)
        : "",
      importedCharacterSet: importedCharacterSet.value,
      importedSpacingData: importedSpacingData.value,
      importedCharacterSpacing: importedCharacterSpacing.value,
      importedLineHeight: importedLineHeight.value,
      appendedEntries: c3AppendedEntries.value,
      originalImageWidth: originalImageWidth.value,
      originalImageHeight: originalImageHeight.value,
      imageFilename: c3ImportedImageFilename.value,
    });
  }

  // 从 localStorage 恢复
  function loadFromLocalStorage() {
    const saved = localStorage.getItem("sprite-font-editor-state");
    if (saved) {
      try {
        const state = JSON.parse(saved);

        // 兼容新格式
        if (state.baseCellConfig) {
          baseCellConfig.value = state.baseCellConfig;
        } else if (state.cellConfig) {
          // 旧格式转换为新格式
          baseCellConfig.value = {
            width: state.cellConfig.width,
            height: state.cellConfig.height,
            margin: {
              top: state.cellConfig.margin.top,
              right: state.cellConfig.margin.right,
              bottom: state.cellConfig.margin.bottom,
              left: state.cellConfig.margin.left,
            },
            padding: {
              top: state.cellConfig.padding.top,
              right: state.cellConfig.padding.right,
              bottom: state.cellConfig.padding.bottom,
              left: state.cellConfig.padding.left,
            },
          };
        }

        if (state.baseImageConfig) {
          baseImageConfig.value = state.baseImageConfig;
        } else if (state.imageConfig) {
          baseImageConfig.value = {
            margin: {
              top: state.imageConfig.margin.top,
              right: state.imageConfig.margin.right,
              bottom: state.imageConfig.margin.bottom,
              left: state.imageConfig.margin.left,
            },
            padding: {
              top: state.imageConfig.padding.top,
              right: state.imageConfig.padding.right,
              bottom: state.imageConfig.padding.bottom,
              left: state.imageConfig.padding.left,
            },
          };
        }

        cellAlignment.value = state.cellAlignment || cellAlignment.value;
        characterStyle.value = state.characterStyle || characterStyle.value;
        insertPointConfig.value =
          state.insertPointConfig || insertPointConfig.value;
        characterEntries.value = state.characterEntries || [];
        gridConfig.value = state.gridConfig || gridConfig.value;
        canvasBg.value = state.canvasBg || "white";
        canvasViewMode.value = state.canvasViewMode || "fit";
        isC3Mode.value = state.isC3Mode || false;

        restoreC3Config();
      } catch (error) {
        console.warn("Failed to load state from localStorage:", error);
      }
    }
  }

  const CURRENT_C3_STORAGE_VERSION = 1;

  function restoreC3Config() {
    const c3Config = C3ConfigStorage.load();
    if (!c3Config) {
      if (isC3Mode.value) {
        clearC3State();
      }
      return;
    }

    if (c3Config.version !== CURRENT_C3_STORAGE_VERSION) {
      console.warn(
        `[Editor] C3 storage version mismatch: ${c3Config.version}`,
      );
      notify.warning(t("c3StorageVersionMismatch"));
      clearC3State();
      return;
    }

    try {
      c3InstanceArray.value = c3Config.instanceArrayJson
        ? (JSON.parse(c3Config.instanceArrayJson) as C3InstanceArray)
        : null;
    } catch {
      c3InstanceArray.value = null;
    }

    importedCharacterSet.value = c3Config.importedCharacterSet || "";
    importedSpacingData.value = c3Config.importedSpacingData || "";
    importedCharacterSpacing.value = c3Config.importedCharacterSpacing || 0;
    importedLineHeight.value = c3Config.importedLineHeight || 0;
    c3ImportedImageFilename.value = c3Config.imageFilename || "";
    c3AppendedEntries.value = c3Config.appendedEntries || [];
  }

  // 从 IndexedDB 恢复图片和字体
  async function restoreAssets() {
    if (isC3Mode.value) {
      // 恢复 C3 图片
      const c3ImageData = await C3ImageStorage.load();
      if (c3ImageData) {
        try {
          const url = URL.createObjectURL(c3ImageData.blob);
          const img = new Image();
          img.onload = () => {
            setC3ImportedImage(img);
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            C3ImageStorage.remove();
          };
          img.src = url;
        } catch (error) {
          console.warn("Failed to restore C3 image:", error);
          await C3ImageStorage.remove();
        }
      }
    } else {
      // 恢复普通图片
      const imageData = await ImageStorage.load();
      if (imageData) {
        try {
          const url = URL.createObjectURL(imageData.blob);
          const img = new Image();
          img.onload = () => {
            setBaseImage(img, imageData.blob);
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            ImageStorage.remove();
          };
          img.src = url;
        } catch (error) {
          console.warn("Failed to restore image:", error);
          await ImageStorage.remove();
        }
      }
    }

    // 恢复字体
    const fontData = await FontStorage.load();
    if (fontData) {
      try {
        const fontFace = new FontFace(fontData.name, fontData.data);
        await fontFace.load();
        document.fonts.add(fontFace);
        setFont(fontFace, fontData.data);
      } catch (error) {
        console.warn("Failed to restore font:", error);
        await FontStorage.remove();
      }
    }
  }

  // 清除所有缓存数据
  async function clearAllData() {
    clearState();
    await Promise.all([
      ImageStorage.remove(),
      FontStorage.remove(),
      C3ImageStorage.remove(),
      C3ConfigStorage.remove(),
    ]);
  }

  // 清空状态
  function clearState() {
    baseCellConfig.value = {
      width: 32,
      height: 32,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    baseImageConfig.value = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      fontSpriteWidth: undefined,
      fontSpriteHeight: undefined,
    };
    cellAlignment.value = {
      horizontal: "center",
      vertical: "middle",
    };
    characterStyle.value = {
      fontFamily: "Arial",
      fontSize: 16,
      color: "#000000",
      outline: {
        enabled: false,
        color: "#ffffff",
        width: 1,
      },
      pixelStyle: false,
    };
    insertPointConfig.value = {
      mode: "auto",
      startCellIndex: 0,
    };
    gridConfig.value = {
      enabled: true,
      cellBorder: true,
      cellBorderColor: "rgba(0, 255, 0, 0.5)",
      cellBorderWidth: 1,
      marginLines: false,
      marginLineColor: "rgba(255, 0, 0, 0.3)",
      paddingLines: false,
      paddingLineColor: "rgba(0, 0, 255, 0.3)",
    };
    canvasBg.value = "white";
    characterEntries.value = [];
    baseImage.value = null;
    currentFont.value = null;
    originalImageWidth.value = 0;
    originalImageHeight.value = 0;
    displayedCanvasWidth.value = 0;
    displayedCanvasHeight.value = 0;
    clearC3State();
    localStorage.removeItem("sprite-font-editor-state");
    C3ConfigStorage.remove();
  }

  // 自动检测网格
  function autoDetectGrid() {
    if (!baseImage.value) {
      notify.warning(t("noImageLoaded"));
      return;
    }

    const result = detectGridFast(baseImage.value, {
      margin: baseImageConfig.value.margin,
      fontSpriteWidth: baseImageConfig.value.fontSpriteWidth,
      fontSpriteHeight: baseImageConfig.value.fontSpriteHeight,
    });

    if (!result) {
      notify.warning(t("gridDetectionFailed"));
      return;
    }

    console.log(
      `[AutoDetect] 检测结果: 单元格=${result.cellWidth}x${result.cellHeight}, 网格=${result.rows}行×${result.cols}列, padding=${JSON.stringify(result.padding)}, 置信度=${(result.confidence * 100).toFixed(1)}%`,
    );

    // 更新配置（检测结果已经是原始尺寸）
    baseCellConfig.value = {
      ...baseCellConfig.value,
      width: result.cellWidth,
      height: result.cellHeight,
    };

    // 更新图片 padding
    baseImageConfig.value = {
      ...baseImageConfig.value,
      padding: result.padding,
    };

    // 触发重新渲染
    renderTrigger.value++;

    // 保存到 localStorage
    saveToLocalStorage();

    notify.success(
      t("gridDetectionSuccess", {
        width: String(result.cellWidth),
        height: String(result.cellHeight),
        rows: String(result.rows),
        cols: String(result.cols),
      }),
    );
  }

  return {
    // 基础配置（用于持久化，基于原始图片尺寸）
    baseCellConfig,
    baseImageConfig,

    // 计算后的配置（用于渲染，已缩放到当前 canvas 尺寸）
    imageConfig,
    cellConfig,

    // 缩放比例
    canvasScale,

    // 其他状态
    cellAlignment,
    characterStyle,
    insertPointConfig,
    characterEntries,
    renderTrigger,
    selectedCharIndex,
    baseImage,
    // Canvas 尺寸相关（使用缩放后的尺寸）
    canvasWidth: displayedCanvasWidth,
    canvasHeight: displayedCanvasHeight,
    originalImageWidth,
    originalImageHeight,
    effectiveSpriteWidth,
    effectiveSpriteHeight,
    maxCanvasWidth,
    maxCanvasHeight,
    currentFont,
    gridConfig,
    canvasBg,
    canvasViewMode,
    zoomPercentage,
    detectedInsertPoints,
    currentInsertPoint,
    // C3 模式状态
    isC3Mode,
    c3InstanceArray,
    importedCharacterSet,
    importedSpacingData,
    importedCharacterSpacing,
    importedLineHeight,
    c3ImportedImage,
    c3ImportedImageFilename,
    c3AppendedEntries,
    c3EffectiveCharacterSet,
    c3EffectiveSpacingData,
    c3ExportInstanceArray,
    // actions
    setBaseImage,
    setFont,
    setCanvas,
    setC3ImportedImage,
    setCanvasViewMode,
    updateCharacters,
    importC3SpriteFont,
    setC3Mode,
    clearC3State,
    appendC3Characters,
    removeC3AppendedCharacter,
    updateC3AppendedDisplayWidth,
    clearC3AppendedCharacters,
    recalculateC3AppendedDisplayWidths,
    saveToLocalStorage,
    loadFromLocalStorage,
    restoreAssets,
    clearState,
    clearAllData,
    detectInsertPoints,
    autoDetectGrid,
    // canvas ref
    canvasLayer,
  };
});
