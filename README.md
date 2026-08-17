# DeepSeek Harness Desktop

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面（`dsh web`，默认 http://127.0.0.1:3080）
包装成 Windows 桌面应用的 Electron 外壳：双击图标即可启动，无需手动开命令行，体验与 Codex 桌面版一致。

> 非官方项目。DeepSeek Harness 及其 CLI（`@deepseek-ai/dsh`）均为 [MIT](LICENSE.dsh) 许可。

## 特性

- **一键启动**：双击图标 → 自动在后台启动 `dsh web` → 弹出桌面窗口
- **智能复用**：3080 端口已有 dsh 服务时直接连接，不会重复启动
- **系统托盘**：关窗最小化到托盘；托盘菜单可重新打开窗口 / 在浏览器打开 / 退出
- **退出即停服**：从托盘"退出"时，自动关闭由本应用启动的 dsh 服务（不影响你自己启动的）
- **日志**：`%APPDATA%\DeepSeek Harness Desktop\logs\desktop.log`（调试用）

## 下载 / 安装

- 到 [Releases](../../releases) 下载最新的 `DeepSeek-Harness-Desktop-win32-x64.zip`
- 解压后运行 `install.ps1`（或直接双击 `DeepSeek Harness Desktop.exe`）
- **前置要求**：已安装 [Node.js](https://nodejs.org)（≥ 18），且能运行 `dsh`（`npm exec -y @deepseek-ai/dsh -- web` 可用即可）

## 从源码构建

```powershell
npm install            # 安装 electron + rcedit（首次会下载 Electron 二进制，较慢）
npm run icons          # 生成图标（build\icon.ico / icon.png / tray.png）
npm run build          # 打包到 %USERPROFILE%\dsh-build\DeepSeek Harness Desktop 并镜像到 dist\
npm run install        # 安装到 %LOCALAPPDATA%\Programs 并创建桌面/开始菜单快捷方式
npm run smoke          # 冒烟测试：自动拉起 dsh web(3199)、加载界面、自动退出
```

> **注意**：`build.ps1` 会把打包工作目录放在 `%USERPROFILE%\dsh-build`（纯 ASCII 路径）。
> 这是有意的：`rcedit` 在含非 ASCII 字符（如中文）的路径上会损坏 exe 的 manifest，
> 导致"并行配置不正确"无法启动。

国内网络较慢时，安装前可设置镜像加速 Electron 下载：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
```

## 工作原理

应用启动时：

1. 探测 `http://127.0.0.1:3080` —— 已有 dsh 服务则直接连接；
2. 否则自动查找 `@deepseek-ai/dsh` CLI（npx 缓存 / 全局安装），隐藏窗口执行
   `node ...\dsh\lib\bin.js web --port 3080`；
3. 端口就绪后在 Electron 窗口加载界面。

托盘"退出"只停掉**由本应用启动**的服务。

## 开发调试

```powershell
npm start               # 开发模式（需要本机 dsh 可用）
```

## 许可证

MIT，见 [LICENSE](LICENSE)。DeepSeek Harness 的许可证见 [LICENSE.dsh](LICENSE.dsh)。
