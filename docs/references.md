# 参考文件与素材来源

核对日期：2026-11-19。以下文件均通过 GitHub API 取得默认分支提交号，再从该提交的 raw 文件实际下载阅读；未将远程 CDN 作为运行依赖。除 A-Frame 运行库和本地中文字体外，校园建筑、人物、纸桥、情境与中文文案均为本项目原创。校园是广州大学城主题的教学示意，不指代任何学校真实开放政策、建筑平面或承诺。

## 实际阅读的参考

| 项目 / 固定提交 | 实际文件 | 解决的问题与本项目对应位置 |
| --- | --- | --- |
| [aframevr/aframe](https://github.com/aframevr/aframe/tree/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1) / `022bcc5f6eef` | [docs/core/scene.md](https://github.com/aframevr/aframe/blob/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1/docs/core/scene.md)、[docs/components/camera.md](https://github.com/aframevr/aframe/blob/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1/docs/components/camera.md)、[docs/components/raycaster.md](https://github.com/aframevr/aframe/blob/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1/docs/components/raycaster.md)、[src/components/cursor.js](https://github.com/aframevr/aframe/blob/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1/src/components/cursor.js)、[src/components/laser-controls.js](https://github.com/aframevr/aframe/blob/022bcc5f6eef09ff60d3f2110604c78cae0cd5b1/src/components/laser-controls.js) | 场景统一管理 renderer、用户主动 enterVR、camera rig 独立于头部追踪；显式限定可点对象，鼠标 cursor 与控制器 laser-controls 走同一交互事件。对应 src/scene.ts 与 src/components.ts。 |
| [AdaRoseCannon/aframe-xr-boilerplate](https://github.com/AdaRoseCannon/aframe-xr-boilerplate/tree/92802ba34a7555d8aa306b3262ab4c99cdfad8e4) / `92802ba34a75` | [index.html](https://github.com/AdaRoseCannon/aframe-xr-boilerplate/blob/92802ba34a7555d8aa306b3262ab4c99cdfad8e4/index.html)、[simple-navmesh-constraint.js](https://github.com/AdaRoseCannon/aframe-xr-boilerplate/blob/92802ba34a7555d8aa306b3262ab4c99cdfad8e4/simple-navmesh-constraint.js) | 参考 cameraRig/head 层级与“移动后检查可行走区域”的方式；原约束向下投射 navmesh 并拒绝不可行走位置。本项目是平坦9×7格网，因此重新编写平面范围/公共路径约束，未复制重力和复杂扫描逻辑。对应 src/components.ts 的移动范围与传送；src/scene.ts 的相机组。 |
| [immersive-web/webxr-samples](https://github.com/immersive-web/webxr-samples/tree/3bcfcdfb63c538715159d283c6f2cfacb57a491b) / `3bcfcdfb63c5` | [input-selection.html](https://github.com/immersive-web/webxr-samples/blob/3bcfcdfb63c538715159d283c6f2cfacb57a491b/input-selection.html)、[teleportation.html](https://github.com/immersive-web/webxr-samples/blob/3bcfcdfb63c538715159d283c6f2cfacb57a491b/teleportation.html) | 阅读 XRInputSource.targetRaySpace 的选择射线、select/selectstart/selectend 时序、地面命中传送、30°分段转向与房间尺度头部偏移补偿。本项目通过当前 A-Frame 控制器事件适配，复用已存在 renderer，不另建 WebXR 原生渲染器。对应 src/components.ts 的手柄交互、传送与转向。 |
| [AleenaTahir1/nutech-tour](https://github.com/AleenaTahir1/nutech-tour/tree/32844bce593f7260d3c4c4b65a07ff8388c67c36) / `32844bce593f` | [src/components/TourView.js](https://github.com/AleenaTahir1/nutech-tour/blob/32844bce593f7260d3c4c4b65a07ff8388c67c36/src/components/TourView.js)、[src/components/TourView.tsx](https://github.com/AleenaTahir1/nutech-tour/blob/32844bce593f7260d3c4c4b65a07ff8388c67c36/src/components/TourView.tsx)、[src/data/locations.ts](https://github.com/AleenaTahir1/nutech-tour/blob/32844bce593f7260d3c4c4b65a07ff8388c67c36/src/data/locations.ts)、[src/types/index.ts](https://github.com/AleenaTahir1/nutech-tour/blob/32844bce593f7260d3c4c4b65a07ff8388c67c36/src/types/index.ts) | 用地点结构组织校园站点，并区分 custom 导航热点和 info 说明热点。本次检查发现 locations.ts 仅含占位，真正完整的地点与热点表在 TourView.js，故以该文件为实质参考。对应 src/scene.ts 的前往展馆导航热点、限制说明热点。未使用其校园照片或全景素材。 |
| [drhycheung/Choices](https://github.com/drhycheung/Choices/tree/51ed7aac45f53b881584d076ad02f004860dfccb) / `51ed7aac45f5` | [engine.js](https://github.com/drhycheung/Choices/blob/51ed7aac45f53b881584d076ad02f004860dfccb/engine.js)、[scenarios/ai-hiring.json](https://github.com/drhycheung/Choices/blob/51ed7aac45f53b881584d076ad02f004860dfccb/scenarios/ai-hiring.json)、[docs/vibe-coding.md](https://github.com/drhycheung/Choices/blob/51ed7aac45f53b881584d076ad02f004860dfccb/docs/vibe-coding.md) | 参考纯逻辑引擎与 UI 分离、确定性选择效果、history/why 因果轨迹及根据实际选择推导复盘。本项目首次只抽身份，之后固定身份/名单；分配、对比、路径统计均是确定性计算。对应 src/domain.ts、tests/domain.test.ts；UI 显示受影响者、结果、原因。没有复制原有商业/法律情节。 |

## 许可与署名

以上五个项目在核对的提交均含 MIT 许可。相应作者与完整许可原文已保存在 [third-party-licenses](./third-party-licenses/)：

- A-Frame：Copyright © 2015–2026 A-Frame authors。运行依赖受其 MIT 许可约束。安装包自身许可亦保留。
- aframe-xr-boilerplate：Copyright (c) 2022 Ada Rose Cannon。仅参考结构、独立实现。
- webxr-samples：Copyright 2018 The Immersive Web Community Group。仅参考交互机制、由 A-Frame 适配实现。
- nutech-tour：Copyright (c) 2024 NuTech Virtual Tour。仅参考地点/热点分类，没有拷贝照片或全景。
- Choices：Copyright (c) 2026 一念之差 / Choices contributors。仅参考确定性状态、选择轨迹与复盘方法。

## 本地字体

`public/assets/NotoSansSC-Regular.otf` 来自 [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf)，固定提交 `f8d157532fbfaeda587e826d4cd5b21a49186f7c`，上游原版，8,331,336 字节，SHA-256 `faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`。

该字体遵循 SIL Open Font License 1.1。完整许可在 `public/assets/NotoSansSC-OFL.txt`，来源在 `public/assets/FONT-SOURCE.txt`。字体文件含实际简体中文字形；HTML 与世界内 Canvas 面板可共用同一本地字体，等待字体加载再绘制，从而脱离系统字体与在线字体服务。

替换为照片或 GLB 时应使用小组原创或明确允许使用的素材，并在本文件补充素材路径、作者、来源及许可；不要将网络照片直接改名为原创。
