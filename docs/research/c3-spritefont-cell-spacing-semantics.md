# C3 Sprite Font cell 采样与 `spacingData` 语义

## 研究问题

当 Sprite Font 的 `characterWidth × characterHeight` cell 被精简时，需要确定：

1. C3 是否始终从纹理中采样整个 cell；
2. `spacingData` 改变采样矩形，还是只改变水平排版步进；
3. 精简后应如何迁移显式 spacing、默认宽度以及等于旧 `characterWidth` 的冗余项；
4. `characterSpacing` 和 `lineHeight` 是否应随 cell 缩小。

## 证据等级与来源

本结论同时由两类一手资料支持：

- Construct 3 官方手册定义了对外行为契约：`Character width` / `Character height` 是纹理中每个 cell 的尺寸；`Spacing data` 是单字符显示宽度；`Character spacing` 和 `Line height` 分别是水平和垂直方向的额外像素间距。[官方 Sprite Font 手册](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font)
- Construct 官方 Arcade 上的 C3 导出项目提供了可审计的引擎运行时。其 `SpriteFontCharacter`、`SpriteFont`和 `SpriteFontText` 实现直接显示采样矩形、宽度解析与画笔推进公式。[官方 Arcade 项目页](https://www.construct.net/en/free-online-games/text-vs-sprite-font-plugins-30479/play) · [该 C3 导出的可审计 `c3runtime.js`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

官方手册是当前产品契约；可审计运行时是 2021 年导出物。两者在本次所需的四个语义点上一致。

## 发现

### 1. 纹理采样始终使用完整 cell

官方手册明确将 `characterWidth` 和 `characterHeight` 称为图片中每个字符 cell 的尺寸，字符按从左到右、到边缘后换行的顺序映射。它还特别说明：当个别字符的显示宽度更窄时，图像仍应在 cell 内左对齐绘制。这说明显示宽度不会改变 cell 在纹理中的分割方式。[官方 Sprite Font 手册，“Sprite font properties”](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font#sprite-font-properties)

可审计运行时给出了更直接的证据：

- `SpriteFont.UpdateCharacterMap()` 以 `floor(imageWidth / characterWidth)` 计算列数，再按 row-major 顺序将字符映射到 `x = col × characterWidth`、`y = row × characterHeight`。
- `SpriteFontCharacter` 的像素矩形固定为从 `(x, y)` 到 `(x + characterWidth, y + characterHeight)`。
- `SpriteFontText._DrawFragment()` 以 `characterWidth` 作为绘制宽度，却以字符的 `displayWidth` 推进画笔。[可审计 C3 运行时，`SpriteFontCharacter`、`UpdateCharacterMap()` 与 `_DrawFragment()`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

**结论：** 精简工具应当把每个导入字符重新打包到新的完整 `characterWidth × characterHeight` cell；`spacingData` 不能当作源图裁剪宽度。

### 2. `spacingData` 是排版步进，不是字形缩放或采样宽度

官方手册把 `Spacing data` 定义为单个字符的宽度，用于让窄字符获得更紧凑的文本布局；`CharacterWidth(char)` 表达式也明确会计入 `Spacing data` 或 `Set character width` 动作。[官方 Sprite Font 手册，“Spacing data” 与 `CharacterWidth(char)`](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font#sprite-font-properties)

运行时中，`SpriteFontCharacter` 将纹理矩形和 `_displayWidth` 保存为两份独立数据；测量和绘制时的画笔增量为 `displayWidth + characterSpacing`，但贴图四边形的宽度仍是 `characterWidth`。[可审计 C3 运行时，`SpriteFontCharacter.GetDisplayWidth()` 与 `SpriteFontText._DrawFragment()`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

**结论：** 例如一个 `149px` 宽的 cell 配置 `displayWidth = 34px`，C3 仍会绘制完整 `149px` 宽的 cell，但下一个字符仅前进 `34px + characterSpacing`。因此 cell 精简不应对显式 `displayWidth` 扣除被删掉的左右留白。

### 3. spacing 迁移规则

C3 的默认字符步进是当前 `characterWidth`：`SpriteFontCharacter.GetDisplayWidth()` 在没有自定义宽度时返回 Sprite Font 的 `characterWidth`，空格没有自定义宽度时也如此。[可审计 C3 运行时，`GetDisplayWidth()` 与 `GetSpaceWidth()`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

同一运行时在 `UpdateCharacterMap()` 解析 `spacingData` 时，会直接跳过“spacing 宽度等于当前 `characterWidth`”的项。因此这些项在旧配置中与未配置 override 的运行效果相同。[可审计 C3 运行时，`SpriteFont.UpdateCharacterMap()`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

这导出以下迁移规则：

| 旧配置中的字符状态 | 新配置的处理 | 理由 |
| --- | --- | --- |
| 没有 spacing 项 | 不生成 spacing 项 | 继续跟随新 `characterWidth` 作为默认步进 |
| spacing 宽度不等于旧 `characterWidth` | 原数值保留 | 这是旧配置中真正生效的显式步进 |
| spacing 宽度等于旧 `characterWidth` | 删除该冗余项 | C3 旧运行时原本忽略它；若保留到新宽度配置，它将因不再等于新 `characterWidth` 而意外变成生效 override |

例如，旧 `characterWidth = 149`、新 `characterWidth = 80`：

- `[34, "A"]` 保留为 `34`；
- `[149, "B"]` 删除，精简后 `B` 使用新默认步进 `80`；
- 从未出现在 `spacingData` 中的 `C` 同样使用新默认步进 `80`。

**决策结论：** “显式生效的步进原值保留，默认步进随新 `characterWidth` 改变，等于旧 `characterWidth` 的冗余项删除”与 C3 运行时语义一致。

### 4. `characterSpacing` 和 `lineHeight` 原值保留

官方手册将 `Character spacing` 定义为字符之间额外增加的水平像素，将 `Line height` 定义为行之间额外增加的垂直像素。[官方 Sprite Font 手册，`Character spacing` 与 `Line height`](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font#sprite-font-properties) 官方脚本接口也使用相同的“extra space in pixels”定义。[官方 `ISpriteFontInstance` 文档](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/spritefont)

运行时中，水平步进是 `displayWidth + characterSpacing`，行总高是缩放后的 `characterHeight + lineHeight`。这两个属性是相对于字符宽/高的独立附加量，而不是 cell 留白的一部分。[可审计 C3 运行时，`SpriteFontText._MeasureText()`、`_DrawFragment()` 与 `GetTextHeight()`](https://construct-arcade.com/30479/33428/scripts/c3runtime.js)

**结论：** 精简 cell 时不对 `characterSpacing` 或 `lineHeight` 做减法、缩放或归零；两者原值保留。基础字符宽/高变小后，最终的字符步进和行距会自然以新 cell 尺寸为基础，再加上这两个原有附加量。

## 对“Font Sprite 精简”规格的建议

1. 重排导入字符时，每个源 cell 按旧 `characterWidth × characterHeight` 整格取出，统一裁掉四边已决定的透明留白，并放入新 `characterWidth × characterHeight` cell。
2. 字符继续按 `characterSet` 的 row-major 顺序重排，新列数由 `floor(保持不变的图片宽度 / 新 characterWidth)` 决定。
3. 迁移 `spacingData` 时需要使用“旧 `characterWidth`”来分类，不能先改宽度再判断：删除等于旧默认宽度的项，保留其他显式宽度。
4. 导出的 `characterWidth` 和 `characterHeight` 更新为新 cell 尺寸；`characterSpacing` 和 `lineHeight` 原值保留。
5. 预览必须和 C3 一样：始终绘制完整新 cell，然后使用 `displayWidth + characterSpacing` 推进；不能将 `displayWidth` 用作 `drawImage` 的源或目标宽度。

## 最终判定

候选规则通过验证，但应将“显式步进”精确表述为“在旧配置中不等于旧 `characterWidth`、因而确实生效的 spacing 项”：

> 保留所有旧配置中确实生效的 `spacingData` 数值；删除等于旧 `characterWidth` 的冗余项；未覆盖字符跟随新 `characterWidth`；`characterSpacing` 和 `lineHeight` 原值保留。
