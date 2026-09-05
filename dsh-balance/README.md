# dsh-balance

DeepSeek Harness 插件：在 Web 界面**侧边栏底部实时显示 DeepSeek 账户余额**。

点击余额胶囊会弹出详情（总余额 / 赠送余额 / 充值余额 / 可用状态），支持手动刷新；
每 60 秒自动刷新一次。API Key 只存在 host 端（通过 `ctx.credentials` 读取
`DEEPSEEK_API_KEY`），浏览器端只拿到余额 JSON，不会泄露密钥。

## 安装

```powershell
# 1. 安装 pnpm（dsh plugin 命令转发给 pnpm）
npm i -g pnpm

# 2. 安装插件到 web profile（会自动加入 dsh.profile.bundles）
dsh plugin --profile web add <本目录的绝对路径>

# 3. 重启 dsh web（或桌面客户端重新打开）
```

> 前提：`~/.dsh/.credentials.yaml` 里已配置 `DEEPSEEK_API_KEY`（Web 界面 设置 → 模型 里填写即可）。

## 工作原理

- **host 端**（`lib/index.js`）：注册精确 HTTP 路由 `/dsh-balance`，通过凭据服务解析
  `DEEPSEEK_API_KEY`，代理调用 [DeepSeek 余额 API](https://api-docs.deepseek.com/api/get-user-balance/)，
  带 30 秒内存缓存。
- **client 端**（`lib/client.js`）：注册到 `sidebar.footer.action` 插槽（列表型），
  组件用 `fetch("/dsh-balance")` 拉取数据，`setInterval` 每 60s 刷新。

## 卸载

```powershell
dsh plugin --profile web remove dsh-balance
```

## 许可证

MIT
