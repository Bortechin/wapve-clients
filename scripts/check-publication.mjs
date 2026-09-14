import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Check tracked content; generated local keys and build artifacts must stay ignored.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const blocked = files.filter((file) =>
  /^(?:apps\/api\/|deploy\/|\.tools\/|\.tmp\/|output\/|HAFIZA\.md$|compose[^/]*$|Dockerfile$)/u.test(file)
  || /(?:^|\/)(?:node_modules|secrets|\.git)(?:\/|$)/u.test(file)
  || /(?:^|\/)\.env(?:\..*)?$/u.test(file) && !file.endsWith('/.env.example') && file !== '.env.example'
  || /\.(?:jks|keystore|pem|key|p12|pfx|apk|aab|exe|tar|tgz|zip)$/u.test(file)
  || /(?:^|\/)(?:google-services\.json|local\.properties)$/u.test(file));
for (const file of files.filter((name) => /(?:^|\/)package\.json$/u.test(name))) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (pkg.name === '@wapve/api') blocked.push(file);
  for (const deps of [pkg.dependencies, pkg.devDependencies]) {
    if (deps?.['@wapve/api']) blocked.push(file);
  }
}
if (!files.length || blocked.length) {
  console.error('Publication boundary failed:', blocked);
  process.exit(1);
}
console.log(`Publication boundary passed for ${files.length} tracked files. Run Gitleaks separately.`);
