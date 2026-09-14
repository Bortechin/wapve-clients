import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export const gameProcesses = [
  ['valorant', 'valorant-win64-shipping.exe'],
  ['league-of-legends', 'league of legends.exe'],
  ['counter-strike-2', 'cs2.exe'],
  ['dota-2', 'dota2.exe'],
  ['fortnite', 'fortniteclient-win64-shipping.exe'],
  ['pubg', 'tslgame.exe'],
  ['apex-legends', 'r5apex.exe'],
  ['rocket-league', 'rocketleague.exe'],
  ['overwatch-2', 'overwatch.exe'],
  ['minecraft', 'minecraft.windows.exe'],
  ['minecraft', 'minecraft.exe'],
] as const;

export function isMinecraftJava(verboseCsvOutput: string): boolean {
  return /minecraft/iu.test(verboseCsvOutput);
}

export function detectGame(output: string, current: string | null): string | null {
  const processes = new Set(output.split(/\r?\n/u).flatMap(line => {
    const match = /^"((?:[^"]|"")*)",/u.exec(line);
    return match?.[1] ? [match[1].replaceAll('""', '"').toLowerCase()] : [];
  }));
  const running = gameProcesses.filter(([, executable]) => processes.has(executable));
  return running.find(([id]) => id === current)?.[0] ?? running[0]?.[0] ?? null;
}

export async function readRunningGame(current: string | null): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  const tasklistPath = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tasklist.exe');
  const { stdout } = await execute(tasklistPath, ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 8_000, maxBuffer: 4 * 1024 * 1024 });
  const detected = detectGame(stdout, current);
  if (detected) return detected;

  // Check for Minecraft Java Edition (javaw.exe or java.exe with Minecraft window)
  const processes = new Set(stdout.split(/\r?\n/u).flatMap(line => {
    const match = /^"((?:[^"]|"")*)",/u.exec(line);
    return match?.[1] ? [match[1].replaceAll('""', '"').toLowerCase()] : [];
  }));
  if (processes.has('javaw.exe') || processes.has('java.exe')) {
    try {
      if (processes.has('javaw.exe')) {
        const { stdout: javaStdout } = await execute(tasklistPath, ['/FI', 'IMAGENAME eq javaw.exe', '/V', '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 3_000, maxBuffer: 1024 * 1024 });
        if (isMinecraftJava(javaStdout)) return 'minecraft';
      }
      if (processes.has('java.exe')) {
        const { stdout: javaStdout } = await execute(tasklistPath, ['/FI', 'IMAGENAME eq java.exe', '/V', '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 3_000, maxBuffer: 1024 * 1024 });
        if (isMinecraftJava(javaStdout)) return 'minecraft';
      }
    } catch {
      // Ignore filter error
    }
  }

  return null;
}
