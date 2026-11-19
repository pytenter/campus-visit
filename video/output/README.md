# 《如果周六由你开校门》中文讲解视频

成片：**[观看或下载完整MP4](https://github.com/pytenter/campus-visit/raw/refs/heads/main/video/output/saturday-campus-explained-zh.mp4)**，7分9秒，1920×1080，25fps，H.264/AAC。中文旁白与中文字幕已嵌入，直接打开MP4即可观看。

实际录制网站中的三项制度原型、规则比较、两个原速人物重放、移桌、暂缓审批、重新通过、发布和下一位访客体验。旁白使用macOS普通话合成声音Tingting。手机画面为浏览器尺寸演示，实体头显尚未实测。

- [逐句中文字幕](saturday-campus-explained-zh.srt)：可导入剪辑软件修改。
- [字幕排版源文件](saturday-campus-explained-zh.ass)：标题栏、章节及字幕样式。
- [完整讲解稿](讲解稿.md)：30段说明、92句字幕。
- [章节时间点](chapters.txt)。
- [成片预览图](poster.png)。

## 重新录制与合成

应用运行使用Node.js与pnpm。当前录制脚本使用macOS的`/usr/bin/say`和已安装的Tingting声音，需要Google Chrome；后期使用Python 3.10+、Pillow和支持libass/libx264的FFmpeg。也可安装`imageio-ffmpeg`供脚本自动寻找FFmpeg。

在项目根目录依次运行：

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install ffmpeg
python3 video/build_audio.py
# 在另一个终端保持 pnpm dev 运行
node video/record.mjs
python3 video/compose.py
# FFmpeg不在PATH时：python3 video/compose.py --ffmpeg /path/to/ffmpeg
```

逐句WAV、按时间线对齐的旁白WAV、原始录屏、排练与质量检查文件在本地生成，不纳入仓库。`video/assets/voice-manifest.json`保留已交付版本的逐句时长，重新生成配音会更新清单。项目字体与许可保留在`public/assets/`。

全部制度、资源额度和格网结果属于课堂原型，真实效果仍待现场验证。录屏演示身份固定O09，网站正式交互保持原来的身份抽取逻辑。
