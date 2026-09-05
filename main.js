// DeepSeek Harness Desktop — Electron shell.
// Spawns (or reuses) the `dsh web` server and shows it in a native window.
"use strict";

const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const APP_NAME = "DeepSeek Harness";
const SMOKE = process.env.DSH_DESKTOP_SMOKE === "1";
const WEB_URL = process.env.DSH_DESKTOP_URL || "http://127.0.0.1:3080";
const PORT = Number(new URL(WEB_URL).port || 3080);

if (process.env.DSH_DESKTOP_USERDATA) {
  app.setPath("userData", process.env.DSH_DESKTOP_USERDATA);
}

const logDir = process.env.DSH_DESKTOP_LOG_DIR || path.join(app.getPath("userData"), "logs");
const logFile = path.join(logDir, "desktop.log");
fs.mkdirSync(logDir, { recursive: true });

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  try {
    fs.appendFileSync(logFile, line + os.EOL);
  } catch (_) {
    /* logging must never crash the app */
  }
  console.log(line);
}

function fatal(msg) {
  log("FATAL: " + msg);
  if (SMOKE) {
    process.exit(2);
  } else {
    dialog.showErrorBox(APP_NAME, msg);
    app.exit(1);
  }
}

// ---------------------------------------------------------------------------
// dsh / node resolution
// ---------------------------------------------------------------------------
function findDshBin() {
  const hits = [];
  // 1) copies inside the npx cache (_npx/<hash>/node_modules/@deepseek-ai/dsh/lib/bin.js)
  const npxRoot = path.join(os.homedir(), "AppData", "Local", "npm-cache", "_npx");
  try {
    for (const hash of fs.readdirSync(npxRoot)) {
      const cand = path.join(npxRoot, hash, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
      if (fs.existsSync(cand)) hits.push({ p: cand, t: fs.statSync(cand).mtimeMs });
    }
  } catch (_) {}
  // 2) global npm install
  const globalCand = path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  if (fs.existsSync(globalCand)) hits.push({ p: globalCand, t: fs.statSync(globalCand).mtimeMs });
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.t - a.t);
  return hits[0].p;
}

function findNode() {
  return new Promise((resolve) => {
    execFile("where.exe", ["node"], { windowsHide: true }, (err, stdout) => {
      if (!err && stdout) {
        const first = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s && fs.existsSync(s));
        if (first) return resolve(first);
      }
      resolve("node"); // let PATH resolve it
    });
  });
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------
let serverChild = null; // set only when WE spawned the server
let startedByUs = false;
let quitting = false;
let windowUrl = WEB_URL; // token-carrying URL when the new dsh mints one

function pingServer(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(WEB_URL, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function spawnDsh(nodeBin, dshBin, args, cwd, stdioMode) {
  const child = spawn(nodeBin, [dshBin, "web", "--port", String(PORT), ...args], {
    cwd,
    windowsHide: true,
    stdio: stdioMode,
    env: { ...process.env },
  });
  child.startedAt = Date.now();
  return child;
}

/** Wire one dsh child's stdout/stderr/exit. Fast-fail on an unsupported flag triggers one retry without it. */
function attachDshChild(child, nodeBin, dshBin, cwd, stdioMode, noOpenTried) {
  if (child.stdout) {
    child.stdout.on("data", (d) => {
      const text = String(d);
      log("[dsh] " + text.trim());
      // capture the authenticated URL the server prints, e.g. http://127.0.0.1:3080/?token=...
      const m = text.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/);
      if (m) windowUrl = m[0];
    });
    child.stderr.on("data", (d) => log("[dsh:err] " + String(d).trim()));
  }
  child.on("exit", (code, signal) => {
    log(`dsh server exited (code=${code}, signal=${signal})`);
    if (serverChild === child) serverChild = null;
    if (startedByUs && !quitting && !SMOKE) {
      dialog.showErrorBox(APP_NAME, `dsh 服务意外退出 (code=${code})。\n\n请查看日志：${logFile}`);
    }
    // an ancient dsh without --no-open fails fast on the unknown flag — retry without it
    if (!quitting && noOpenTried && code !== null && code !== 0 && Date.now() - child.startedAt < 6000) {
      log("dsh may not support --no-open — retrying without it.");
      serverChild = spawnDsh(nodeBin, dshBin, [], cwd, stdioMode);
      attachDshChild(serverChild, nodeBin, dshBin, cwd, stdioMode, false);
    }
  });
}

async function ensureServer() {
  if (await pingServer()) {
    log(`dsh web already running at ${WEB_URL} — connecting to it.`);
    return { spawned: false };
  }

  const dshBin = findDshBin();
  if (!dshBin) {
    fatal(
      "找不到 DeepSeek Harness 的命令行工具 (@deepseek-ai/dsh)。\n\n请先在命令行运行一次：\n  npm exec -y @deepseek-ai/dsh -- web\n然后再启动本应用。"
    );
    return { spawned: false };
  }
  const nodeBin = await findNode();
  const cwd = app.getPath("home");
  const stdioMode = process.env.DSH_DESKTOP_STDIO === "inherit" ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"];

  // Newer dsh (>= 0.1.2-rc.1) authenticates the Web UI with a per-process token
  // and opens the default browser unless told otherwise. We spawn with
  // `--no-open` and load the token URL in our own window instead.
  const noOpenArgs = ["--no-open"];
  log(`spawning: ${nodeBin} ${dshBin} web --port ${PORT} --no-open  (cwd=${cwd})`);
  serverChild = spawnDsh(nodeBin, dshBin, noOpenArgs, cwd, stdioMode);
  attachDshChild(serverChild, nodeBin, dshBin, cwd, stdioMode, true);

  // wait for the port to come up
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (serverChild === null || serverChild.exitCode !== null) {
      fatal(`dsh 服务启动失败 (exit code=${serverChild?.exitCode})。\n\n请查看日志：${logFile}`);
      return { spawned: false };
    }
    if (await pingServer()) {
      log("dsh web is up.");
      // the token URL usually lands a moment after the port binds; give it time
      const tokenDeadline = Date.now() + 15_000;
      while (windowUrl === WEB_URL && Date.now() < tokenDeadline && serverChild !== null && serverChild.exitCode === null) {
        await new Promise((r) => setTimeout(r, 200));
      }
      log(`window url: ${windowUrl}`);
      return { spawned: true };
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  fatal(`等待 dsh web 服务启动超时 (${WEB_URL})。\n\n请查看日志：${logFile}`);
  return { spawned: false };
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let mainWindow = null;
let tray = null;
let lastLoadedUrl = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: "#0b0e14",
    icon: iconPath("icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Keep external links in the system browser; stay inside the app otherwise.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith(WEB_URL)) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  mainWindow.webContents.on("page-title-updated", (e, title) => {
    if (title && !title.includes("DeepSeek")) e.preventDefault();
  });

  mainWindow.on("close", (e) => {
    if (!quitting && !SMOKE) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  lastLoadedUrl = windowUrl;
  mainWindow.loadURL(windowUrl);
  mainWindow.webContents.on("did-finish-load", () => {
    log("window loaded.");
    // Connecting to an already-running server with no auth cookie yet lands on the
    // plain 401 page ("dsh web authentication required…") — surface clear guidance.
    if (!SMOKE && windowUrl === WEB_URL) {
      mainWindow.webContents
        .executeJavaScript("document.body ? document.body.innerText.slice(0, 200) : ''")
        .then((text) => {
          if (text && /authentication required/i.test(text)) {
            log("auth required while connecting to an existing server (no cookie in this window yet).");
            dialog.showMessageBox(mainWindow, {
              type: "warning",
              title: APP_NAME,
              message: "无法自动进入已运行的服务",
              detail:
                "3080 端口已有另一个 dsh 服务在运行，而本窗口还没有它的授权令牌。\n\n" +
                "解决办法：退出本应用后重新打开（由它自己启动服务即可正常使用）；" +
                "或先在有授权的浏览器里打开一次该服务。",
            });
          }
        })
        .catch(() => {});
    }
    if (SMOKE) {
      log("SMOKE_OK");
      setTimeout(() => app.quit(), 1500);
    }
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    log(`did-fail-load: ${code} ${desc}`);
    if (SMOKE) fatal(`页面加载失败: ${code} ${desc}`);
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  // a hidden-period server restart mints a new token URL — refresh to it
  if (windowUrl !== lastLoadedUrl) {
    lastLoadedUrl = windowUrl;
    mainWindow.loadURL(windowUrl);
  }
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (SMOKE) return;
  try {
    const img = nativeImage.createFromPath(iconPath("tray.png"));
    tray = new Tray(img.resize({ width: 16, height: 16 }));
    tray.setToolTip(APP_NAME);
    const menu = Menu.buildFromTemplate([
      { label: "打开 DeepSeek Harness", click: showMainWindow },
      { label: "在浏览器中打开", click: () => shell.openExternal(windowUrl) },
      { type: "separator" },
      { label: "退出", click: () => { quitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", showMainWindow);
  } catch (e) {
    log("tray unavailable: " + e.message);
  }
}

function iconPath(name) {
  const candidates = [
    path.join(__dirname, "build", name),
    path.join(process.resourcesPath || "", name),
    path.join(__dirname, name),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    app.setName(APP_NAME);
    const { spawned } = await ensureServer();
    startedByUs = spawned;
    createWindow();
    createTray();
    log(`ready. url=${windowUrl} spawned=${spawned}`);
    if (spawned && !SMOKE) {
      // if the server dies while the window is hidden, bring it back up
      const watch = setInterval(async () => {
        if (quitting) { clearInterval(watch); return; }
        if (!serverChild && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          const up = await pingServer();
          if (!up) {
            log("server gone while app idle — restarting.");
            const res = await ensureServer();
            if (res.spawned) startedByUs = true;
          }
        }
      }, 30_000);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });

  app.on("before-quit", () => {
    quitting = true;
  });

  app.on("will-quit", () => {
    if (serverChild && startedByUs) {
      log("stopping dsh server (spawned by us).");
      try { serverChild.kill(); } catch (_) {}
    }
  });

  // keep running in the tray — do not quit when the window closes
  app.on("window-all-closed", () => {});
}
