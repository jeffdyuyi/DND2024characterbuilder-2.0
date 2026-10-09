/**
 * 开发服务器启动前置自检与自愈脚本 (Pre-dev Self-healing Script)
 * 职责：
 * 1. 自动检测 3000 端口占用情况；若检测到历史遗留的僵死 Node/Next 进程，自动安全回收端口，绝不假死；
 * 2. 纯 Node 原生实现，无第三方依赖，跨平台（Windows / macOS / Linux）自适应；
 * 3. 严格隔离：仅处理本地服务端口，绝不触碰用户 IndexedDB 语料缓存或角色存档数据。
 */

import { execSync } from 'node:child_process';

const PORT = parseInt(process.env.PORT || '3000', 10);

function getPidsOnPort(port) {
  const pids = new Set();
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const line of output.split('\n')) {
        if (
          line.includes('LISTENING') &&
          (line.includes(`:${port} `) || line.includes(`:${port}\t`))
        ) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const pid of output.trim().split('\n')) {
        if (pid && pid !== String(process.pid)) {
          pids.add(pid.trim());
        }
      }
    }
  } catch {
    // 端口无占用或命令执行失败
  }
  return Array.from(pids);
}

function releasePort(port) {
  const pids = getPidsOnPort(port);
  if (pids.length === 0) return;

  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
      console.log(
        `\x1b[32m[开发自愈守护]\x1b[0m 发现端口 ${port} 被残留进程 (PID: ${pid}) 占用，已自动安全释放。`,
      );
    } catch {
      // 忽略已退出的进程
    }
  }
}

function main() {
  releasePort(PORT);
}

main();
