import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['app', 'src'];
async function files(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await files(path));
    else if (entry.isFile() && path.endsWith('.tsx')) output.push(path);
  }
  return output;
}

for (const root of roots) {
  for (const path of await files(root)) {
    if (path.endsWith(join('components', 'localized-native.tsx'))) continue;
    let source = await readFile(path, 'utf8');
    let localized = [];
    source = source.replace(/import\s*\{([^}]*)\}\s*from 'react-native';/gu, (full, inside) => {
      const names = inside.split(',').map((value) => value.trim()).filter(Boolean);
      const moved = names.filter((name) => ['Text', 'TextInput', 'Modal', 'Alert', 'Pressable', 'Switch'].includes(name));
      if (!moved.length) return full;
      localized = [...new Set([...localized, ...moved])];
      const retained = names.filter((name) => !moved.includes(name));
      return retained.length ? `import {\n  ${retained.join(',\n  ')},\n} from 'react-native';` : '';
    });
    if (!localized.length) continue;
    const localizedPattern = /import\s*\{([^}]*)\}\s*from '@\/components\/localized-native';/u;
    const existing = localizedPattern.exec(source);
    if (existing) {
      const names = (existing[1] ?? '').split(',').map((value) => value.trim()).filter(Boolean);
      const merged = [...new Set([...names, ...localized])];
      source = source.replace(localizedPattern, `import { ${merged.join(', ')} } from '@/components/localized-native';`);
    } else {
      const insertion = `import { ${localized.join(', ')} } from '@/components/localized-native';\n`;
      source = source.startsWith("import 'react-native-gesture-handler';\n")
        ? source.replace("import 'react-native-gesture-handler';\n", `import 'react-native-gesture-handler';\n${insertion}`)
        : insertion + source;
    }
    await writeFile(path, source, 'utf8');
  }
}
