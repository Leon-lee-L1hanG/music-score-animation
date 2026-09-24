# 可运行模板与验收

模板在 `assets/template/`，初始化脚本复制到目标项目。它是可修改的工作起点，不是任意乐谱的通用解析器；遇到独立多声部、反复跳转、连音链、三连音、自由速度等，按真实曲谱扩展解析与时间线，不丢弃结构来迁就模板。

## 输入

初始化生成 `score-input.json`，没有默认音符。先取得并核对素材，再填入：

```json
{
  "title": "本次曲名",
  "subtitle": "钢琴乐句",
  "tagline": "",
  "label": "PIANO SCORE",
  "composer": "已核实的作曲者",
  "source": "真实曲谱来源与用途说明",
  "bpm": 84,
  "fifths": 0,
  "beats": 4,
  "beatType": 4,
  "upper": [],
  "lower": []
}
```

upper/lower 是小节数组，每小节由 `[音高或和弦或null, 四分音符拍数, 可选连线状态]` 组成。例如 `["C5",1]`、`[["C3","E3","G3"],2]`、`[null,0.5]`。`start`/`stop` 表示连音起止，同音两次独立演奏不要加 tie。每小节总拍数应为 beats×4/beatType，弱起应按实际时长扩展代码，不补造音符。

当前输入支持两谱表各一节奏序列及同时和弦、休止符、升降号、常见整值与附点时值、单段 tie。不能用它吞掉复杂乐曲中的其他 voice。已有 MusicXML/MXL 时优先保留原结构并适配映射，没必要转回人工简化数组。

需要修正或扩展时直接编辑项目副本，不修改安装技能中的模板来存储本次歌曲。

## 运行

1. 检查 Node、Chrome、ffmpeg。项目中 `npm ci` 安装锁定依赖；可复用已有兼容依赖，不能假定新机器已有。
2. 从材料说明取得钢琴采样，保存到 `sources/acoustic_grand_piano-mp3.js`；记录来源许可。
3. `npm run prepare`：生成 MusicXML/MIDI、Verovio SVG、真实符头坐标、纹理和 WAV。
4. `npm run preview`：打开 Remotion Studio，Composition 为 `ScoreFilm`。从实际画面确认资源加载和运动；Studio HTTP 200 本身不等于播放通过。
5. 抽帧放到 `output/qa/` 并登记 `.qa-images.json`。可用 `npx remotion still src/index.tsx ScoreFilm output/qa/middle.png --frame=<帧号>`。
6. `npm run render`：导出中间 MP4，重新封装原始 WAV，复核最终音频。
7. `npm run verify`：核对 MIDI 事件、落点、所有帧球体取景，以及最终音轨。失败必须修复，不能修改报告中的 passed 绕过。
8. 全片解码检查，查看开头、中段、结尾和手机大小检查图；检查定量脚本难以发现的遮挡、过强 Bloom、错误谱面和不自然镜头。
9. 最终文件是 `output/music-score.mp4`。如重命名，同时修改 finalize/verify 脚本以保持渲染命令可复现。

`CHROME_PATH` 可以覆盖浏览器路径。默认 Windows Chrome 路径；其他平台由 Remotion 查找浏览器。长谱需要按系统或纹理块处理，不依赖单张无限宽图片。

## 打包和清理

源码 ZIP 至少包含 src、scripts、public、必要的 sources、score-input.json、package.json、package-lock.json、tsconfig、remotion.config、README 和文本报告。不要包含 node_modules、构建缓存、临时检查图或中间 MP4。README 必须说明素材来源、完整曲还是选段、命令、Composition、真实验证结果及限制。

`.qa-images.json` 只登记本次用于判断的图片相对路径，如 `["output/qa/opening.png","output/qa/phone.png"]`。视觉验收通过、源码 ZIP 已打包后，再运行 cleanup-qa.ps1。脚本只清理清单，不自动识别所有图片；它拒绝越界、重解析路径、非图片和未通过验收的项目。完成后保留 qa-cleanup.json 文本记录。
