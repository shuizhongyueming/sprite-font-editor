/**
 * i18n 国际化模块
 * 支持中文和英文，便于扩展其他语言
 */

import { ref, computed } from "vue";

export type Locale = "zh-CN" | "en-US";

export interface Translations {
  // Toolbar
  uploadImage: string;
  uploadFont: string;
  exportPNG: string;
  insertPoint: string;
  autoMode: string;
  manualMode: string;
  clearAll: string;
  canvasBackground: string;
  bgWhite: string;
  bgBlack: string;
  bgCheckerboard: string;

  // ImageConfig
  fontSpriteSize: string;
  imageMargin: string;
  imagePadding: string;

  // CellConfig
  cellSize: string;
  cellMargin: string;
  cellPadding: string;
  alignment: string;
  horizontal: string;
  vertical: string;
  leftAlign: string;
  centerAlign: string;
  rightAlign: string;
  topAlign: string;
  middleAlign: string;
  bottomAlign: string;
  gridDisplay: string;
  gridLines: string;
  cellBorder: string;
  marginLine: string;
  paddingLine: string;
  borderColor: string;
  borderWidth: string;
  autoDetect: string;
  manualSelect: string;

  // CharStyle
  font: string;
  fontSize: string;
  textColor: string;
  enableOutline: string;
  outlineColor: string;
  outlineWidth: string;
  fontNotLoaded: string;
  fontLoaded: string;

  // CharacterInput
  inputText: string;
  inputTextPlaceholder: string;
  charCount: string;
  clear: string;
  renderText: string;
  editMargin: string;
  marginLabel: string;
  confirm: string;

  // InsertPointInfo
  currentMode: string;
  highlightedCell: string;
  gridSize: string;
  nextEmptyCell: string;
  notFound: string;
  detecting: string;
  detectionThreshold: string;
  detectionStatus: string;
  disabled: string;
  foundCount: string;

  // Additional
  row: string;
  col: string;
  rows: string;
  cols: string;
  index: string;
  clickToHighlight: string;

  // Control Panel
  imageSettings: string;
  gridSettings: string;
  charStyle: string;
  charInput: string;
  insertPointInfo: string;

  // Language Switcher
  switchLanguage: string;

  // Auto Detect Grid
  autoDetectGrid: string;
  noImageLoaded: string;
  canvasNotReady: string;
  gridDetectionFailed: string;
  gridDetectionSuccess: string;

  // Notifications
  invalidImageFile: string;
  invalidFontFile: string;
  imageLoadFailed: string;
  fontLoadSuccess: string;
  fontLoadFailed: string;
  pleaseUploadImage: string;
  exportSuccess: string;
  exportFailed: string;
  renderComplete: string;
  cleared: string;
  confirmClear: string;

  // DimensionsInput
  width: string;
  height: string;

  // Common
  ok: string;
  cancel: string;
  N_A: string;
}

export const translations: Record<Locale, Translations> = {
  "zh-CN": {
    // Toolbar
    uploadImage: "上传图片",
    uploadFont: "上传字体",
    exportPNG: "导出PNG",
    insertPoint: "插入点:",
    autoMode: "自动",
    manualMode: "手动",
    clearAll: "清空",
    canvasBackground: "画布背景",
    bgWhite: "白色",
    bgBlack: "黑色",
    bgCheckerboard: "棋盘",

    // ImageConfig
    fontSpriteSize: "Font Sprite 尺寸",
    imageMargin: "外边距 (margin)",
    imagePadding: "内边距 (padding)",

    // CellConfig
    cellSize: "单元格尺寸",
    cellMargin: "单元格间距 (margin)",
    cellPadding: "字符内边距 (padding)",
    alignment: "对齐方式",
    horizontal: "水平:",
    vertical: "垂直:",
    leftAlign: "左对齐",
    centerAlign: "居中",
    rightAlign: "右对齐",
    topAlign: "顶部",
    middleAlign: "居中",
    bottomAlign: "底部",
    gridDisplay: "网格显示",
    gridLines: "网格线",
    cellBorder: "边框",
    marginLine: "margin",
    paddingLine: "padding",
    borderColor: "边框颜色",
    borderWidth: "宽度",
    autoDetect: "自动检测",
    manualSelect: "手动选择",

    // CharStyle
    font: "字体",
    fontSize: "字体大小",
    textColor: "文字颜色",
    enableOutline: "启用描边",
    outlineColor: "描边颜色",
    outlineWidth: "描边宽度",
    fontNotLoaded: "未加载",
    fontLoaded: "已加载",

    // CharacterInput
    inputText: "输入文字",
    inputTextPlaceholder: "请输入要渲染的文字...",
    charCount: "共 {count} 个字符",
    clear: "清空",
    renderText: "渲染文字",
    editMargin: "编辑边距:",
    marginLabel: "边距",
    confirm: "确定",

    // InsertPointInfo
    currentMode: "当前模式:",
    highlightedCell: "高亮单元格:",
    gridSize: "网格尺寸:",
    nextEmptyCell: "下一个空单元格:",
    notFound: "未找到",
    detecting: "检测中...",
    detectionThreshold: "检测阈值:",
    detectionStatus: "检测状态:",
    disabled: "已禁用",
    foundCount: "已找到 {count} 个",

    // Additional
    row: "第",
    col: "列",
    rows: "行",
    cols: "列",
    index: "索引",
    clickToHighlight: "点击高亮字符",

    // Control Panel
    imageSettings: "图片设置",
    gridSettings: "网格设置",
    charStyle: "字符样式",
    charInput: "字符输入",
    insertPointInfo: "插入点信息",

    // Language Switcher
    switchLanguage: "切换语言",

    // Auto Detect Grid
    autoDetectGrid: "自动划分网格",
    noImageLoaded: "请先上传图片",
    canvasNotReady: "画布未就绪",
    gridDetectionFailed: "无法自动检测网格，请手动调整",
    gridDetectionSuccess:
      "网格检测成功！尺寸: {width}x{height}，网格: {rows}行×{cols}列",

    // Notifications
    invalidImageFile: "请选择有效的图片文件 (PNG, JPG, GIF, WebP)",
    invalidFontFile: "请选择有效的字体文件 (TTF, OTF, WOFF)",
    imageLoadFailed: "图片加载失败",
    fontLoadSuccess: "字体上传成功！",
    fontLoadFailed: "字体加载失败",
    pleaseUploadImage: "请先上传图片",
    exportSuccess: "图片导出成功！",
    exportFailed: "导出失败，请重试",
    renderComplete: "字符渲染完成",
    cleared: "已清空所有内容",
    confirmClear: "确定要清空所有内容吗？",

    // DimensionsInput
    width: "宽度",
    height: "高度",

    // Common
    ok: "确定",
    cancel: "取消",
    N_A: "N/A",
  },
  "en-US": {
    // Toolbar
    uploadImage: "Upload Image",
    uploadFont: "Upload Font",
    exportPNG: "Export PNG",
    insertPoint: "Insert Point:",
    autoMode: "Auto",
    manualMode: "Manual",
    clearAll: "Clear All",
    canvasBackground: "Canvas Background",
    bgWhite: "White",
    bgBlack: "Black",
    bgCheckerboard: "Checkerboard",

    // ImageConfig
    fontSpriteSize: "Font Sprite Size",
    imageMargin: "Margin",
    imagePadding: "Padding",

    // CellConfig
    cellSize: "Cell Size",
    cellMargin: "Cell Margin",
    cellPadding: "Character Padding",
    alignment: "Alignment",
    horizontal: "Horizontal:",
    vertical: "Vertical:",
    leftAlign: "Left",
    centerAlign: "Center",
    rightAlign: "Right",
    topAlign: "Top",
    middleAlign: "Middle",
    bottomAlign: "Bottom",
    gridDisplay: "Grid Display",
    gridLines: "Grid Lines",
    cellBorder: "Border",
    marginLine: "Margin",
    paddingLine: "Padding",
    borderColor: "Color",
    borderWidth: "Width",
    autoDetect: "Auto Detect",
    manualSelect: "Manual Select",

    // CharStyle
    font: "Font",
    fontSize: "Font Size",
    textColor: "Text Color",
    enableOutline: "Enable Outline",
    outlineColor: "Outline Color",
    outlineWidth: "Outline Width",
    fontNotLoaded: "Not Loaded",
    fontLoaded: "Loaded",

    // CharacterInput
    inputText: "Input Text",
    inputTextPlaceholder: "Enter text to render...",
    charCount: "{count} characters",
    clear: "Clear",
    renderText: "Render Text",
    editMargin: "Edit Margin:",
    marginLabel: "Margin",
    confirm: "OK",

    // InsertPointInfo
    currentMode: "Current Mode:",
    highlightedCell: "Highlighted Cell:",
    gridSize: "Grid Size:",
    nextEmptyCell: "Next Empty Cell:",
    notFound: "Not Found",
    detecting: "Detecting...",
    detectionThreshold: "Detection Threshold:",
    detectionStatus: "Detection Status:",
    disabled: "Disabled",
    foundCount: "Found {count}",

    // Additional
    row: "Row",
    col: "Col",
    rows: "rows",
    cols: "cols",
    index: "Index",
    clickToHighlight: "Click to highlight character",

    // Control Panel
    imageSettings: "Image Settings",
    gridSettings: "Grid Settings",
    charStyle: "Character Style",
    charInput: "Character Input",
    insertPointInfo: "Insert Point Info",

    // Language Switcher
    switchLanguage: "Switch Language",

    // Auto Detect Grid
    autoDetectGrid: "Auto Detect Grid",
    noImageLoaded: "Please upload an image first",
    canvasNotReady: "Canvas not ready",
    gridDetectionFailed:
      "Cannot detect grid automatically, please adjust manually",
    gridDetectionSuccess:
      "Grid detected! Size: {width}x{height}, Grid: {rows}×{cols}",

    // Notifications
    invalidImageFile: "Please select a valid image file (PNG, JPG, GIF, WebP)",
    invalidFontFile: "Please select a valid font file (TTF, OTF, WOFF)",
    imageLoadFailed: "Failed to load image",
    fontLoadSuccess: "Font uploaded successfully!",
    fontLoadFailed: "Failed to load font",
    pleaseUploadImage: "Please upload an image first",
    exportSuccess: "Image exported successfully!",
    exportFailed: "Export failed, please try again",
    renderComplete: "Character rendering complete",
    cleared: "All content cleared",
    confirmClear: "Are you sure you want to clear all content?",

    // DimensionsInput
    width: "Width",
    height: "Height",

    // Common
    ok: "OK",
    cancel: "Cancel",
    N_A: "N/A",
  },
};

// 响应式语言状态
const localeState = ref<Locale>("en-US");

/**
 * 获取当前语言设置
 */
export function getLocale(): Locale {
  return localeState.value;
}

/**
 * 设置当前语言
 */
export function setLocale(locale: Locale): void {
  localeState.value = locale;
  document.documentElement.lang = locale;
}

/**
 * 当前语言是否为中文
 */
export const isChinese = computed(() => localeState.value === "zh-CN");

/**
 * 翻译函数
 * 支持带参数的翻译，如 t('charCount', { count: 5 }) 替换 {count} 占位符
 */
export function t<K extends keyof Translations>(
  key: K,
  params?: Record<string, string | number>,
): string {
  let text = translations[localeState.value][key];

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
  }

  return text;
}

/**
 * 获取浏览器推荐语言
 */
export function getBrowserLocale(): Locale {
  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }
  return "en-US";
}

/**
 * 初始化语言设置
 * 从 localStorage 恢复或使用浏览器推荐语言
 */
export function initLocale(): Locale {
  const stored = localStorage.getItem("locale") as Locale | null;

  if (stored && (stored === "zh-CN" || stored === "en-US")) {
    setLocale(stored);
    return stored;
  }

  const browserLocale = getBrowserLocale();
  setLocale(browserLocale);
  return browserLocale;
}

/**
 * 切换语言并保存
 */
export function toggleLocale(): void {
  const newLocale = localeState.value === "zh-CN" ? "en-US" : "zh-CN";
  setLocale(newLocale);
  localStorage.setItem("locale", newLocale);
}

/**
 * 设置语言并保存
 */
export function setLanguage(locale: Locale): void {
  setLocale(locale);
  localStorage.setItem("locale", locale);
}
