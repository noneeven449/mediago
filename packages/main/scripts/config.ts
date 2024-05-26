import { Configuration } from "electron-builder";
import { Env, mainResolve } from "./utils";
import esbuild from "esbuild";

const external = [
  "electron",
  "nock",
  "aws-sdk",
  "mock-aws-s3",
  "@cliqz/adblocker-electron-preload",
  "node-pty",
  "better-sqlite3",
];

function getConfig(): esbuild.BuildOptions {
  const env = Env.getInstance().env;
  return {
    bundle: true,
    sourcemap: process.env.NODE_ENV === "development",
    external,
    define:
      process.env.NODE_ENV === "development"
        ? {
            // 开发环境中二进制可执行文件的路径
            __bin__: `"${mainResolve("app/bin").replace(/\\/g, "\\\\")}"`,
          }
        : {
            ...env,
            "process.env.NODE_ENV": '"production"',
          },
    outdir: mainResolve("app/build/main"),
    loader: { ".png": "file" },
    minify: process.env.NODE_ENV === "production",
  };
}

function buildOptions(
  entry: string,
  platform: esbuild.Platform,
  target: string,
): esbuild.BuildOptions {
  return {
    ...getConfig(),
    entryPoints: [mainResolve(entry)],
    platform: platform,
    target: [target],
  };
}

export function browserOptions(entry: string): esbuild.BuildOptions {
  return buildOptions(entry, "browser", "chrome89");
}

export function nodeOptions(entry: string): esbuild.BuildOptions {
  return buildOptions(entry, "node", "node16.13");
}

export function getReleaseConfig(): Configuration {
  return {
    productName: process.env.APP_NAME,
    buildVersion: process.env.APP_VERSION,
    appId: process.env.APP_ID,
    copyright: process.env.APP_COPYRIGHT,
    artifactName: "${productName}-setup-${arch}-${buildVersion}.${ext}",
    // FIXME: 这里屏蔽 node-pty 自动重构，因为会导致打包失败
    npmRebuild: true,
    directories: {
      output: "./release",
    },
    asarUnpack: [
      "**/better-sqlite3/build/Release/*.node",
      "**/node-pty/build/Release/**",
    ],
    files: [
      {
        from: "./build",
        to: "./",
      },
      "./package.json",
    ],
    extraResources: [
      {
        from: "./app/plugin",
        to: "plugin",
      },
      {
        from: "./app/bin/",
        to: "bin",
      },
    ],
    win: {
      icon: "../assets/icon.ico",
      target: [
        {
          target: "nsis",
          arch: ["x64"],
        },
      ],
    },
    dmg: {
      contents: [
        {
          x: 410,
          y: 150,
          type: "link",
          path: "/Applications",
        },
        {
          x: 130,
          y: 150,
          type: "file",
        },
      ],
    },
    mac: {
      icon: "../assets/icon.icns",
      target: {
        target: "dmg",
        arch: ["x64"],
      },
    },
    linux: {
      category: "Utility",
      icon: "../assets/icon.icns",
      maintainer: "caorushizi <84996057@qq.com>",
      target: {
        target: "deb",
        arch: ["x64"],
      },
    },
    nsis: {
      oneClick: true,
      allowElevation: true,
      allowToChangeInstallationDirectory: false,
      installerIcon: "",
      uninstallerIcon: "",
      installerHeaderIcon: "",
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: "",
      include: "",
      script: "",
    },
  };
}
