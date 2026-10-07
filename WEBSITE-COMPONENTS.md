# 官网现状组件样板

完整页面样板于 2026-10-07 改为从官网组件直接构建。`templates.html` 只负责样板入口与主题工具条；`site-components/` 是独立、可部署的官网组件构建，不另写静态页面副本。

| 样板 | 官网源码 | 对应视图 |
| --- | --- | --- |
| 数据总览 | AccountPage / OverviewPreview / AccountAssetChart / AccountMarketQuotes | account.html |
| 记录列表 | AccountWalletPage | state=history |
| 记录详情 | AccountWalletPage | state=detail，USDC 充值记录 |
| 账户设置 | AccountProfilePage | 个人资料、头像、昵称与 UID |
| 身份验证 | AccountAreaPage / AccountKycFlow | 已认证、开始验证、审核中、补充资料、未通过 |

导航、页脚、字阶、菜单、日期、图表与动效来自官网实际入口及其依赖。范围内的账户导航已随组件打包；其他入口打开官网。深浅主题可在规范控件、样板工具条与官网主题按钮之间同步，切换不重新加载表单。390 / 768 px 调整真实 iframe 视口，不缩放文字。

## 数据与交互边界

- 钱包、会员与节点金额沿用官网既有样板资料；详情与列表共用同一记录。
- 热门行情仅允许公开 OKX ticker / instruments GET；接口失败使用原组件错误态，不补报价。
- 所有业务 fetch 阻断，不提交反馈、证件、充值或提现。业务服务不会返回伪成功。
- 样板 storage 使用 `openx-design-spec:website-components:` 命名空间，清空不会触及官网或规范其它数据。禁用浏览器存储时使用本次访问的内存。
- 已有账户组件中在本机保存的资料仍可用于组件交互演练；不能用样板替代平台授权或真实财务验证。

## 后续更新

官网源码及工具链位于同级 `openx-website`，运行：

```sh
node scripts/import-website-components.mjs ../openx-website
```

构建开始时固定官网 Git HEAD，将该提交的源码解包到独立构建目录。HTML、CSS、源码哈希和 public 资源都从同一提交读取；开发未提交的功能及构建期间推进的新提交不会混入规范发布。构建输出来源 commit、参与的源码哈希及构建时间写入 `site-components/source-manifest.json`。需更新官网组件时，先提交官网对应修改，再重新构建。

更新后同步原规范、独立规范发布目录与官网 `handoff/design-spec/full`。`index.html` 仅替换 `BEGIN PAGE_TEMPLATES` 片段并更新 completion 资源版本，保留其它章节。独立规范仓库仍从 main 的根目录发布。

本次校验：五个入口 × 深浅主题 × 桌面 / 768 / 390 共 30 种组合无横向溢出、无缺图；钱包筛选到详情再返回保留筛选；主题切换保留未保存昵称；五种认证状态可到达；存储隔离、业务阻断与源码哈希测试通过。构建告警保留官网已有 Lottie 的 eval 提示，未声称执行真实业务提交。
