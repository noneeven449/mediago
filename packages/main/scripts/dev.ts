import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import electron from "electron";
import * as esbuild from "esbuild";
import chokidar from "chokidar";
import {
  loadDotEnvRuntime,
  mainResolve,
  copyResource,
  isMac,
  isLinux,
  chmodResource,
} from "./utils";
import { external } from "./config";
import consola from "consola";

let electronProcess: ChildProcessWithoutNullStreams | null = null;

process.env.NODE_ENV = "development";
loadDotEnvRuntime();

async function copySource() {
  const path = "build/Release/better_sqlite3.node";

  copyResource([
    {
      from: mainResolve("node_modules/better-sqlite3", path),
      to: mainResolve("app", path),
    },
    {
      from: mainResolve("bin"),
      to: mainResolve("app/bin"),
    },
  ]);

  // 拷贝完成之后，在 mac 和 linux 下需要修改权限
  if (isMac || isLinux) {
    chmodResource(mainResolve("bin", process.platform));
  }
}

const buildConfig: esbuild.BuildOptions = {
  bundle: true,
  platform: "node",
  sourcemap: true,
  target: ["node20.9"],
  external,
  define: {
    // 开发环境中二进制可执行文件的路径
    __bin__: `"${mainResolve("bin", process.platform).replace(/\\/g, "\\\\")}"`,
  },
  plugins: [],
  outdir: mainResolve("app/build/main"),
  loader: { ".png": "file" },
};

function startElectron() {
  const args = ["--inspect=5858", mainResolve("app/build/main/index.js")];

  electronProcess = spawn(String(electron), args);

  electronProcess.stdout.on("data", (data) => {
    consola.log(String(data));
  });

  electronProcess.stderr.on("data", (data) => {
    consola.log(String(data));
  });
}

function restartElectron() {
  if (electronProcess && electronProcess.pid) {
    if (isMac) {
      spawn("kill", ["-9", String(electronProcess.pid)]);
    } else {
      process.kill(electronProcess.pid);
    }
    electronProcess = null;
    startElectron();
  }
}

async function start() {
  const mainContext = await esbuild.context({
    ...buildConfig,
    entryPoints: [mainResolve("src/index.ts")],
  });

  const preloadContext = await esbuild.context({
    ...buildConfig,
    entryPoints: [mainResolve("src/preload.ts")],
    platform: "browser",
  });

  const watcher = chokidar.watch("./src");
  watcher.on("change", async () => {
    await mainContext.rebuild();
    await preloadContext.rebuild();
    consola.log("watch build succeed.");
    restartElectron();
  });

  try {
    await mainContext.rebuild();
    await preloadContext.rebuild();
    await copySource();
    await startElectron();
  } catch (e) {
    console.error(e);
    process.exit();
  }
}

start();
