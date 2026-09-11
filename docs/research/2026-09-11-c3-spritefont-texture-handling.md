# C3 Sprite Font 纹理处理地面真相（Re-wrap 功能 Q10 研究）

- 日期：2026-09-11
- 研究对象：`/Users/dingmenglan/Github/gc-2026/packages/c3-stick-mega-battles`（XYX 平台包装的 Construct 3 导出游戏，严格只读）
- 目的：为 sprite-font-editor 的 Re-wrap（重排）功能回答——输出图片宽度应「精确等于目标宽度留透明余量」还是「裁到实际列宽」。需要 C3 运行时如何消费 sprite font 纹理的地面真相。
- 方法：一手证据优先——游戏包内 C3 导出运行时代码（`src/scripts/c3runtime.js`）、`data.json`、实测图片尺寸（sips）；官方文档佐证（construct.net 直连 403，采用搜索摘要 + 官方博客）。

---

## 问题 1：网格推导语义

**结论：列数 = `Math.floor(纹理frame宽 / characterWidth)`，行数 = `Math.floor(frame高 / characterHeight)`，row-major 定位（col = index % cols，row = floor(index / cols)）。右侧/下侧透明余量永远不会被采样，对渲染零影响——连代码路径都不存在。容量 = 列×行，超出的字符被静默丢弃。**

### 运行时代码证据

游戏包 `src/scripts/c3runtime.js`（C3 导出 runtime，含 Spritefont2 插件源码块，注释标记 `// scripts/plugins/Spritefont2/spritefont.js`）：

网格推导（c3runtime.js:44974-45000，`self.SpriteFont.UpdateCharacterMap()`）：

```js
UpdateCharacterMap() {
  if (!this._mapChanged) return;
  this._ReleaseCharacters();
  let t = C3.SplitGraphemes(this._characterSet),
    h = Math.floor(this._width / this._characterWidth),        // ← 列数
    e = h * Math.floor(this._height / this._characterHeight);  // ← 总容量 = 列×行
  for (let a = 0, i = t.length; a < i && !(a >= e); ++a) {     // ← 超容量字符静默丢弃
    let e = t[a];
    if (this._characterMap.has(e)) continue;
    let i = a % h,                                              // ← col = index % cols
      r = Math.floor(a / h);                                    // ← row = floor(index / cols)
    this._characterMap.set(e, C3.New(self.SpriteFontCharacter, this, e, i * this._characterWidth, r * this._characterHeight));
  }
  ...
}
```

每个字符的像素矩形（c3runtime.js:44643-44656，`self.SpriteFontCharacter`）：

```js
constructor(t, e, i, s) {
  let h = t.GetCharacterWidth(), r = t.GetCharacterHeight();
  this._pxRect = new C3.Rect(i, s, i + h, s + r);   // (col*cw, row*ch, +cw, +ch)
  ...
}
_UpdateTexRect() {
  let t = this._spriteFont.GetWidth(), e = this._spriteFont.GetHeight();
  this._texRect.copy(this._pxRect), this._texRect.divide(t, e), this._texRect.lerpInto(this._spriteFont.GetTexRect());
  // UV = pxRect / frame尺寸，再映射进 TexRect（frame 在整张 sheet 里的 UV 窗口）
}
```

`_width/_height` 的来源（c3runtime.js:44113-44117，Spritefont2.Type.UpdateSettings）：

```js
UpdateSettings(t, e, i, r) {
  const s = this.GetImageInfo(), n = this._spriteFont;
  n.SetWidth(s.GetWidth()), n.SetHeight(s.GetHeight()), ...  // ← frame 宽/高，不是整图
}
```

运行时 UV 更新（c3runtime.js:44176，Instance.Draw）：`n.GetSpriteFont().SetTexRect(e.GetTexRect())`。

### 本项目实测验证

- 图：4096×512（sips 实测 `src/images/shared-3-sheet6.webp` 与 `shared-3-sheet7.webp`）
- characterWidth=99、characterHeight=105（c3-instance.json index 2/3）
- 列数 = floor(4096/99) = **41**，行数 = floor(512/105) = **4**，容量 164
- charset 实测 **160 个字符**（python len），恰好放入 164 格，空 4 格
- 右侧余量 4096 − 41×99 = **37px**，下侧余量 512 − 4×105 = **92px** —— 游戏线上正常运行，两轴都有非整数倍余量，证明余量无害

### 官方文档佐证

- [Sprite Font - Construct 3 Documentation](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font)（搜索摘要）："The 'sprite font' is the object image, which contains a grid of every character that can be drawn. The size of each character's cell..." —— 官方手册同样描述为「网格切分」。（construct.net 对非浏览器 UA 返回 403，未能抓取全文；本地运行时代码是更强的一手证据。）

### 对 Q10 的直接推论

**「精确目标宽度留余量」和「裁到实际列宽」在渲染上完全等价。** 因为运行时只看 `floor(width / characterWidth)`，任何落在 `[cols×cw, (cols+1)×cw − 1]` 区间内的宽度产生逐像素相同的结果。裁到 `cols×cw`（实际使用列宽）是安全的；留余量到目标宽度（如下一个 2 的幂）也安全。决策可以基于包体/美观而非运行时兼容性。

---

## 问题 2：shared 图集打包与 frame 寻址

**结论：是——C3 导出流程把 sprite font 纹理交给 spritesheet 打包器，输出遵循 `shared-N-sheetN.webp` 命名。寻址通过 data.json 里对象类型上的 frame 矩形 `[url, size, offsetX, offsetY, width, height, rotated]`。网格按 frame 宽（`ImageInfo.GetWidth()`）推导，不按整图宽。替换整张图式交付的约束：新图像素尺寸必须与 data.json frame 一致（或同时改 data.json），否则 UV 分母错误。**

### data.json 证据

`src/data.json` → `project[3]`（对象类型数组），两个 sprite font 对象：

```jsonc
// project[3][382]
["Без_Контурный", 21, false, [...], 1, 0,
 ["images/shared-3-sheet6.webp", 58238, 0, 0, 4096, 512, false],   // ← 元素 6 = 贴图 frame
 null, [["AnimatedCounter", 22, ...]], ...]

// project[3][383]
["Контурный", 21, false, [...], 3, 0,
 ["images/shared-3-sheet7.webp", 124392, 0, 0, 4096, 512, false],
 null, [["Угасание", ...], ["Синусоида", ...], ["AnimatedCounter", ...]], ...]
```

frame 字段语义由 runtime 的 `C3.ImageInfo.LoadData` 确认（c3runtime.js:29997-29999）：

```js
LoadData(t) {
  this._url = t[0], this._size = t[1], this._offsetX = t[2], this._offsetY = t[3],
  this._width = t[4], this._height = t[5], this._isRotated = t[6], this._hasMetaData = !0;
}
```

- 本项目两张字体贴图的 frame 都是 `(0, 0, 4096, 512)`、未旋转 —— **各占一张独立 sheet，frame 占满整图**。全 data.json 中除这两个对象外没有任何其他精灵引用 sheet6/sheet7（脚本扫描 `shared-3-sheet6|7` 仅命中这两条）。
- 关键点：c3runtime.js:30065 `this._hasMetaData || (this._width = i.GetWidth(), ...)` —— 有 metadata 时 **runtime 信任 data.json 的 frame 尺寸而不是实际图片尺寸**。
- `GetTexRect()`（c3runtime.js:30066-30068）= `(offsetX, offsetY, offsetX+w, offsetY+h) ÷ 整张sheet尺寸`，即 frame 在 sheet 内的 UV 窗口；字符 UV 在此窗口内按 frame 宽高切网格。
- `GetSheetWidth()/GetSheetHeight()`（c3runtime.js:30041-30045）存在但 sprite font 网格逻辑不用它。

### 对「替换整张图」交付的约束

1. **像素尺寸必须与 data.json frame 完全一致**（4096×512）。尺寸不同 → `_width` 与实际图片不符 → 网格列数按错误分母算、UV 错位。
2. 同理，如果 Re-wrap 改变了图宽，必须同步改 data.json 的 frame（本项目的工作流是 sprite-font-editor 导出 project.json → 由工具链生成/更新 C3 侧数据，需注意这一耦合）。
3. frame offset 必须保持 (0,0) 或相应调整——只要 frame 矩形覆盖新图的实际字体区域即可，余量可以放在 frame 外（不会被采样）。
4. 不要动 sheet 里其他精灵——本项目字体贴图独占 sheet，但 shared sheet 机制本身允许多对象共存；若未来字体与其他精灵共 sheet，重排会挪动其他精灵的 frame。

### 官方佐证

- [Under the hood: Spritesheets in Construct 2（Scirra 官方博客）](https://www.construct.net/en/blogs/construct-official-blog-1/hood-spritesheets-construct-772)："So the only candidate sizes for sprite sheets are power-of-two sizes" —— shared sheet 的打包/POT 策略（C2 时代确立，C3 继承；`shared-N-` 前缀即打包器输出）。
- C3 导出运行时代码中本游戏的 sprite 帧全部以 `[url, size, x, y, w, h, rotated]` 引用 shared sheet（data.json 全量可见，如 `project[3][21] fx_star_white` → `["images/shared-3-sheet1.webp", 73318, 730, 286, 114, 113, true, ...]`，rotated=true 的帧也存在）。

---

## 问题 3：实地盘存

### 项目内 sprite font 用法（仅 2 处，均 plugin id 21 = Spritefont2）

| 对象名 | 贴图 | frame | 用途线索 | characterWidth | characterHeight | charset |
|---|---|---|---|---|---|---|
| Без_Контурный（无轮廓） | shared-3-sheet6.webp（58,238 B） | (0,0,4096,512) 占满 | AnimatedCounter 行为 | 99 | 105 | 160 字符（西里尔+拉丁+数字+符号） |
| Контурный（带轮廓） | shared-3-sheet7.webp（124,392 B） | (0,0,4096,512) 占满 | Угасание/Синусоида/AnimatedCounter | 99 | 105 | 同上，完全相同 |

- 实例属性（layouts 内多处，文本如 "XXXXXXX"/"500"/"100"/"{7.8}"/"0"）的 charW/charH/charset/spacingData 完全一致。已按形状 `[str, bool, int, int, charset, spacingJSON, ...]` 全量扫描 data.json：**1736 份实例属性全部相同**（99×105、160 字符 charset），无漏网的异尺寸实例。
- `fonts/sheet6/c3-instance.json` 就是其中一份实例属性（text="XXXXXXX"），与类型定义 `/Users/dingmenglan/.agents/skills/c3-data-types/references/gameTypes/instance-properties/spritefont2.ts` 对照：r344+ 格式 15 项 `[text, enableBBCode, charWidth, charHeight, charset, spacingData, scale, charSpacing, lineHeight, hAlign, vAlign, wrapByWord, visible, origin(未用), readAloud]`。注意 **实例属性里没有任何图片尺寸字段**——纹理尺寸只来自对象类型上的 frame。
- spacingData 覆盖 13–77 的自定义宽度（空格 13、`il:!` 14、最宽 `Щ` 77），逐字符 displayWidth 只影响排版宽度，不影响网格定位。

### 网格账（两图相同）

| 项 | 值 |
|---|---|
| 图尺寸 | 4096×512（sips 实测） |
| 列数 floor(4096/99) | 41（用足 4059px，余 37px） |
| 行数 floor(512/105) | 4（用足 420px，余 92px） |
| 容量 | 164 格 |
| charset 长度 | 160（余 4 空格） |
| 是否 2 的幂 | 宽 4096=2¹²、高 512=2⁹，都是 |

### images/ 全量尺寸实测（sips）

- **shared-N sheet 共 21 张**：最大边 4096（仅 sheet6/sheet7 两张字体图），其余 2048/1024/512/256/64/32/16/1 不等；绝大多数为 2 的幂，但 **shared-0-sheet5 = 2526×923 不是 POT** —— 说明 POT 是打包器的常见选择而非硬约束（与官方博客「候选尺寸是 POT」的表述在「排不下的内容」场景有出入，实际以观察为准）。
- 对象专属 sheet（`u…-sheetN.webp`、`рекошет-sheet0.webp` 等）保留原始非 POT 尺寸（1743×1038、1011×1018、299×299 等）——**只有进入 shared 打包流程的图才可能被改尺寸**。
- 最小 shared sheet 为 1×1（shared-3-sheet5，占位空图）。

---

## 问题 4：纹理尺寸上限

**结论：导出烘焙的 sheet 观察到的最大边是 4096（即本游戏字体贴图）。运行时层面：WebGL `MAX_TEXTURE_SIZE` 在启动时查询（c3runtime.js:11903），Text 对象的运行时生成贴图钳制到 `min(GPU上限, 4096)`（c3runtime.js:11289、11454）。目标平台（vivo 小游戏）未发现任何纹理缩放——4096×512 原样进包。**

证据：

- c3runtime.js:11903：`this._maxTextureSize = t.getParameter(t.MAX_TEXTURE_SIZE)`；12503 `GetMaxTextureSize()`。
- c3runtime.js:11289 `MAX_TEXTURE_SIZE = 4096`（`C3.Gfx.RendererText`，Text 插件运行时画布）；11454 `h = Math.min(this._renderer.GetMaxTextureSize(), 4096)`，超出按比例缩小 `_scaleFactor`。
- 编辑器打包侧（导出时烘焙，runtime 无此逻辑）：本游戏最大 sheet 4096×512，故 C3 编辑器 spritesheet 上限 ≥ 4096。历史参考：[Construct 官方论坛 spritesheet 帖](https://www.construct.net/en/forum/construct-2/general-discussion-17/spritesheet-optimize-98851) 提到 C2 时代上限从 512 演进到 2048；C3 时代 4096 已是实际观察值。
- 平台侧：`platform/vivo/build/loading/data.json` 中字体贴图 frame 与 src 完全一致（`(0,0,4096,512)`，同 URL 同字节数 58238/124392）；全平台目录 grep 无 4096/2048/maxTexture 相关配置 —— **无证据表明小游戏平台影响 C3 的纹理尺寸选择**，尺寸决策发生在 C3 导出时。
- 兼容性注意：4096 宽图要求 GPU `MAX_TEXTURE_SIZE ≥ 4096`。主流手机（含近年中低端）普遍支持 4096+；若需兼容更老设备，2048 是更保守的 Re-wrap 目标宽度。

---

## 附：对 sprite-font-editor Re-wrap 设计的落地建议（Q10）

1. 两种宽度策略渲染等价，任选；**推荐「裁到实际使用列宽 = cols×characterWidth」**，因为：余量像素在 C3 里从不被消费，留着只增加文件体积（虽然 webp 透明区域压缩后代价极小）；但如果工作流偏好对齐 2 的幂（如导出配置要求 POT sheet），留余量也同样安全。
2. 改变列数的重排 = 改变换行宽度语义，C3 侧只需保证 `floor(新宽/99)` 等于新列数即可；高度同理。
3. 交付物必须三件套一起更新：图片（新尺寸）+ data.json frame（w/h）+ 实例属性不变（charW/charH/charset/spacingData 与 cell 尺寸、顺序严格一致，这正是本编辑器的约束）。
4. 上界：宽 ≤ 4096（本游戏实证的安全上限；Editor 打包器上限即此量级）。
