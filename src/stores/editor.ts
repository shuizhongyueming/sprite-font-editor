import { defineStore } from "pinia";
import { ref, computed, nextTick, watch } from "vue";
import {
  ImageStorage,
  FontStorage,
  C3ImageStorage,
  C3ConfigStorage,
  C3GenerationStorage,
  C3_STORAGE_VERSION,
  type C3StoredConfig,
  type C3ImageDraft,
} from "@/utils/storage";
import { detectGridFast } from "@/utils/grid-detector";
import { notify } from "@/utils/notification";
import { t } from "@/utils/i18n";
import { splitGraphemes } from "@/utils/grapheme";
import { computeAutoFitSpriteSize, CanvasSpace } from "@/utils/canvas";
import { measureGlyphBounds } from "@/utils/c3-char-renderer";
import { buildC3InstanceArray, getC3AppendedEffectiveMargin } from "@/utils/c3-export";
import type { C3AppendedEntry } from "@/utils/c3-export";
import {
  computeAppendedAdvance,
  computeBearingOffset,
  measureImportedGlyphMetrics,
  type C3GlyphCellProbe,
  type C3GlyphMetrics,
} from "@/utils/c3-glyph-metrics";
import type { C3InstanceArray, C3ParsedData } from "@/utils/c3-parser";
import {
  analyzeC3SpriteCompaction,
  repackC3ImportedCells,
  migrateC3SpacingData,
  verifyCanvasAlphaRoundTrip,
  computeOldGrid,
  type C3CompactionPlan,
  type C3CompactionSource,
  type C3CompactionErrorCode,
  type C3CompactionNoSavings,
  type C3CompactionError,
} from "@/utils/c3-compaction";
import {
  encodeC3RepackedImage,
  decodeC3PngBlob,
  imageElementToPngBlob,
  imageToImageData,
} from "@/utils/c3-compaction-dom";
import {
  C3_MAX_TEXTURE_SIZE,
  computeC3RewrapPlan,
  rewrapC3ImportedCells,
  type C3RewrapPlan,
  type C3RewrapNoLayoutChange,
  type C3RewrapErrorCode,
  type C3RewrapOptions,
} from "@/utils/c3-rewrap";
import {
  getImageMimeTypeFromFilename,
  resolveAlphaSafeImageMimeType,
} from "@/utils/image-format";
import type { ProjectData } from "@/utils/project-import";

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

export interface InsertPointConfig {
  mode: "auto" | "manual";
  startCellIndex?: number;
}

/** applyC3SpriteCompaction 的成功结果 */
export interface C3CompactionApplySuccess {
  ok: true;
  plan: C3CompactionPlan;
}

/** applyC3SpriteCompaction 的失败结果（typed fail-closed，UI 层据此映射文案） */
export interface C3CompactionApplyFailure {
  ok: false;
  code: C3CompactionErrorCode;
}

export type C3CompactionApplyResult =
  | C3CompactionApplySuccess
  | C3CompactionApplyFailure;

/** prepareC3Compaction 成功时携带的完整候选 */
export interface C3CompactionPreparationPlan {
  kind: "plan";
  plan: C3CompactionPlan;
  repacked: ImageData;
  source: C3CompactionSource;
  /** 旧网格映射元数据（origin + 有效列数，与核心 analyze 唯一一致） */
  oldGrid: {
    originX: number;
    originY: number;
    columns: number;
  };
}

export type C3CompactionPreparationResult =
  | C3CompactionPreparationPlan
  | C3CompactionNoSavings
  | C3CompactionError;

/** prepareC3Rewrap 失败的可判别错误码：核心重排码 + canvas 自检码 */
export type C3RewrapPreparationErrorCode =
  | C3RewrapErrorCode
  | "alpha-roundtrip-failed";

/** prepareC3Rewrap 的阻断错误结果 */
export interface C3RewrapPreparationError {
  kind: "error";
  code: C3RewrapPreparationErrorCode;
}

/** prepareC3Rewrap 成功时携带的完整候选 */
export interface C3RewrapPreparationPlan {
  kind: "plan";
  plan: C3RewrapPlan;
  repacked: ImageData;
  source: C3CompactionSource;
}

export type C3RewrapPreparationResult =
  | C3RewrapPreparationPlan
  | C3RewrapNoLayoutChange
  | C3RewrapPreparationError;

/** applyC3SpriteRewrap 的 typed fail-closed 错误码（复用精简分类 + no-layout-change） */
export type C3RewrapApplyErrorCode =
  | "unreliable-canvas"
  | "alpha-roundtrip-failed"
  | "invalid-grid"
  | "invalid-output-dimensions"
  | "content-outside-imported-cells"
  | "persistence-failed"
  | "no-layout-change";

/** applyC3SpriteRewrap 的成功结果 */
export interface C3RewrapApplySuccess {
  ok: true;
  plan: C3RewrapPlan;
}

/** applyC3SpriteRewrap 的失败结果（typed fail-closed，UI 层据此映射文案） */
export interface C3RewrapApplyFailure {
  ok: false;
  code: C3RewrapApplyErrorCode;
}

export type C3RewrapApplyResult = C3RewrapApplySuccess | C3RewrapApplyFailure;

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

  // 画布基础尺寸：C3 模式下为 max(导入图片尺寸, fontSprite 尺寸)，
  // 普通模式下等于图片尺寸（行为不变）
  const canvasBaseWidth = computed(() => {
    if (!isC3Mode.value) return originalImageWidth.value;
    return Math.max(
      originalImageWidth.value,
      baseImageConfig.value.fontSpriteWidth || 0,
    );
  });

  const canvasBaseHeight = computed(() => {
    if (!isC3Mode.value) return originalImageHeight.value;
    return Math.max(
      originalImageHeight.value,
      baseImageConfig.value.fontSpriteHeight || 0,
    );
  });

  // 计算当前缩放比例
  const canvasScale = computed(() => {
    if (!canvasBaseWidth.value || !canvasBaseHeight.value) return 1;
    if (displayedCanvasWidth.value === 0) return 1;
    return displayedCanvasWidth.value / canvasBaseWidth.value;
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
  const c3GlobalExtraSpacing = ref(0);
  const c3AppendedVerticalAlignment = ref<"top" | "middle" | "bottom">(
    "middle",
  );
  const c3AppendedEntries = ref<C3AppendedEntry[]>([]);
  // 导入 sheet 实测水平度量（bearing/overhang 中位数，issue #21）；
  // 图片不可读/无内容时为 null，追加字符回退旧口径
  const c3ImportedGlyphMetrics = ref<C3GlyphMetrics | null>(null);

  // 项目导入来源（文件夹句柄，仅通过 showDirectoryPicker 导入时存在）
  const projectDirectoryHandle = ref<FileSystemDirectoryHandle | null>(null);

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
      const displayWidth =
        entry.autoDisplayWidth +
        c3GlobalExtraSpacing.value +
        entry.extraSpacing;
      displayWidthMap.set(entry.char, displayWidth);
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
  const baseImageFilename = ref<string>("");
  const baseImageMimeType = ref<string>("");
  const fontFilename = ref<string>("");
  const canvasLayer = ref<HTMLCanvasElement | null>(null);

  // 缩放百分比
  const zoomPercentage = computed(() => {
    if (!canvasBaseWidth.value || displayedCanvasWidth.value === 0) return 100;
    return Math.round(
      (displayedCanvasWidth.value / canvasBaseWidth.value) * 100,
    );
  });

  // 是否存在可替换的项目数据
  const hasProjectData = computed(() => {
    return (
      baseImage.value !== null ||
      characterEntries.value.length > 0 ||
      isC3Mode.value
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
  async function setBaseImage(
    image: HTMLImageElement,
    blob?: Blob,
    filename?: string,
  ) {
    if (filename) {
      baseImageFilename.value = filename;
    }
    if (blob?.type) {
      baseImageMimeType.value = blob.type;
    }

    baseImage.value = image;
    originalImageWidth.value = image.width;
    originalImageHeight.value = image.height;

    refreshCanvasSize();

    // 保存到 IndexedDB
    if (blob) {
      await ImageStorage.save(blob, image.width, image.height);
    }
  }

  // 按画布基础尺寸（C3 模式下为 max(图片, fontSprite)）与视图模式重算显示尺寸
  function refreshCanvasSize() {
    const baseWidth = canvasBaseWidth.value;
    const baseHeight = canvasBaseHeight.value;
    if (!baseWidth || !baseHeight) return;

    let scale = 1;
    if (canvasViewMode.value === "fit") {
      const widthRatio = maxCanvasWidth.value / baseWidth;
      const heightRatio = maxCanvasHeight.value / baseHeight;

      if (baseWidth > maxCanvasWidth.value || baseHeight > maxCanvasHeight.value) {
        scale = Math.min(widthRatio, heightRatio);
      }
    }

    displayedCanvasWidth.value = Math.floor(baseWidth * scale);
    displayedCanvasHeight.value = Math.floor(baseHeight * scale);
  }

  // 设置字体
  async function setFont(font: FontFace, data?: ArrayBuffer, filename?: string) {
    if (filename) {
      fontFilename.value = filename;
    }

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
    c3GlobalExtraSpacing.value = 0;
    c3AppendedVerticalAlignment.value = "middle";
    c3AppendedEntries.value = [];
    c3ImportedGlyphMetrics.value = null;
  }

  // 解析 imported spacingData 为 char → advance 映射（解析失败返回空表，
  // 度量实测退回默认 advance = characterWidth；与 C3Preview 同一解析口径）
  function parseImportedSpacingMap(spacingData: string): Map<string, number> {
    const map = new Map<string, number>();
    if (!spacingData) return map;
    try {
      const tuples = JSON.parse(spacingData) as Array<[number, string]>;
      for (const [width, chars] of tuples) {
        for (const char of splitGraphemes(chars)) {
          map.set(char, width);
        }
      }
    } catch (error) {
      console.error("[Editor] Failed to parse imported spacing data:", error);
    }
    return map;
  }

  /**
   * 纯计算：用给定 ImageData + cell/image 配置 + spacingData 实测导入 sheet
   * 的整体 bearing/overhang 中位数（不写任何 ref，供 apply 在事务边界内
   * 预计算，refreshC3GlyphMetrics 与精简/重排 apply 共用同一探针构造）。
   */
  function measureC3GlyphMetricsFromImage(
    imageData: ImageData,
    cellConfig: BaseCellConfig,
    imageConfig: BaseImageConfig,
    spacingData: string,
  ): C3GlyphMetrics | null {
    const canvasSpace = new CanvasSpace(
      Math.max(imageData.width, imageConfig.fontSpriteWidth || 0),
      Math.max(imageData.height, imageConfig.fontSpriteHeight || 0),
      cellConfig.width,
      cellConfig.height,
      cellConfig.margin,
      imageConfig.margin,
      imageConfig.padding,
      imageConfig.fontSpriteWidth,
      imageConfig.fontSpriteHeight,
    );

    const importedChars = splitGraphemes(importedCharacterSet.value);
    const spacingMap = parseImportedSpacingMap(spacingData);
    const cells: C3GlyphCellProbe[] = importedChars.map((char, index) => {
      const { row, col } = canvasSpace.indexToRowCol(index);
      const position = canvasSpace.getCellPosition(row, col);
      return {
        originX: position.x,
        originY: position.y,
        width: cellConfig.width,
        height: cellConfig.height,
        advance: spacingMap.get(char) ?? cellConfig.width,
      };
    });

    return measureImportedGlyphMetrics(imageData, cells);
  }

  /**
   * 用当前 baseCellConfig/baseImageConfig/importedSpacingData 实测导入
   * sheet 的整体 bearing/overhang 中位数并存入 ref。imageData 缺省时从
   * c3ImportedImage 读取；图片不可读或无有效 cell 时置 null，调用方回退
   * 旧口径。精简/重排 apply 改用 repacked 直接调
   * measureC3GlyphMetricsFromImage（新配置在事务边界内预计算）。
   */
  function refreshC3GlyphMetrics(imageData?: ImageData) {
    if (!isC3Mode.value || !c3InstanceArray.value) {
      c3ImportedGlyphMetrics.value = null;
      return;
    }

    const data =
      imageData ??
      (c3ImportedImage.value ? imageToImageData(c3ImportedImage.value) : null);
    if (!data) {
      c3ImportedGlyphMetrics.value = null;
      return;
    }

    c3ImportedGlyphMetrics.value = measureC3GlyphMetricsFromImage(
      data,
      baseCellConfig.value,
      baseImageConfig.value,
      importedSpacingData.value,
    );
  }

  /**
   * metrics 变化后，把带 autoGlyphWidth 的追加条目（旧条目缺字段跳过，
   * 保持旧行为）按新结构重算水平落位与步进，随后持久化并触发一次重绘。
   * offset 为全条目统一值（bearing − padding.left，与 glyph 无关）。
   * 确有条目被修改时才收尾，避免无效 save/render 脉冲。
   */
  function applyC3GlyphMetricsToEntries() {
    const metrics = c3ImportedGlyphMetrics.value;
    let changed = false;

    for (const entry of c3AppendedEntries.value) {
      if (entry.autoGlyphWidth === undefined) {
        continue;
      }
      const nextOffset = computeBearingOffset(
        metrics,
        baseCellConfig.value.padding.left,
      );
      const nextAdvance = computeAppendedAdvance(
        entry.autoGlyphWidth,
        metrics,
        baseCellConfig.value.padding.left,
      );
      if (
        entry.autoBearingOffset !== nextOffset ||
        entry.autoDisplayWidth !== nextAdvance
      ) {
        entry.autoBearingOffset = nextOffset;
        entry.autoDisplayWidth = nextAdvance;
        changed = true;
      }
    }

    if (changed) {
      saveToLocalStorage();
      renderTrigger.value++;
    }
  }

  // 导入 C3 Sprite Font
  async function importC3SpriteFont(
    image: HTMLImageElement,
    array: C3InstanceArray,
    parsed: C3ParsedData,
    imageFilename?: string,
    fontSpriteWidth?: number,
    fontSpriteHeight?: number,
    imageMimeType?: string,
    imageBlob?: Blob,
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
    baseImageMimeType.value = imageMimeType || (imageFilename
      ? getImageMimeTypeFromFilename(imageFilename)
      : "");
    c3AppendedVerticalAlignment.value = "middle";
    c3AppendedEntries.value = [];

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

    // baseImageConfig 需先于 setBaseImage 设置，
    // 保证画布基础尺寸按 C3 fontSprite 计算
    setBaseImage(image);

    cellAlignment.value = {
      horizontal: "left",
      vertical: "middle",
    };

    // 建立 coherent generation：图片 asset + state + config 原子提交，
    // 避免 import 与持久化各自独立写固定 key；无法编码图片时 fail closed
    const blob = imageBlob ?? (await imageElementToPngBlob(image));
    if (!blob) {
      throw new Error("无法将导入图片编码为 PNG，导入失败");
    }
    await persistC3Generation({
      blob,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });

    // 导入图片就绪后实测导入 sheet 水平度量（entries 尚为空，apply 为空操作）
    refreshC3GlyphMetrics();
    applyC3GlyphMetricsToEntries();

    renderTrigger.value++;
  }

  // 自动扩展 fontSprite 尺寸，使其刚好容纳全部字符（已导入 + 已追加）
  function autoFitC3FontSpriteSize() {
    if (!isC3Mode.value) return;

    const cellWidth = baseCellConfig.value.width;
    const cellHeight = baseCellConfig.value.height;
    if (cellWidth <= 0 || cellHeight <= 0) return;

    const width =
      baseImageConfig.value.fontSpriteWidth || originalImageWidth.value;
    if (width <= 0) return;

    const total =
      splitGraphemes(importedCharacterSet.value).length +
      c3AppendedEntries.value.length;
    if (total === 0) return;

    const fit = computeAutoFitSpriteSize({
      totalCells: total,
      cellWidth,
      cellHeight,
      width,
    });
    if (!fit) return;

    baseImageConfig.value.fontSpriteWidth = fit.width;
    baseImageConfig.value.fontSpriteHeight = fit.height;

    refreshCanvasSize();
    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 追加 C3 字符（自动计算显示宽度与可见高度）
  function appendC3Characters(chars: string[]) {
    if (!isC3Mode.value) return;

    const fontFamily = currentFont.value?.family || characterStyle.value.fontFamily;
    const newEntries: C3AppendedEntry[] = chars.map((char) => {
      const bounds = measureGlyphBounds({
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
        autoDisplayWidth: computeAppendedAdvance(
          bounds.width,
          c3ImportedGlyphMetrics.value,
          baseCellConfig.value.padding.left,
        ),
        autoGlyphHeight: bounds.height,
        extraSpacing: 0,
        distributionOffset: 0,
        // 记录 glyph 视觉宽，供 metrics 变化后重算 advance（issue #21）；
        // 水平偏移锚定渲染链（ink 左缘 = padding.left + margin.left），
        // 为全条目统一值 bearing − padding.left
        autoGlyphWidth: bounds.width,
        autoBearingOffset: computeBearingOffset(
          c3ImportedGlyphMetrics.value,
          baseCellConfig.value.padding.left,
        ),
      };
    });

    c3AppendedEntries.value.push(...newEntries);
    applyC3AppendedVerticalDistribution();
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

    applyC3AppendedVerticalDistribution();
    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 设置 C3 追加字符垂直分布方式
  function setC3AppendedVerticalAlignment(
    value: "top" | "middle" | "bottom",
  ) {
    if (!isC3Mode.value) return;

    c3AppendedVerticalAlignment.value = value;
    applyC3AppendedVerticalDistribution();
    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 获取追加字符实际生效的边距（垂直分布偏移 + 水平 bearing 对齐偏移）
  function getEffectiveCharMargin(index: number) {
    const entry = c3AppendedEntries.value[index];
    if (!entry) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    return getC3AppendedEffectiveMargin(entry);
  }

  // 更新追加字符的额外间距
  function updateC3AppendedExtraSpacing(index: number, extraSpacing: number) {
    if (
      !isC3Mode.value ||
      index < 0 ||
      index >= c3AppendedEntries.value.length
    ) {
      return;
    }

    const entry = c3AppendedEntries.value[index];
    entry.extraSpacing = extraSpacing;

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

  // 设置追加字符的全局额外间距
  function setC3GlobalExtraSpacing(value: number) {
    if (!isC3Mode.value) return;

    c3GlobalExtraSpacing.value = value;
    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 重新计算所有追加字符的自动显示宽度与可见高度，
  // 并同步刷新水平落位字段（left/width/offset/advance，issue #21；
  // 旧条目借此机会升级出新字段）
  function recalculateC3AppendedVerticalMetrics() {
    if (!isC3Mode.value) return;

    const fontFamily = currentFont.value?.family || characterStyle.value.fontFamily;

    for (const entry of c3AppendedEntries.value) {
      const bounds = measureGlyphBounds({
        text: entry.char,
        fontFamily,
        fontSize: characterStyle.value.fontSize,
        characterWidth: baseCellConfig.value.width,
        characterHeight: baseCellConfig.value.height,
        padding: baseCellConfig.value.padding,
        color: characterStyle.value.color,
        outline: characterStyle.value.outline,
      });

      entry.autoGlyphWidth = bounds.width;
      entry.autoBearingOffset = computeBearingOffset(
        c3ImportedGlyphMetrics.value,
        baseCellConfig.value.padding.left,
      );
      entry.autoDisplayWidth = computeAppendedAdvance(
        bounds.width,
        c3ImportedGlyphMetrics.value,
        baseCellConfig.value.padding.left,
      );
      entry.autoGlyphHeight = bounds.height;
    }

    saveToLocalStorage();
    renderTrigger.value++;
  }

  // 根据当前 C3 追加字符垂直分布方式，计算每个追加字符的自动分布偏移
  function applyC3AppendedVerticalDistribution() {
    if (!isC3Mode.value || c3AppendedEntries.value.length === 0) {
      return;
    }

    const maxHeight = Math.max(
      ...c3AppendedEntries.value.map((entry) => entry.autoGlyphHeight),
    );
    const vertical = c3AppendedVerticalAlignment.value;

    for (const entry of c3AppendedEntries.value) {
      if (vertical === "middle") {
        entry.distributionOffset = Math.round(
          (maxHeight - entry.autoGlyphHeight) / 2,
        );
      } else if (vertical === "bottom") {
        entry.distributionOffset = Math.round(
          maxHeight - entry.autoGlyphHeight,
        );
      } else {
        entry.distributionOffset = 0;
      }
    }
  }

  // 重新计算所有追加字符的自动显示宽度（保留向后兼容的别名）
  function recalculateC3AppendedDisplayWidths() {
    recalculateC3AppendedVerticalMetrics();
    applyC3AppendedVerticalDistribution();
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

  // 组装通用编辑器状态（普通模式固定 key 与 C3 generation 的 generalState 共用）
  function buildGeneralState() {
    return {
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
      baseImageFilename: baseImageFilename.value,
      baseImageMimeType: baseImageMimeType.value,
      fontFilename: fontFilename.value,
    };
  }

  // 组装 C3 配置（v3，可携带版本化图片 asset id）
  function buildC3Config(imageAssetId?: string): C3StoredConfig {
    return {
      version: C3_STORAGE_VERSION,
      instanceArrayJson: c3InstanceArray.value
        ? JSON.stringify(c3InstanceArray.value)
        : "",
      importedCharacterSet: importedCharacterSet.value,
      importedSpacingData: importedSpacingData.value,
      importedCharacterSpacing: importedCharacterSpacing.value,
      importedLineHeight: importedLineHeight.value,
      globalExtraSpacing: c3GlobalExtraSpacing.value,
      c3AppendedVerticalAlignment: c3AppendedVerticalAlignment.value,
      appendedEntries: c3AppendedEntries.value,
      originalImageWidth: originalImageWidth.value,
      originalImageHeight: originalImageHeight.value,
      imageFilename: c3ImportedImageFilename.value,
      imageAssetId,
    };
  }

  /**
   * C3 generation 提交串行化：stage → commit → prune 按序执行，
   * 避免并发 fire-and-forget 保存捕获同一旧 active 而产生孤儿 generation，
   * 也保证最终 active 为最后一次提交。
   */
  let c3CommitChain: Promise<unknown> = Promise.resolve();
  function runExclusiveC3Commit<T>(task: () => Promise<T>): Promise<T> {
    const run = c3CommitChain.then(task);
    c3CommitChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * 通过新的 generation/pointer 提交当前 C3 状态（唯一提交点）。
   * 提供 image 时写入新的版本化 IndexedDB asset；缺省时复用 active generation 的 asset。
   * 持久化失败会丢弃 staged 数据并抛出（由调用方记录/传播），active 状态保持不变。
   * commit 成功后绝不回滚或 discard 新 generation；清理一律 best-effort。
   */
  function persistC3Generation(image?: C3ImageDraft): Promise<void> {
    if (!isC3Mode.value) {
      return Promise.resolve();
    }
    return runExclusiveC3Commit(async () => {
      const activeId = C3GenerationStorage.readActiveC3GenerationId();
      const active = activeId
        ? C3GenerationStorage.readC3Generation(activeId)
        : null;
      const reuseAssetId = image ? undefined : active?.c3Config.imageAssetId;

      if (!image && !reuseAssetId) {
        throw new Error("没有可复用的 C3 图片 asset，无法持久化 C3 状态");
      }

      const stagedId = await C3GenerationStorage.stage({
        generalState: buildGeneralState(),
        c3Config: buildC3Config(reuseAssetId),
        image: image ?? null,
      });
      try {
        C3GenerationStorage.commit(stagedId);
      } catch (error) {
        // 指针未写入前失败：清理 staged 数据并传播
        await C3GenerationStorage.discard(stagedId);
        throw error;
      }
      // commit 已成功：清理所有非 active generation（best-effort，绝不回滚已提交状态）
      try {
        C3GenerationStorage.prune();
      } catch (error) {
        console.error("[Editor] Failed to prune stale generations:", error);
      }
    });
  }

  // 保存到 localStorage（保存基础配置）
  function saveToLocalStorage() {
    if (isC3Mode.value) {
      // C3 模式：通过 generation/pointer 原子提交，不复归固定 key 独立写入
      persistC3Generation().catch((error) => {
        console.error("[Editor] Failed to persist C3 state on save:", error);
        notify.error(t("c3SaveFailed"));
      });
      return;
    }

    const state = buildGeneralState();
    localStorage.setItem("sprite-font-editor-state", JSON.stringify(state));

    C3ConfigStorage.save({
      version: C3_STORAGE_VERSION,
      instanceArrayJson: "",
      importedCharacterSet: "",
      importedSpacingData: "",
      importedCharacterSpacing: 0,
      importedLineHeight: 0,
      globalExtraSpacing: 0,
      appendedEntries: [],
      originalImageWidth: originalImageWidth.value,
      originalImageHeight: originalImageHeight.value,
    });

    // 普通模式不使用 generation；清除残留的 C3 generations，
    // 防止刷新时误恢复 C3 状态（普通模式持久化语义不变）
    C3GenerationStorage.clearAll().catch((error) => {
      console.error("[Editor] Failed to clear stale C3 generations:", error);
    });
  }

  // 把解析后的通用状态对象应用到 refs（兼容新旧格式）
  function applyGeneralState(state: Record<string, unknown>) {
    // 兼容新格式
    if (state.baseCellConfig) {
      baseCellConfig.value = state.baseCellConfig as BaseCellConfig;
    } else if (state.cellConfig) {
      // 旧格式转换为新格式
      const old = state.cellConfig as {
        width: number;
        height: number;
        margin: { top: number; right: number; bottom: number; left: number };
        padding: { top: number; right: number; bottom: number; left: number };
      };
      baseCellConfig.value = {
        width: old.width,
        height: old.height,
        margin: {
          top: old.margin.top,
          right: old.margin.right,
          bottom: old.margin.bottom,
          left: old.margin.left,
        },
        padding: {
          top: old.padding.top,
          right: old.padding.right,
          bottom: old.padding.bottom,
          left: old.padding.left,
        },
      };
    }

    if (state.baseImageConfig) {
      baseImageConfig.value = state.baseImageConfig as BaseImageConfig;
    } else if (state.imageConfig) {
      const old = state.imageConfig as {
        margin: { top: number; right: number; bottom: number; left: number };
        padding: { top: number; right: number; bottom: number; left: number };
      };
      baseImageConfig.value = {
        margin: {
          top: old.margin.top,
          right: old.margin.right,
          bottom: old.margin.bottom,
          left: old.margin.left,
        },
        padding: {
          top: old.padding.top,
          right: old.padding.right,
          bottom: old.padding.bottom,
          left: old.padding.left,
        },
      };
    }

    cellAlignment.value =
      (state.cellAlignment as CellAlignmentConfig) || cellAlignment.value;
    characterStyle.value =
      (state.characterStyle as GlobalCharacterStyle) || characterStyle.value;
    insertPointConfig.value =
      (state.insertPointConfig as InsertPointConfig) ||
      insertPointConfig.value;
    characterEntries.value = (state.characterEntries as CharacterEntry[]) || [];
    gridConfig.value =
      (state.gridConfig as typeof gridConfig.value) || gridConfig.value;
    canvasBg.value = (state.canvasBg as "white" | "black" | "checkerboard") || "white";
    canvasViewMode.value = (state.canvasViewMode as "fit" | "actual") || "fit";
    isC3Mode.value = state.isC3Mode === true;
    baseImageFilename.value = (state.baseImageFilename as string) || "";
    baseImageMimeType.value = (state.baseImageMimeType as string) || "";
    fontFilename.value = (state.fontFilename as string) || "";
  }

  // 从 localStorage 恢复。
  // 优先恢复 active generation（同一组状态 + C3 配置，不拼接不同 generation）；
  // 无 generation 时回退 legacy 固定 key（普通状态 + C3 v1/v2 固定配置）。
  function loadFromLocalStorage() {
    const activeId = C3GenerationStorage.readActiveC3GenerationId();
    if (activeId) {
      const generation = C3GenerationStorage.readC3Generation(activeId);
      if (generation) {
        applyGeneralState(generation.generalState as Record<string, unknown>);
        restoreC3ConfigFromConfig(generation.c3Config);
        return;
      }
      console.warn(
        "[Editor] Active C3 generation is corrupt; falling back to legacy storage",
      );
    }

    const saved = localStorage.getItem("sprite-font-editor-state");
    if (saved) {
      try {
        applyGeneralState(JSON.parse(saved));
        restoreC3ConfigFromConfig(C3ConfigStorage.load());
      } catch (error) {
        console.warn("Failed to load state from localStorage:", error);
      }
    }
  }

  function migrateC3StorageV1ToV2(
    config: C3StoredConfig & { version: 1 },
  ): C3StoredConfig {
    const entries = migrateAppendedEntries(config.appendedEntries || []).map(
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

    return {
      ...config,
      version: 2,
      c3AppendedVerticalAlignment: "middle",
      appendedEntries: entries,
    };
  }

  // 把一份 C3 配置应用到 C3 refs（v1/v2/v3 均接受：v1 先迁移到 v2）
  function restoreC3ConfigFromConfig(c3Config: C3StoredConfig | null) {
    if (!c3Config) {
      if (isC3Mode.value) {
        clearC3State();
      }
      return;
    }

    let config = c3Config;
    if (config.version === 1) {
      config = migrateC3StorageV1ToV2(
        config as C3StoredConfig & { version: 1 },
      );
    }

    if (config.version < 1 || config.version > C3_STORAGE_VERSION) {
      console.warn(`[Editor] C3 storage version mismatch: ${config.version}`);
      notify.warning(t("c3StorageVersionMismatch"));
      clearC3State();
      return;
    }

    try {
      c3InstanceArray.value = config.instanceArrayJson
        ? (JSON.parse(config.instanceArrayJson) as C3InstanceArray)
        : null;
    } catch {
      c3InstanceArray.value = null;
    }

    importedCharacterSet.value = config.importedCharacterSet || "";
    importedSpacingData.value = config.importedSpacingData || "";
    importedCharacterSpacing.value = config.importedCharacterSpacing || 0;
    importedLineHeight.value = config.importedLineHeight || 0;
    c3ImportedImageFilename.value = config.imageFilename || "";
    c3GlobalExtraSpacing.value = config.globalExtraSpacing || 0;
    c3AppendedVerticalAlignment.value =
      config.c3AppendedVerticalAlignment || "middle";
    c3AppendedEntries.value = migrateAppendedEntries(
      config.appendedEntries || [],
    );
  }

  // 迁移旧版追加字符数据：补全 autoGlyphHeight、distributionOffset 并从 displayWidth 推导出 extraSpacing。
  // issue #21 水平字段（autoGlyphWidth/autoBearingOffset）保守迁移：
  // 旧数据缺省保持 undefined，渲染按 0 处理、advance 用存量 autoDisplayWidth 原值。
  function migrateAppendedEntries(
    entries: Array<{
      char: string;
      margin: { top: number; right: number; bottom: number; left: number };
      autoDisplayWidth: number;
      autoGlyphHeight?: number;
      extraSpacing?: number;
      distributionOffset?: number;
      autoGlyphWidth?: number;
      autoBearingOffset?: number;
      displayWidth?: number;
      isDisplayWidthManual?: boolean;
    }>,
  ): C3AppendedEntry[] {
    return entries.map((entry) => {
      const distributionOffset = entry.distributionOffset ?? 0;

      if (typeof entry.extraSpacing === "number") {
        return {
          ...entry,
          autoGlyphHeight: entry.autoGlyphHeight ?? 0,
          distributionOffset,
        } as C3AppendedEntry;
      }

      // 向后兼容：从旧版 displayWidth 推导 extraSpacing
      let extraSpacing = 0;
      if (
        typeof entry.displayWidth === "number" &&
        typeof entry.autoDisplayWidth === "number" &&
        entry.displayWidth !== entry.autoDisplayWidth
      ) {
        extraSpacing = entry.displayWidth - entry.autoDisplayWidth;
      }

      return {
        char: entry.char,
        margin: entry.margin,
        autoDisplayWidth: entry.autoDisplayWidth,
        autoGlyphHeight: entry.autoGlyphHeight ?? 0,
        extraSpacing,
        distributionOffset,
        ...(entry.autoGlyphWidth !== undefined
          ? { autoGlyphWidth: entry.autoGlyphWidth }
          : {}),
        ...(entry.autoBearingOffset !== undefined
          ? { autoBearingOffset: entry.autoBearingOffset }
          : {}),
      };
    });
  }

  // 从 IndexedDB 恢复图片和字体
  async function restoreAssets() {
    if (isC3Mode.value) {
      const activeId = C3GenerationStorage.readActiveC3GenerationId();
      const activeReadable =
        activeId !== null &&
        C3GenerationStorage.readC3Generation(activeId) !== null;
      let imageAsset = await C3GenerationStorage.loadActiveC3ImageAsset();

      // active generation 不可读，或引用的图片 asset 缺失（不完整 generation）
      // → 回退 legacy 固定图片并固化迁移；两者皆无 → fail-closed 清空 C3 状态，
      // 绝不呈现半恢复项目
      if (!activeReadable || !imageAsset) {
        const legacyImage = await C3ImageStorage.load();
        if (legacyImage) {
          try {
            await persistC3Generation({
              blob: legacyImage.blob,
              width: legacyImage.width,
              height: legacyImage.height,
            });
            // 固化成功后才清理 legacy 固定数据，避免迁移失败丢数据
            await C3ImageStorage.remove();
            localStorage.removeItem("sprite-font-editor-state");
            C3ConfigStorage.remove();
          } catch (error) {
            console.warn("Failed to migrate legacy C3 storage:", error);
          }
        } else {
          console.warn(
            "[Editor] C3 image asset missing and no legacy data; clearing C3 state",
          );
          clearC3State();
          isC3Mode.value = false;
          refreshCanvasSize();
        }
        imageAsset = await C3GenerationStorage.loadActiveC3ImageAsset();
      }

      if (imageAsset) {
        try {
          const url = URL.createObjectURL(imageAsset.blob);
          const img = new Image();
          img.onload = () => {
            setC3ImportedImage(img);
            baseImageMimeType.value =
              imageAsset.mimeType || imageAsset.blob.type;
            URL.revokeObjectURL(url);
            // 图片就绪后重实测导入水平度量并应用到追加条目
            refreshC3GlyphMetrics();
            applyC3GlyphMetricsToEntries();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            // asset 存在但解码失败：fail-closed 清空，绝不呈现半恢复项目
            console.warn(
              "[Editor] Failed to decode C3 image asset; clearing C3 state",
            );
            clearC3State();
            isC3Mode.value = false;
            refreshCanvasSize();
          };
          img.src = url;
        } catch (error) {
          console.warn("Failed to restore C3 image:", error);
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
            baseImageMimeType.value = imageData.mimeType || imageData.blob.type;
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
      C3GenerationStorage.clearAll(),
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
    baseImageFilename.value = "";
    baseImageMimeType.value = "";
    fontFilename.value = "";
    originalImageWidth.value = 0;
    originalImageHeight.value = 0;
    displayedCanvasWidth.value = 0;
    displayedCanvasHeight.value = 0;
    projectDirectoryHandle.value = null;
    clearC3State();
    localStorage.removeItem("sprite-font-editor-state");
    C3ConfigStorage.remove();
    void C3GenerationStorage.clearAll();
  }

  // 应用导入的项目（事务性：在替换前完成所有校验）
  async function applyProject(project: ProjectData) {
    if (
      project.image.naturalWidth !== project.state.originalImageWidth ||
      project.image.naturalHeight !== project.state.originalImageHeight
    ) {
      throw new Error(t("projectImageDimensionMismatch"));
    }

    clearState();

    // 通用状态
    baseCellConfig.value = project.state.baseCellConfig;
    baseImageConfig.value = project.state.baseImageConfig;
    cellAlignment.value = project.state.cellAlignment;
    characterStyle.value = project.state.characterStyle;
    insertPointConfig.value = project.state.insertPointConfig;
    gridConfig.value = project.state.gridConfig;
    canvasBg.value = project.state.canvasBg;
    canvasViewMode.value = project.state.canvasViewMode;
    baseImageFilename.value = project.state.baseImageFilename || "";
    baseImageMimeType.value = project.state.baseImageMimeType || "";

    projectDirectoryHandle.value = project.directoryHandle ?? null;

    if (project.mode === "normal") {
      characterEntries.value = project.state.characterEntries || [];
      await setBaseImage(
        project.image,
        project.imageBlob,
        project.imageFilename,
      );
    } else {
      isC3Mode.value = true;
      c3InstanceArray.value = project.c3InstanceArray ?? null;
      importedCharacterSet.value = project.state.importedCharacterSet || "";
      importedSpacingData.value = project.state.importedSpacingData || "";
      importedCharacterSpacing.value =
        project.state.importedCharacterSpacing || 0;
      importedLineHeight.value = project.state.importedLineHeight || 0;
      c3GlobalExtraSpacing.value = project.state.c3GlobalExtraSpacing || 0;
      c3AppendedVerticalAlignment.value =
        project.state.c3AppendedVerticalAlignment || "middle";
      c3AppendedEntries.value = migrateAppendedEntries(
        project.state.c3AppendedEntries || [],
      );
      c3ImportedImageFilename.value = project.imageFilename;

      // 不重测/重分布：已持久化的 appended metrics（autoDisplayWidth、
      // autoGlyphHeight、extraSpacing、distributionOffset）原样保留。
      // 旧数据缺省字段由 migrateAppendedEntries 补齐；issue #21 水平字段
      // （autoGlyphWidth/autoBearingOffset）保守迁移不补默认，
      // 图片就绪后仅对带新字段的条目按当前 sheet 结构重算水平自动量。

      setC3ImportedImage(project.image);
      await persistC3Generation({
        blob: project.imageBlob,
        width: project.image.naturalWidth,
        height: project.image.naturalHeight,
      });
      // 图片就绪后实测导入水平度量：存量新字段条目按当前 sheet 结构重算，
      // 缺字段旧条目跳过（apply 内部判断），保持迁移后的旧行为
      refreshC3GlyphMetrics();
      applyC3GlyphMetricsToEntries();
    }

    if (project.font) {
      try {
        const fontFamily = project.font.filename.replace(/\.[^.]+$/, "");
        const fontFace = new FontFace(fontFamily, project.font.data);
        await fontFace.load();
        document.fonts.add(fontFace);
        await setFont(fontFace, project.font.data, project.font.filename);
      } catch (error) {
        console.warn("Failed to load project font:", error);
        notify.warning(t("projectFontLoadWarning"));
      }
    }

    if (project.mode === "normal") {
      saveToLocalStorage();
    }
    renderTrigger.value++;
  }

  /** 组装与当前 store 状态一致的 C3CompactionSource（非 C3 模式返回 null） */
  function buildCompactionSource(): C3CompactionSource | null {
    if (!isC3Mode.value || !c3ImportedImage.value || !c3InstanceArray.value) {
      return null;
    }
    return {
      fontSpriteWidth:
        baseImageConfig.value.fontSpriteWidth || originalImageWidth.value,
      fontSpriteHeight:
        baseImageConfig.value.fontSpriteHeight || originalImageHeight.value,
      characterWidth: baseCellConfig.value.width,
      characterHeight: baseCellConfig.value.height,
      imageMargin: baseImageConfig.value.margin,
      imagePadding: baseImageConfig.value.padding,
      importedCharacterSet: splitGraphemes(importedCharacterSet.value),
      appendedCharacterCount: c3AppendedEntries.value.length,
    };
  }

  /**
   * 只读 seam：从当前 store 状态组装 source，执行 alpha 自检、像素读取、
   * analyze 与 repack，一次性产出精简候选。不修改任何状态/持久化。
   */
  function prepareC3Compaction(): C3CompactionPreparationResult {
    if (!isC3Mode.value || !c3ImportedImage.value || !c3InstanceArray.value) {
      return { kind: "error", code: "invalid-grid" };
    }
    if (!verifyCanvasAlphaRoundTrip()) {
      return { kind: "error", code: "alpha-roundtrip-failed" };
    }
    const source = buildCompactionSource();
    if (!source) {
      return { kind: "error", code: "invalid-grid" };
    }
    // 进入像素分析前先校验 imported spacing（fail closed，不静默降级）
    const spacingMigration = migrateC3SpacingData(
      importedSpacingData.value,
      source.characterWidth,
    );
    if (spacingMigration.kind === "error") {
      return { kind: "error", code: spacingMigration.code };
    }
    const imageData = imageToImageData(c3ImportedImage.value);
    if (!imageData) {
      return { kind: "error", code: "unreliable-canvas" };
    }
    const analysis = analyzeC3SpriteCompaction(imageData, source);
    if (analysis.kind !== "plan") {
      return analysis;
    }
    const repack = repackC3ImportedCells(imageData, analysis, source);
    if (repack.kind !== "ok") {
      return repack;
    }
    const grid = computeOldGrid(imageData, source);
    if (!grid) {
      return { kind: "error", code: "invalid-grid" };
    }
    return {
      kind: "plan",
      plan: analysis,
      repacked: repack.image,
      source,
      oldGrid: {
        originX: source.imageMargin.left + source.imagePadding.left,
        originY: source.imageMargin.top + source.imagePadding.top,
        columns: grid.columns,
      },
    };
  }

  // 校验 apply 输入与当前 store 状态一致（fail closed）。
  // 不重新做像素分析/重排（那是 Task-1 已验收核心的职责），
  // 只确保 repacked 数据、plan 与当前 store 组装出的 source 一致。
  function validateCompactionApplyInputs(
    plan: C3CompactionPlan,
    repacked: ImageData,
    source: C3CompactionSource,
  ): C3CompactionErrorCode | null {
    if (
      !repacked ||
      repacked.width <= 0 ||
      repacked.height <= 0 ||
      repacked.data.length !== repacked.width * repacked.height * 4
    ) {
      return "unreliable-canvas";
    }
    if (
      repacked.width !== plan.newImageWidth ||
      repacked.height !== plan.newImageHeight
    ) {
      return "invalid-output-dimensions";
    }
    if (plan.importedCount !== source.importedCharacterSet.length) {
      return "invalid-output-dimensions";
    }
    if (plan.newImageWidth !== source.fontSpriteWidth) {
      return "invalid-output-dimensions";
    }
    const newColumns = plan.newColumns;
    if (
      newColumns < 1 ||
      plan.newCharacterWidth <= 0 ||
      plan.newCharacterHeight <= 0
    ) {
      return "invalid-output-dimensions";
    }
    // newColumns = floor(fontSpriteWidth / newCharacterWidth)（newImageWidth 保持 fontSpriteWidth）
    if (plan.newColumns !== Math.floor(plan.newImageWidth / plan.newCharacterWidth)) {
      return "invalid-output-dimensions";
    }
    // newImageHeight = ceil(importedCount / newColumns) × newCharacterHeight
    const rows = Math.ceil(plan.importedCount / plan.newColumns);
    if (
      plan.newImageHeight % rows !== 0 ||
      plan.newCharacterHeight !== plan.newImageHeight / rows
    ) {
      return "invalid-output-dimensions";
    }
    // plan 必须与当前 store 的 cell 配置一致（防御 store 状态与 plan 期不一致）：
    // crop 等式校验可发现 plan 生成后配置被改动的情况
    if (
      plan.newCharacterWidth !==
        source.characterWidth - plan.crop.left - plan.crop.right ||
      plan.newCharacterHeight !==
        source.characterHeight - plan.crop.top - plan.crop.bottom
    ) {
      return "invalid-output-dimensions";
    }
    // 新 cell 必须至少有一边严格小于旧 cell（允许仅单边有收益的精简）
    if (
      plan.newCharacterWidth >= source.characterWidth &&
      plan.newCharacterHeight >= source.characterHeight
    ) {
      return "invalid-output-dimensions";
    }
    // 最终组合纹理高度（导入 + 追加）不能小于导入图片高度
    if (plan.newFinalTextureHeight < plan.newImageHeight) {
      return "invalid-output-dimensions";
    }
    return null;
  }

  /**
   * 原子应用 C3 精简方案（issue #9 seam）。
   *
   * 事务边界：在修改任何 Pinia refs 之前完成全部校验与候选构造——
   * verifyCanvasAlphaRoundTrip、plan/repacked 校验、spacing 迁移、
   * PNG 无损编码、重新解码为可加载图片、候选持久化 stage + 指针 commit。
   * 指针提交成功后同步替换 refs（不可失败），旧 generation 尽力清理。
   * 任何失败：内存与持久化原状态均保持不变，返回 typed fail-closed 错误。
   */
  async function applyC3SpriteCompaction(
    plan: C3CompactionPlan,
    repacked: ImageData,
  ): Promise<C3CompactionApplyResult> {
    if (!isC3Mode.value || !c3InstanceArray.value || !c3ImportedImage.value) {
      return { ok: false, code: "invalid-grid" };
    }

    if (!verifyCanvasAlphaRoundTrip()) {
      return { ok: false, code: "alpha-roundtrip-failed" };
    }

    const source = buildCompactionSource();
    if (!source) {
      return { ok: false, code: "invalid-grid" };
    }
    const oldCharacterWidth = source.characterWidth;

    const validationError = validateCompactionApplyInputs(plan, repacked, source);
    if (validationError) {
      return { ok: false, code: validationError };
    }

    // spacing 迁移：只删除等于旧 characterWidth 的冗余项，其余原样保留
    const migrated = migrateC3SpacingData(
      importedSpacingData.value,
      oldCharacterWidth,
    );
    if (migrated.kind === "error") {
      return { ok: false, code: migrated.code };
    }
    const cleanedSpacing = migrated.spacingData;

    // 按源格式编码（webp 保留，其余无损 png）+ 重新解码（可注入 seam）
    const targetMimeType = resolveAlphaSafeImageMimeType(
      baseImageMimeType.value,
    );
    const repackedBlob = await encodeC3RepackedImage(
      repacked,
      targetMimeType,
    );
    if (!repackedBlob) {
      return { ok: false, code: "unreliable-canvas" };
    }
    const decodedImage = await decodeC3PngBlob(repackedBlob);
    if (!decodedImage) {
      return { ok: false, code: "unreliable-canvas" };
    }

    // 构造完整候选（新导入基线，全部字段就绪后才触碰持久化与 refs）
    const newInstanceArray = [
      ...c3InstanceArray.value,
    ] as unknown as C3InstanceArray;
    newInstanceArray[2] = plan.newCharacterWidth;
    newInstanceArray[3] = plan.newCharacterHeight;
    newInstanceArray[4] = importedCharacterSet.value;
    newInstanceArray[5] = cleanedSpacing;

    const newCellConfig: BaseCellConfig = {
      width: plan.newCharacterWidth,
      height: plan.newCharacterHeight,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { ...baseCellConfig.value.padding },
    };

    const newImageConfig: BaseImageConfig = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      fontSpriteWidth: source.fontSpriteWidth,
      fontSpriteHeight: plan.newFinalTextureHeight,
    };

    // cell 尺寸与像素布局已变：用 repacked + 新配置/清理后 spacing 纯计算
    // 新基线水平度量（不触碰任何 ref，保持 fail-closed），追加条目随之重算。
    // 结果注入下方 stage 的 c3Config，使提交的唯一 generation 即最终基线，
    // 避免提交后再异步补写第二个 generation（issue #21）
    const nextGlyphMetrics = measureC3GlyphMetricsFromImage(
      repacked,
      newCellConfig,
      newImageConfig,
      cleanedSpacing,
    );
    const nextAppendedEntries = c3AppendedEntries.value.map((entry) => {
      if (entry.autoGlyphWidth === undefined) {
        return entry;
      }
      return {
        ...entry,
        autoBearingOffset: computeBearingOffset(
          nextGlyphMetrics,
          newCellConfig.padding.left,
        ),
        autoDisplayWidth: computeAppendedAdvance(
          entry.autoGlyphWidth,
          nextGlyphMetrics,
          newCellConfig.padding.left,
        ),
      };
    });

    // 候选持久化：stage 全部成功后 commit 指针（唯一提交点），
    // 与其它 generation 提交串行；commit 成功后仅做 best-effort 清理
    const stagedId = await runExclusiveC3Commit(async () => {
      const id = await C3GenerationStorage.stage({
        generalState: {
          ...buildGeneralState(),
          baseCellConfig: newCellConfig,
          baseImageConfig: newImageConfig,
          baseImageMimeType: targetMimeType,
        },
        c3Config: {
          ...buildC3Config(),
          instanceArrayJson: JSON.stringify(newInstanceArray),
          importedSpacingData: cleanedSpacing,
          appendedEntries: nextAppendedEntries,
          originalImageWidth: repacked.width,
          originalImageHeight: repacked.height,
        },
        image: {
          blob: repackedBlob,
          width: repacked.width,
          height: repacked.height,
        },
      });
      try {
        C3GenerationStorage.commit(id);
      } catch (error) {
        await C3GenerationStorage.discard(id);
        throw error;
      }
      try {
        C3GenerationStorage.prune();
      } catch (error) {
        console.error("[Editor] Failed to prune stale generations:", error);
      }
      return id;
    }).catch((error) => {
      console.error("[Editor] Failed to persist compaction generation:", error);
      return null;
    });

    if (!stagedId) {
      return { ok: false, code: "persistence-failed" };
    }

    // 提交成功：同步替换 refs（不可失败的整体替换）
    c3InstanceArray.value = newInstanceArray;
    importedSpacingData.value = cleanedSpacing;
    baseCellConfig.value = newCellConfig;
    baseImageConfig.value = newImageConfig;
    c3ImportedImage.value = decodedImage;
    baseImage.value = decodedImage;
    originalImageWidth.value = repacked.width;
    originalImageHeight.value = repacked.height;
    baseImageMimeType.value = targetMimeType;
    // 提交前已实测的度量与重算条目一并生效（单 generation，无需再补写）
    c3ImportedGlyphMetrics.value = nextGlyphMetrics;
    c3AppendedEntries.value = nextAppendedEntries;

    // 清除瞬时选择态，刷新画布尺寸并触发一次重绘
    selectedCharIndex.value = null;
    refreshCanvasSize();
    renderTrigger.value++;

    return { ok: true, plan };
  }

  /**
   * 只读 seam：从当前 store 状态组装 source，执行 alpha 自检、像素读取、
   * 重排方案计算与像素重排，一次性产出重排候选。不修改任何状态/持久化。
   * options.outputHeight 可自定义输出高度（≥ 密铺、≤ C3_MAX_TEXTURE_SIZE，
   * 余量行保持透明）；缺省为精确密铺。
   */
  function prepareC3Rewrap(
    targetWidth: number,
    options?: C3RewrapOptions,
  ): C3RewrapPreparationResult {
    if (!isC3Mode.value || !c3ImportedImage.value || !c3InstanceArray.value) {
      return { kind: "error", code: "invalid-grid" };
    }
    if (!verifyCanvasAlphaRoundTrip()) {
      return { kind: "error", code: "alpha-roundtrip-failed" };
    }
    const source = buildCompactionSource();
    if (!source) {
      return { kind: "error", code: "invalid-grid" };
    }
    const imageData = imageToImageData(c3ImportedImage.value);
    if (!imageData) {
      return { kind: "error", code: "unreliable-canvas" };
    }
    const planResult = computeC3RewrapPlan(imageData, source, targetWidth);
    if (planResult.kind !== "plan") {
      return planResult;
    }
    const repack = rewrapC3ImportedCells(imageData, planResult, source, options);
    if (repack.kind !== "ok") {
      return repack;
    }
    return {
      kind: "plan",
      plan: planResult,
      repacked: repack.image,
      source,
    };
  }

  // 当前 store 尺寸下的旧网格列数（computeOldGrid 同一映射；apply 校验不读像素）
  function computeCurrentOldColumns(source: C3CompactionSource): number | null {
    const dims = {
      width: originalImageWidth.value,
      height: originalImageHeight.value,
    } as ImageData;
    return computeOldGrid(dims, source)?.columns ?? null;
  }

  // 校验 apply 输入与当前 store 状态一致（fail closed）。
  // 不重新做像素分析/重排（那是核心算法的职责），
  // 只确保 repacked 数据、plan 与当前 store 组装出的 source / 旧网格一致。
  //
  // 已知可接受边界（TOCTOU）：plan 按 #17 设计不携带 cell 尺寸（重排永不改
  // cell），cell 尺寸靠算术等式间接钉住；prepare/apply 之间若 fontSpriteWidth
  // 与 characterWidth 被同比例改动且列数不变，等式仍可通过，而 repacked 像素
  // 按旧 cell 切分。该场景在弹窗阻塞编辑期间不可达，且与精简 apply 的同类
  // 边界（prepare 后重导入同网格图片）对齐，故不另设阻断校验。
  function validateRewrapApplyInputs(
    plan: C3RewrapPlan,
    repacked: ImageData,
    source: C3CompactionSource,
  ): C3RewrapApplyErrorCode | null {
    if (
      !repacked ||
      repacked.width <= 0 ||
      repacked.height <= 0 ||
      repacked.data.length !== repacked.width * repacked.height * 4
    ) {
      return "unreliable-canvas";
    }
    // 输出宽度必须精确等于目标宽度；高度不小于方案密铺高度即可——
    // 自定义加高的余量行保持透明（fontSpriteHeight = repacked.height）
    if (
      repacked.width !== plan.targetWidth ||
      repacked.height < plan.newImageHeight ||
      repacked.height > C3_MAX_TEXTURE_SIZE
    ) {
      return "invalid-output-dimensions";
    }
    if (plan.importedCount !== source.importedCharacterSet.length) {
      return "invalid-output-dimensions";
    }
    // targetWidth 合法，且 plan 与 source 的网格等式一致（cell 尺寸未变）：
    // 行数按导入 + 追加的总字符数计，追加字符按新布局重渲染
    const totalCharacterCount =
      plan.importedCount + source.appendedCharacterCount;
    if (
      !Number.isInteger(plan.targetWidth) ||
      plan.targetWidth < source.characterWidth ||
      plan.newColumns !==
        Math.floor(plan.targetWidth / source.characterWidth) ||
      plan.newRows !== Math.ceil(totalCharacterCount / plan.newColumns) ||
      plan.newImageHeight !== plan.newRows * source.characterHeight
    ) {
      return "invalid-output-dimensions";
    }
    // plan 必须基于与当前一致的旧网格（防 plan 生成后配置被改动）
    const oldColumns = computeCurrentOldColumns(source);
    if (oldColumns === null || plan.oldColumns !== oldColumns) {
      return "invalid-grid";
    }
    // 同列数 = 布局无变化，不允许应用（非阻断地位与精简 no-savings 相同）
    if (plan.newColumns === plan.oldColumns) {
      return "no-layout-change";
    }
    return null;
  }

  /**
   * 原子应用 C3 重排方案（issue #18 seam）。
   *
   * 事务边界：在修改任何 Pinia refs 之前完成全部校验与候选构造——
   * verifyCanvasAlphaRoundTrip、plan/repacked 校验、PNG 无损编码、
   * 重新解码为可加载图片、候选持久化 stage + 指针 commit。
   * 指针提交成功后同步替换 refs（不可失败），旧 generation 尽力清理。
   * 任何失败：内存与持久化原状态均保持不变，返回 typed fail-closed 错误。
   * 重排不改 cell 尺寸：c3-instance、spacingData、baseCellConfig 逐字节不变。
   * 追加字符条目保留（不重测字形），按 canvasSpace 新列数自动落位重渲染；
   * issue #21：仅重实测导入水平度量（像素与 cell 不变 → 度量一致 → 条目值
   * 不变），带新字段条目的 autoBearingOffset/autoDisplayWidth 随之重算并随
   * 本次提交持久化。
   */
  async function applyC3SpriteRewrap(
    plan: C3RewrapPlan,
    repacked: ImageData,
  ): Promise<C3RewrapApplyResult> {
    if (!isC3Mode.value || !c3InstanceArray.value || !c3ImportedImage.value) {
      return { ok: false, code: "invalid-grid" };
    }

    if (!verifyCanvasAlphaRoundTrip()) {
      return { ok: false, code: "alpha-roundtrip-failed" };
    }

    const source = buildCompactionSource();
    if (!source) {
      return { ok: false, code: "invalid-grid" };
    }

    const validationError = validateRewrapApplyInputs(plan, repacked, source);
    if (validationError) {
      return { ok: false, code: validationError };
    }

    // 按源格式编码（webp 保留，其余无损 png）+ 重新解码（seam）
    const targetMimeType = resolveAlphaSafeImageMimeType(
      baseImageMimeType.value,
    );
    const repackedBlob = await encodeC3RepackedImage(
      repacked,
      targetMimeType,
    );
    if (!repackedBlob) {
      return { ok: false, code: "unreliable-canvas" };
    }
    const decodedImage = await decodeC3PngBlob(repackedBlob);
    if (!decodedImage) {
      return { ok: false, code: "unreliable-canvas" };
    }

    // 构造完整候选：image margin/padding 归零，Font Sprite 尺寸 =
    // 目标宽度 × repacked 实际高度（含追加字符密铺高度或自定义加高余量）；cell 配置保持
    const newImageConfig: BaseImageConfig = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      fontSpriteWidth: plan.targetWidth,
      fontSpriteHeight: repacked.height,
    };

    // 重排不改 cell 尺寸与像素内容：用 repacked + 新 imageConfig + 不变 cell
    // 纯计算重实测水平度量（不触碰任何 ref，保持 fail-closed；metrics 一致时
    // 条目值不变，deep-equal 不变量），结果注入 stage 的 c3Config——提交的
    // 唯一 generation 即最终基线，避免事后再异步补写（issue #21）
    const nextGlyphMetrics = measureC3GlyphMetricsFromImage(
      repacked,
      baseCellConfig.value,
      newImageConfig,
      importedSpacingData.value,
    );
    const nextAppendedEntries = c3AppendedEntries.value.map((entry) => {
      if (entry.autoGlyphWidth === undefined) {
        return entry;
      }
      return {
        ...entry,
        autoBearingOffset: computeBearingOffset(
          nextGlyphMetrics,
          baseCellConfig.value.padding.left,
        ),
        autoDisplayWidth: computeAppendedAdvance(
          entry.autoGlyphWidth,
          nextGlyphMetrics,
          baseCellConfig.value.padding.left,
        ),
      };
    });

    // 候选持久化：stage 全部成功后 commit 指针（唯一提交点），
    // 与其它 generation 提交串行；commit 成功后仅做 best-effort 清理
    const stagedId = await runExclusiveC3Commit(async () => {
      const id = await C3GenerationStorage.stage({
        generalState: {
          ...buildGeneralState(),
          baseImageConfig: newImageConfig,
          baseImageMimeType: targetMimeType,
        },
        c3Config: {
          ...buildC3Config(),
          appendedEntries: nextAppendedEntries,
          originalImageWidth: repacked.width,
          originalImageHeight: repacked.height,
        },
        image: {
          blob: repackedBlob,
          width: repacked.width,
          height: repacked.height,
        },
      });
      try {
        C3GenerationStorage.commit(id);
      } catch (error) {
        await C3GenerationStorage.discard(id);
        throw error;
      }
      try {
        C3GenerationStorage.prune();
      } catch (error) {
        console.error("[Editor] Failed to prune stale generations:", error);
      }
      return id;
    }).catch((error) => {
      console.error("[Editor] Failed to persist rewrap generation:", error);
      return null;
    });

    if (!stagedId) {
      return { ok: false, code: "persistence-failed" };
    }

    // 提交成功：同步替换 refs（不可失败的整体替换）
    baseImageConfig.value = newImageConfig;
    c3ImportedImage.value = decodedImage;
    baseImage.value = decodedImage;
    originalImageWidth.value = repacked.width;
    originalImageHeight.value = repacked.height;
    baseImageMimeType.value = targetMimeType;
    // 提交前已实测的度量与重算条目一并生效（单 generation，无需再补写）
    c3ImportedGlyphMetrics.value = nextGlyphMetrics;
    c3AppendedEntries.value = nextAppendedEntries;

    // 清除瞬时选择态，刷新画布尺寸并触发一次重绘
    selectedCharIndex.value = null;
    refreshCanvasSize();
    renderTrigger.value++;

    return { ok: true, plan };
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

  // 切换 C3 追加字符垂直分布方式时，重新计算自动分布偏移
  watch(
    () => c3AppendedVerticalAlignment.value,
    () => {
      applyC3AppendedVerticalDistribution();
      saveToLocalStorage();
      renderTrigger.value++;
    },
  );

  // 字体或样式变化时，重新计算追加字符的可见高度并重新对齐
  watch(
    () => currentFont.value,
    () => {
      if (isC3Mode.value && c3AppendedEntries.value.length > 0) {
        recalculateC3AppendedVerticalMetrics();
        applyC3AppendedVerticalDistribution();
      }
    },
  );

  function onC3StyleChanged() {
    if (isC3Mode.value && c3AppendedEntries.value.length > 0) {
      recalculateC3AppendedVerticalMetrics();
      applyC3AppendedVerticalDistribution();
    }
  }

  watch(() => characterStyle.value.fontFamily, onC3StyleChanged);
  watch(() => characterStyle.value.fontSize, onC3StyleChanged);
  watch(() => characterStyle.value.color, onC3StyleChanged);
  watch(() => characterStyle.value.outline.enabled, onC3StyleChanged);
  watch(() => characterStyle.value.outline.color, onC3StyleChanged);
  watch(() => characterStyle.value.outline.width, onC3StyleChanged);
  watch(() => characterStyle.value.pixelStyle, onC3StyleChanged);

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
    canvasBaseWidth,
    canvasBaseHeight,
    effectiveSpriteWidth,
    effectiveSpriteHeight,
    maxCanvasWidth,
    maxCanvasHeight,
    currentFont,
    baseImageFilename,
    baseImageMimeType,
    fontFilename,
    projectDirectoryHandle,
    gridConfig,
    canvasBg,
    canvasViewMode,
    zoomPercentage,
    hasProjectData,
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
    c3GlobalExtraSpacing,
    c3AppendedVerticalAlignment,
    c3AppendedEntries,
    c3ImportedGlyphMetrics,
    c3EffectiveCharacterSet,
    c3EffectiveSpacingData,
    c3ExportInstanceArray,
    // actions
    setBaseImage,
    refreshCanvasSize,
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
    updateC3AppendedExtraSpacing,
    clearC3AppendedCharacters,
    setC3GlobalExtraSpacing,
    setC3AppendedVerticalAlignment,
    autoFitC3FontSpriteSize,
    getEffectiveCharMargin,
    recalculateC3AppendedDisplayWidths,
    recalculateC3AppendedVerticalMetrics,
    applyC3AppendedVerticalDistribution,
    saveToLocalStorage,
    loadFromLocalStorage,
    restoreAssets,
    clearState,
    clearAllData,
    detectInsertPoints,
    autoDetectGrid,
    applyProject,
    applyC3SpriteCompaction,
    prepareC3Compaction,
    applyC3SpriteRewrap,
    prepareC3Rewrap,
    // canvas ref
    canvasLayer,
  };
});
