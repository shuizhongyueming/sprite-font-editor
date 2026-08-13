# Canvas 透明像素读取与安全阈值

研究问题：浏览器从用户本地导入的透明 PNG 经 Canvas 2D `drawImage()` / `getImageData()` 读回后，alpha 是否会因抗指纹保护而被扰动；Font Sprite 精简应采用什么透明判定与失败策略。

## 结论

精简分析应**只读取 alpha，不读取 RGB，并把 `alpha === 0` 作为透明的唯一判据**。不要为了抗指纹保护使用 `alpha <= 1`、`<= 2` 等容差：已查到的 Firefox 与 Brave 实现只改变 RGB、明确避开 alpha；放宽 alpha 反而会把 PNG 中真实存在的低透明度抗锯齿像素当作留白，违背“不能误裁可见字形”的安全目标。

若将来实测某浏览器会改变 alpha，正确行为应是检测异常并阻止精简，而不是猜一个阈值继续裁剪。

## 证据

### 1. Web 与 PNG 的 alpha 契约

- HTML Standard 要求 `getImageData()` 返回指定矩形中 Canvas 输出位图的像素；越界区域必须是透明黑。若 Canvas 非 origin-clean，则必须抛出 `SecurityError`。默认 2D Canvas 有 alpha；只有显式使用 `{ alpha: false }` 时，每个像素的 alpha 才固定为 255。来源：[HTML Standard：Pixel manipulation](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation)、[HTML Standard：Canvas settings](https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-alpha)。
- `getImageData()` 会进行颜色空间转换，而 HTML Standard 将 alpha 与 RGB 分开定义；规范同时指出预乘/非预乘转换的有限精度损失发生在颜色表达转换上。对本功能而言，RGB 不能作为透明判据，alpha 才是语义信号。来源：[HTML Standard：`getImageData()` 算法](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-getimagedata)、[HTML Standard：Premultiplied alpha](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)。
- PNG 规范定义 alpha 取值 0 为完全透明、最大值为完全不透明，中间值为部分透明；alpha 是线性的，不应用 gamma 校正。因而任何 `alpha > 0` 都代表 PNG 作者保留的非零覆盖度，自动裁剪不能安全地称其为“留白”。来源：[PNG Specification (Third Edition)：Alpha representation](https://www.w3.org/TR/png-3/#11alpha-info)、[PNG Specification：Color spaces](https://www.w3.org/TR/png-3/#color-space-definitions)。
- 本地 `File` 通过 `URL.createObjectURL()` 形成的 blob URL 与创建它的环境同源，因此正常的本地上传流程不会仅因文件来自用户磁盘而污染 Canvas。来源：[File API：Origin of blob URLs](https://www.w3.org/TR/FileAPI/#originOfBlobURL)。

### 2. 主流抗指纹实现扰动 RGB，不扰动 alpha

- Firefox 当前的 Canvas randomization 实现对 Canvas 2D 以四通道像素处理，但将最后一个通道视为 alpha 并跳过；代码注释明确说明要避开 alpha，随机化目标从 RGB 中选择。来源：[Firefox `nsRFPService.cpp`：`RandomizeElements`](https://searchfox.org/firefox-main/source/toolkit/components/resistfingerprinting/nsRFPService.cpp#955-1040)。Firefox 自有测试也确认 `getImageData()` 是受 Canvas randomization 覆盖的读取入口。来源：[Firefox Canvas randomization browser test](https://searchfox.org/firefox-main/source/toolkit/components/resistfingerprinting/tests/browser/browser_canvas_randomization.js#68-169)。
- Brave 在 `getImageData()` 返回前调用 `PerturbPixels()`。其公开实现按 RGBA 四字节定位像素，但通道索引使用 `v % 3`，注释也写明只从 R、G、B 选择；实际操作是对选中 RGB 字节异或最低位，alpha 字节不可能被选中。来源：[Brave `getImageData()` hook](https://github.com/brave/brave-core/blob/master/chromium_src/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc)、[Brave `PerturbPixelsInternal()`](https://github.com/brave/brave-core/blob/master/third_party/blink/renderer/core/farbling/brave_session_cache.cc#L317-L348)。Brave 的第一方说明也确认 Canvas readback 属于随机化保护范围。来源：[Brave Fingerprinting Protections](https://github.com/brave/brave-browser/wiki/Fingerprinting-Protections)。

所以“透明像素的 RGB 可能不再严格等于纯黑/纯白”是成立的兼容性顾虑，但它不支持“alpha 也需要容差”这一推论。对精简边界扫描，完全忽略 RGB 就能同时避开颜色转换、透明像素隐藏色和上述抗指纹噪声。

## 建议的实现契约

1. 用默认可透明的 2D context（不得传 `{ alpha: false }`），按原图自然尺寸 1:1、整数坐标绘制；不要在分析阶段缩放、变换或加滤镜。`imageSmoothingEnabled = false` 可作为防御性设置，但 1:1 绘制本身才是关键。
2. 一次读取完整分析区域的 `ImageData`，边界算法只检查每个像素的第四个字节：`data[offset + 3] === 0` 为透明，任何 `> 0` 均为内容。
3. 不根据 RGB 的 0、255 或接近值判断留白；完全透明像素可以携带任意 RGB 隐藏色，颜色空间转换及抗指纹扰动也可能改变 RGB。
4. 用 `try/catch` 包住 context 创建、图片解码/绘制和 `getImageData()`；context 为空、图片未成功解码、`SecurityError`、context loss、内存/尺寸失败都应中止分析并提示用户，绝不能退化成“整图透明”或继续应用。
5. 若整个导入字符网格和其外部检查区域都没有任何 `alpha === 0`，将素材视为“不具备可验证的透明留白”（或“没有可精简空间”），不执行自动裁剪。Canvas 读回不能可靠区分无 alpha 的全不透明 PNG 与恰好全不透明的 RGBA PNG，但两者都没有可安全删除的透明像素。
6. 可在分析前做一次小型 alpha 自检：构造同时含 `alpha=0`、`alpha=1`、`alpha=254`、`alpha=255` 的本地 `ImageData`，`putImageData()` 后立即读回并要求 alpha 完全一致；失败时禁用精简并提示当前浏览器修改或无法可靠读取 alpha。这是面向未知/未来浏览器的 fail-closed 保护，不是放宽阈值的依据。

## 对产品决策的直接回答

- **抗指纹扰动 RGB 还是 alpha？** 已核实的 Firefox、Brave Canvas 2D 实现只扰动 RGB，刻意避开 alpha。
- **内置透明阈值？** `alpha === 0`，即数值阈值为 0；不向用户开放设置。
- **低 alpha 抗锯齿像素？** `alpha=1..255` 一律视为字形内容。这样可能少裁一两个像素，但不会因工具推断而删除作者保留的可见覆盖度。
- **无法可信读取时？** 中止并禁止应用；预览不能替代数据完整性检查，因为被误裁的低 alpha 边缘在缩放预览中可能难以察觉。

## 研究边界

本结论基于截至 2026-08-13 可查的 Web/PNG 规范和 Firefox、Brave 公开实现。浏览器隐私保护属于实现扩展，HTML Standard 本身没有授权一个可移植的“允许随机改动若干 alpha 值”的容差范围，因此不能从规范推导出大于 0 的安全阈值。
