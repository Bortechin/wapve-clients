import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  copyFile(
    require.resolve('@sapphi-red/web-noise-suppressor/gtcrn.wasm'),
    join(outputDirectory, 'gtcrn.wasm'),
  ),
  copyFile(
    require.resolve('@sapphi-red/web-noise-suppressor/gtcrnWorklet.js'),
    join(outputDirectory, 'gtcrn-worklet.js'),
  ),
  copyFile(
    require.resolve('@sapphi-red/web-noise-suppressor/noiseGateWorklet.js'),
    join(outputDirectory, 'noise-gate-worklet.js'),
  ),
]);
