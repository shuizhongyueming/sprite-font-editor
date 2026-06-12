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
  pixelStyle: string;

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

  // Canvas View Mode
  viewFitToView: string;
  viewActualSize: string;
  viewZoom: string;
  spacePanHint: string;

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

  // C3 Sprite Font
  importC3SpriteFont: string;
  c3ImportTitle: string;
  c3ImportImage: string;
  c3ImportArray: string;
  c3Validate: string;
  c3Import: string;
  c3ImportSuccess: string;
  c3ImportError: string;
  c3ReimportConfirm: string;
  c3ModeActive: string;
  c3ImportedCount: string;
  c3AppendedCount: string;
  c3CellConfigLocked: string;
  c3FontSpriteSize: string;
  c3FontSpriteWidth: string;
  c3FontSpriteHeight: string;
  c3ImageTooSmallError: string;
  c3ParseSuccess: string;
  c3StorageVersionMismatch: string;
  c3AppendPlaceholder: string;
  c3DuplicateChars: string;
  c3SpaceNotAllowed: string;
  c3DisplayWidth: string;
  c3ResetAuto: string;
  c3Preview: string;
  c3SampleText: string;
  c3ResetSampleText: string;
  c3ExportTitle: string;
  c3ExportCopy: string;
  c3ExportCopied: string;
  c3ExportSuccess: string;

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
    pixelStyle: "像素风",

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

    // Canvas View Mode
    viewFitToView: "适应窗口",
    viewActualSize: "1:1",
    viewZoom: "{percent}%",
    spacePanHint: "按住 Space 拖拽",

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

    // C3 Sprite Font
    importC3SpriteFont: "导入 C3 Sprite Font",
    c3ImportTitle: "导入 C3 Sprite Font",
    c3ImportImage: "选择图片",
    c3ImportArray: "C3 实例数组 JSON",
    c3Validate: "验证",
    c3Import: "导入",
    c3ImportSuccess: "C3 Sprite Font 导入成功！",
    c3ImportError: "导入失败：{message}",
    c3ReimportConfirm:
      "重新导入将覆盖当前 C3 项目和所有追加字符，是否继续？",
    c3ModeActive: "C3 模式",
    c3ImportedCount: "已导入字符：{count}",
    c3AppendedCount: "已追加字符：{count}",
    c3CellConfigLocked: "C3 模式下单元格边距和对齐方式已固定",
    c3FontSpriteSize: "Font Sprite 尺寸",
    c3FontSpriteWidth: "Font Sprite 宽度",
    c3FontSpriteHeight: "Font Sprite 高度",
    c3ImageTooSmallError:
      "图片只能容纳 {capacity} 个字符，当前字符集有 {count} 个，超出部分将被省略",
    c3ParseSuccess: "验证成功：{count} 个字符",
    c3StorageVersionMismatch: "C3 项目存储版本不匹配，请重新导入",
    c3AppendPlaceholder: "输入要追加的字符...",
    c3DuplicateChars: "以下字符已存在：{chars}",
    c3SpaceNotAllowed: "不能追加空格字符",
    c3DisplayWidth: "显示宽度",
    c3ResetAuto: "自动",
    c3Preview: "C3 预览",
    c3SampleText: "示例文本",
    c3ResetSampleText: "重置示例文本",
    c3ExportTitle: "导出 C3 Sprite Font",
    c3ExportCopy: "复制到剪贴板",
    c3ExportCopied: "已复制",
    c3ExportSuccess: "C3 Sprite Font 导出成功！",

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
    pixelStyle: "Pixel Style",

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

    // Canvas View Mode
    viewFitToView: "Fit to view",
    viewActualSize: "1:1",
    viewZoom: "{percent}%",
    spacePanHint: "Hold Space to pan",

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

    // C3 Sprite Font
    importC3SpriteFont: "Import C3 Sprite Font",
    c3ImportTitle: "Import C3 Sprite Font",
    c3ImportImage: "Select Image",
    c3ImportArray: "C3 Instance Array JSON",
    c3Validate: "Validate",
    c3Import: "Import",
    c3ImportSuccess: "C3 Sprite Font imported successfully!",
    c3ImportError: "Import failed: {message}",
    c3ReimportConfirm:
      "Re-importing will overwrite the current C3 project and any appended characters. Continue?",
    c3ModeActive: "C3 Mode",
    c3ImportedCount: "Imported characters: {count}",
    c3AppendedCount: "Appended characters: {count}",
    c3CellConfigLocked: "Cell margin and alignment are fixed in C3 mode",
    c3FontSpriteSize: "Font Sprite Size",
    c3FontSpriteWidth: "Font Sprite Width",
    c3FontSpriteHeight: "Font Sprite Height",
    c3ImageTooSmallError:
      "The image can only hold {capacity} characters, but the character set has {count}; excess characters will be omitted",
    c3ParseSuccess: "Validation successful: {count} characters",
    c3StorageVersionMismatch:
      "C3 project storage version mismatch, please re-import",
    c3AppendPlaceholder: "Enter characters to append...",
    c3DuplicateChars: "Characters already exist: {chars}",
    c3SpaceNotAllowed: "Space characters cannot be appended",
    c3DisplayWidth: "Display Width",
    c3ResetAuto: "Auto",
    c3Preview: "C3 Preview",
    c3SampleText: "Sample Text",
    c3ResetSampleText: "Reset Sample Text",
    c3ExportTitle: "Export C3 Sprite Font",
    c3ExportCopy: "Copy to Clipboard",
    c3ExportCopied: "Copied",
    c3ExportSuccess: "C3 Sprite Font exported successfully!",

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
