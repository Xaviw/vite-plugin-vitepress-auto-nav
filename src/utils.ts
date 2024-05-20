import { spawn } from "child_process";
import { utimesSync } from "fs";
import { stat } from "fs/promises";
import { cache } from "./index";
import type { Frontmatter, Item, ItemCacheOptions } from "../types";

/** 节流 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
) {
  let lastExecTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const currentTime = Date.now();
    const timeSinceLastExec = currentTime - lastExecTime;

    if (timeSinceLastExec >= delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - timeSinceLastExec);
    }
  };
}

/**
 * 获取git时间戳
 * @param absolutePath - 需要是绝对路径，与cache中对应
 */
export async function getTimestamp(absolutePath: string, isFolder: boolean) {
  const cacheData = cache[absolutePath];
  if (cacheData) {
    // 根据文件、文件夹更新时间判断是否需要重新获取信息
    const currentMTime = (await stat(absolutePath)).mtimeMs;
    if (currentMTime === cacheData.options.modifyTime) {
      const { birthTime, modifyTime, firstCommitTime, lastCommitTime } =
        cacheData.options;
      return { birthTime, modifyTime, firstCommitTime, lastCommitTime };
    }
  }
  const { birthtimeMs: birthTime, mtimeMs: modifyTime } = await stat(
    absolutePath
  );
  return new Promise<{
    birthTime?: number;
    modifyTime?: number;
    firstCommitTime?: number;
    lastCommitTime?: number;
  }>(async (resolve) => {
    if (isFolder) {
      resolve({ birthTime, modifyTime });
      return;
    }

    let output: number[] = [];

    // 开启子进程执行git log命令
    const child = spawn("git", [
      "--no-pager",
      "log",
      '--pretty="%ci"',
      absolutePath,
    ]);

    // 监听输出流
    child.stdout.on("data", (d) => {
      const data = String(d)
        .split("\n")
        .map((item) => +new Date(item))
        .filter((item) => item);
      output.push(...data);
    });

    // 输出接受后返回
    child.on("close", async () => {
      if (output.length) {
        // 返回[发布时间，最近更新时间]

        resolve({
          lastCommitTime: +new Date(output[output.length - 1]),
          firstCommitTime: +new Date(output[0]),
          birthTime,
          modifyTime,
        });
      } else {
        // 没有提交记录时获取文件时间

        resolve({ birthTime, modifyTime });
      }
    });

    child.on("error", async () => {
      // 获取失败时使用文件时间

      resolve({ birthTime, modifyTime });
    });
  });
}

/** 强制重启开发服务器，实现刷新 */
export function forceReload(path: string) {
  // 修改配置文件系统时间戳，触发更新
  utimesSync(path, new Date(), new Date());
}

/** 辅助方法：从 frontmatter 以及 options 中获取实际使用的配置 */
export function getTargetOptionValue(
  frontmatter: Frontmatter,
  options: ItemCacheOptions,
  key: string
) {
  return frontmatter[`nav-${key}`] ?? frontmatter[key] ?? (options as any)[key];
}

/** 获取文件夹内子文件、文件夹最小和最大的 git 时间戳 */
export function getFolderCommitTimes(children: Item[]): {
  minFirstCommitTime?: number;
  maxLastCommitTime?: number;
} {
  let minFirstCommitTime: number | undefined;
  let maxLastCommitTime: number | undefined;

  for (const item of children) {
    if (item.isFolder) {
      const folderTimes = getFolderCommitTimes(item.children);
      minFirstCommitTime = Math.min(
        minFirstCommitTime ?? Infinity,
        folderTimes.minFirstCommitTime ?? Infinity
      );
      maxLastCommitTime = Math.max(
        maxLastCommitTime ?? 0,
        folderTimes.maxLastCommitTime ?? 0
      );
    } else {
      minFirstCommitTime = Math.min(
        minFirstCommitTime ?? Infinity,
        item.options.firstCommitTime ?? Infinity
      );
      maxLastCommitTime = Math.max(
        maxLastCommitTime ?? 0,
        item.options.lastCommitTime ?? 0
      );
    }
  }

  return {
    minFirstCommitTime:
      minFirstCommitTime === Infinity ? undefined : minFirstCommitTime,
    maxLastCommitTime: maxLastCommitTime === 0 ? undefined : maxLastCommitTime,
  };
}

/** 处理文件夹的 git 时间戳 */
export function updateCommitTimes(data: Item[]): void {
  for (const item of data) {
    if (item.isFolder) {
      updateCommitTimes(item.children);
      const folderTimes = getFolderCommitTimes(item.children);
      item.options.firstCommitTime = folderTimes.minFirstCommitTime;
      item.options.lastCommitTime = folderTimes.maxLastCommitTime;
    }
  }
}
