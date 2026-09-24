# 音乐跳谱动画 · Music Score Animation

一个面向 Codex 的 Skill：根据歌曲名称寻找可用曲谱与 MIDI，制作“发光小球在真实曲谱上跳跃、镜头沿谱面滑行”的 3D 钢琴音乐视频，交付 MP4 和可运行源码。

技术栈：Remotion、React Three Fiber、Three.js、Verovio、MIDI、FFmpeg。

## 使用

将本仓库放到个人技能目录下的 `music-score-animation` 文件夹：

```sh
git clone https://github.com/Leon-lee-L1hanG/music-score-animation.git ~/.codex/skills/music-score-animation
```

Windows PowerShell：

```powershell
git clone https://github.com/Leon-lee-L1hanG/music-score-animation.git "$env:USERPROFILE/.codex/skills/music-score-animation"
```

在加载该 Skill 的 Codex 任务中直接提出请求：

> 用《月亮代表我的心》做音乐跳谱动画。

或显式调用：

> 使用 $music-score-animation 制作《曲名》的三维跳谱视频。

默认制作约 25–35 秒的完整乐句，1920×1080、30fps；可以指定全曲、演唱版本、画幅和风格。自动找素材不代表所有歌曲都有可直接获取的配套文件；确有素材或权限阻塞时会说明。

## 工作方式

1. 查找并核验可用曲谱、MIDI 和音色来源。
2. 从 MusicXML 生成真正的 SVG 曲谱，按音符 ID 读取符头坐标。
3. 将全部 MIDI 起音映射到谱面，区分和弦、新起音及延音。
4. 根据帧时间驱动双球跳跃、亮环、局部彩光及三维相机。
5. 渲染 MP4，复核落点、取景和编码后的音轨同步。
6. 打包源码，保留必要素材和文本报告，删除清单内的临时检查图片。

## 目录

```text
SKILL.md                  技能入口
agents/openai.yaml        自动触发与界面信息
scripts/bootstrap.ps1     创建歌曲项目
scripts/cleanup-qa.ps1    验收后的检查图片清理
references/               素材获取和制作说明
assets/template/          可运行工程模板
```

模板需 Node.js 20+、Chrome、FFmpeg；初始化与清理脚本使用 PowerShell 7。可用 `CHROME_PATH` 指定 Chrome。依赖版本由 package-lock.json 锁定。

手动初始化项目：

```powershell
./scripts/bootstrap.ps1 -Destination 'D:/music-projects/my-song' -Title '曲名'
```

随后由 Agent 根据核验后的曲谱填写 `score-input.json` 并准备音色，再执行 `npm ci`、`npm run prepare`、`npm run preview`、`npm run render`、`npm run verify`。详细输入格式见 [制作流程](references/pipeline.md)。模板不会预填上一首歌曲。

## 范围与验证

模板支持双谱表、和弦、休止符、常见时值、升降号和单段延音连线。复杂多声部、反复结构、连音链、三连音、变速及超长曲谱需要按素材扩展，不能简化后宣称完整还原。

已用不同曲名、3/4 拍、降号、和弦及延音的测试输入完成渲染；验证了 MIDI 映射、逐帧取景、最终音轨同步和清理路径边界。此验证不意味着任意歌曲都可无需核验直接转换。

本仓库不附带歌曲曲谱、商业录音、演出视频或钢琴采样文件。素材与依赖各自的许可条件仍适用；音色获取及署名要求见 [素材说明](references/materials.md)。
