import { defineStore } from "pinia";
import { ref, computed } from "vue";

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
  });

  // 插入点配置
  const insertPointConfig = ref<InsertPointConfig>({
    mode: "auto",
    startCellIndex: 0,
  });

  // 字符输入
  const characterEntries = ref<CharacterEntry[]>([]);

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

  // 插入点检测结果
  const detectedInsertPoints = ref<number[]>([]);
  const currentInsertPoint = ref<number>(0);

  // 字符选择状态
  const selectedCharIndex = ref<number | null>(null);

  function setBaseImage(image: HTMLImageElement) {
    baseImage.value = image;
    originalImageWidth.value = image.width;
    originalImageHeight.value = image.height;

    // 计算缩放比例以适应最大尺寸限制
    let scale = 1;
    const widthRatio = maxCanvasWidth.value / image.width;
    const heightRatio = maxCanvasHeight.value / image.height;

    // 如果图片超过最大尺寸限制，则按比例缩放
    if (
      image.width > maxCanvasWidth.value ||
      image.height > maxCanvasHeight.value
    ) {
      scale = Math.min(widthRatio, heightRatio);
    }

    displayedCanvasWidth.value = Math.floor(image.width * scale);
    displayedCanvasHeight.value = Math.floor(image.height * scale);
  }

  // 设置字体
  function setFont(font: FontFace) {
    currentFont.value = font;
    characterStyle.value.fontFamily = font.family;
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

  // 检测插入点（基于透明度）
  function detectInsertPoints(canvas: HTMLCanvasElement) {
    console.log("[detectInsertPoints] 开始检测插入点...");

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

    console.log(
      `[detectInsertPoints] Canvas尺寸: ${canvas.width}x${canvas.height}`,
    );
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const emptyCells: number[] = [];

    // 使用计算后的绝对配置
    const currentCellConfig = cellConfig.value;
    const currentImageConfig = imageConfig.value;

    // 根据当前配置检测所有单元格
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

    const cols = Math.floor(
      (displayedCanvasWidth.value -
        currentImageConfig.padding.left -
        currentImageConfig.padding.right) /
        cellTotalWidth,
    );
    const rows = Math.floor(
      (displayedCanvasHeight.value -
        currentImageConfig.padding.top -
        currentImageConfig.padding.bottom) /
        cellTotalHeight,
    );

    console.log(`[detectInsertPoints] 网格配置: ${rows}行 × ${cols}列`);
    console.log(
      `[detectInsertPoints] 单元格大小: ${currentCellConfig.width}x${currentCellConfig.height}, 边距: ${JSON.stringify(currentCellConfig.margin)}`,
    );
    console.log(
      `[detectInsertPoints] 图片边距: ${JSON.stringify(currentImageConfig.margin)}, 内边距: ${JSON.stringify(currentImageConfig.padding)}`,
    );
    console.log(`[detectInsertPoints] 起始位置: (${startX}, ${startY})`);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX =
          startX + col * cellTotalWidth + currentCellConfig.margin.left;
        const cellY =
          startY + row * cellTotalHeight + currentCellConfig.margin.top;
        const cellWidth = currentCellConfig.width;
        const cellHeight = currentCellConfig.height;
        const index = row * cols + col;

        // 检查单元格是否为空（透明）
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

    console.log(
      `[detectInsertPoints] 检测完成！找到 ${emptyCells.length} 个空单元格: [${emptyCells.join(", ")}]`,
    );

    detectedInsertPoints.value = emptyCells;

    // 如果当前有插入点配置，确保它在检测到的列表中
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
    };
    localStorage.setItem("sprite-font-editor-state", JSON.stringify(state));
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
      } catch (error) {
        console.warn("Failed to load state from localStorage:", error);
      }
    }
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
    characterEntries.value = [];
    baseImage.value = null;
    currentFont.value = null;
    originalImageWidth.value = 0;
    originalImageHeight.value = 0;
    displayedCanvasWidth.value = 0;
    displayedCanvasHeight.value = 0;
    localStorage.removeItem("sprite-font-editor-state");
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
    maxCanvasWidth,
    maxCanvasHeight,
    currentFont,
    gridConfig,
    detectedInsertPoints,
    currentInsertPoint,
    // actions
    setBaseImage,
    setFont,
    setCanvas,
    updateCharacters,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearState,
    detectInsertPoints,
    // canvas ref
    canvasLayer,
  };
});
