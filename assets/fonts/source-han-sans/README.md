# 思源黑体 UI 字体资产

本目录使用 **Adobe Source Han Sans（思源黑体／思源黑體）2.005R** 的真实字形，不使用 Noto 字体改名。简体版本源自 Adobe `SourceHanSansCN-VF.ttf`，台湾繁体版本源自 `SourceHanSansTW-VF.ttf`，两者都是 Adobe 正式发布的地域变量字体。上游日期为 2025-06-18；固定提交为 `a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2`。

- [Adobe 官方发布](https://github.com/adobe-fonts/source-han-sans/releases/tag/2.005R)
- [简体中文原始 TTF](https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/Variable/TTF/Subset/SourceHanSansCN-VF.ttf)
- [台湾繁体原始 TTF](https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/Variable/TTF/Subset/SourceHanSansTW-VF.ttf)

## 许可证与名称

原包许可证为 SIL Open Font License 1.1，Adobe 保留字体名称 `Source`。本目录的 WOFF2 是为网页加载制作的子集衍生文件，因此内部名称改为 **OpenX Han UI SC / OpenX Han UI TC**，遵守该保留名称要求；它们的字形来自上面的思源黑体原包，不是 Adobe 原始包的逐字节复制。对用户的字体说明可写“思源黑体，简体／台湾繁体；网页子集”。

完整上游许可证见 `LICENSE.txt`。`manifest.json` 保存原包 SHA-256、固定下载链接、原始内部字族、版本、工具版本，以及每个分片的 SHA-256、字数、大小和验证结果。源版权、作者及许可信息保留在每个字体的 name 表中。

关于子集与保留名称的依据：[SIL Webfonts and Reserved Font Names](https://openfontlicense.org/webfonts-and-reserved-font-names/)。

## 加载契约

在应用 CSS 和旧字体 CSS **之后**加载 `../source-han-sans.css`。工作台公开地址是 `/design-tools/assets/fonts/source-han-sans.css`；规范与模板内使用相对路径 `assets/fonts/source-han-sans.css`。CSS 的字体 URL 全部相对于该样式表，必须保留 `source-han-sans/sc` 与 `source-han-sans/tc` 子目录。

```html
<html lang="zh-Hans">
<link rel="stylesheet" href="/design-tools/assets/fonts/source-han-sans.css">
```

```css
.workspace-interface { font-family: var(--ui-font); font-synthesis: none; }
```

`html lang="zh-Hans"` 选择 `OpenX Han UI SC`；`zh-Hant`（兼容 `zh-TW`／`zh-HK`）选择台湾繁体 `OpenX Han UI TC`。拉丁字母与数字也来自思源黑体。另一地域版本只作为该原始地域库存缺字时的后备。CSS 暴露 400–900 字重，并保留原包 250–900 的连续 wght 轴；没有把所有 CSS 字重绑定为 ExtraLight 默认实例。`font-synthesis: none` 禁止浏览器伪造粗体。

Latin、数字与标点是一个分片，常用界面汉字按频率分为三片，其他字符按 Unicode 范围按需下载。完整保留各 Adobe 正式地域字体的字符库存；不是只收集当前页面上的字符。因此未来输入仍可按需要加载对应字形。不会在首屏一次下载整个 CJK 原包。

## 作品与旧工程边界

此 CSS 定义界面 `--ui-font` 和规范 `--ox-font`。模板画布用 JavaScript 和已保存的字体族绘制作品；CSS 不改其文字、字重、字号、坐标、Logo 或导出像素。旧 `Noto Sans SC`、`OpenX Spec TC`、`OpenX Social SC` 等 font-face 定义继续保留用于恢复旧工程，不把这些名称重新绑定到本目录。切换界面语言不转换用户内容。

旧规范 CSS 曾把繁体字体直接写到每个 `:lang(zh-Hant)` 节点，新 CSS 仅在规范／模板嵌入与独立模板的 UI DOM 中覆盖该规则。实际作品是画布位图，由独立字体映射绘制。

## 重建与验证

`build.py` 使用 `fonttools[woff]==4.62.1`。依赖可装到临时目录并通过 `--tools` 指定；无须系统安装 Python 或更改现有环境。

```text
python build.py --source-root <原包与LICENSE.txt所在目录> --tools <fonttools目录> --ui-root <工作台repo> --workers 4
```

脚本先验证原始 TTF 等于固定 Adobe 包的 SHA-256，再遍历每个分片的全部编码字符，核对字符覆盖、原始 advance／bearing、TrueType 简单字形的坐标／轮廓标记及完整 wght 范围。字体布局特性、提示信息与字形依赖由 fontTools 保留。没有描摹、平滑、缩放或重绘字形。完整库存的并集必须等于原始地域字体 cmap；不满足时构建失败。

当前完整简体库存 30,926 字，繁体库存 20,763 字。Latin／标点与三组常用汉字合计简体 415,604 bytes、繁体 333,412 bytes；浏览器按页面实际文字选择所需分片。`verify.py` 再核对全部 517 个文件的内容哈希，并将两种语言各 23 个代表字符在 **400／600／900** 三档的实际轮廓和 advance 与 Adobe 原包逐项比较，共 138 次；当前全部一致。可重复生成的结果见 `variable-glyph-proof.json`。

最终界面仍需在工作台当前构建上核对真实网络加载和浏览器实际渲染字族，不能只用 CSS 中的名称当作加载成功。
