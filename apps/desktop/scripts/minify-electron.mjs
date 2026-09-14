import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '..', 'dist-electron');
const scriptExtensions = new Set(['.cjs', '.js', '.mjs']);

for (const filePath of await collectScripts(outputDirectory)) {
  const source = await readFile(filePath, 'utf8');
  const result = await minify(source, {
    module: path.extname(filePath) !== '.cjs',
    compress: { passes: 2, drop_debugger: true },
    mangle: { toplevel: true },
    format: { comments: false },
    sourceMap: false,
  });
  if (!result.code) throw new Error(`Minification produced no output for ${filePath}`);
  await writeFile(filePath, `${result.code}\n`, 'utf8');
}

async function collectScripts(directory) {
  const scripts = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scripts.push(...(await collectScripts(entryPath)));
    else if (entry.isFile() && scriptExtensions.has(path.extname(entry.name)))
      scripts.push(entryPath);
  }
  return scripts.sort();
}
