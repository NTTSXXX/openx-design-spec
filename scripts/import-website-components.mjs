import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// Use the website's installed toolchain and actual entries. No component copies
// or business source edits are maintained in the specification.
const spec = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const website = path.resolve(process.argv[2] || path.join(spec, '../openx-website'));
// Freeze the revision once. Another website task may commit while this build is
// running; every HTML, source hash and public resource must refer to this SHA.
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: website, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid website commit');
process.env.NODE_ENV = 'production';
const output = path.join(spec, 'site-components');
const staging = path.resolve(spec, '../work/openx-design-spec/site-component-build');
if (path.relative(spec, output).startsWith('..') || path.basename(output) !== 'site-components') throw new Error('Invalid build output');
await fs.mkdir(staging, { recursive: true });
// Each invocation gets an immutable source tree, so simultaneous website edits
// cannot leak through CSS loading, imports or post-build manifest reads.
const frozen = await fs.mkdtemp(path.join(staging, 'website-source-'));
const archive = execFileSync('git', ['archive', '--format=tar', sha, 'src'], { cwd: website, maxBuffer: 256 * 1024 * 1024 });
execFileSync('tar', ['-xf', '-', '-C', frozen], { input: archive, maxBuffer: 16 * 1024 * 1024 });
const requireWebsite = createRequire(path.join(website, 'package.json'));
const packages = JSON.parse(execFileSync('git', ['show', `${sha}:package.json`], { cwd: website, encoding: 'utf8' }));
const { build } = await import(pathToFileURL(requireWebsite.resolve('vite')));
const { default: react } = await import(pathToFileURL(requireWebsite.resolve('@vitejs/plugin-react')));
const publicRoot = path.join(frozen, 'public');
const trackedPublic = new Set(execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', sha, '--', 'public'], { cwd: website }).toString('utf8').split('\0').filter(Boolean).map(file => file.replace(/^public\//, '')));
// Vite needs the public filename index to rewrite root CSS URLs with base './'.
// It does not copy public assets (copyPublicDir:false); empty index files prevent
// it from observing live public content. Selected output files are fetched below
// from the frozen Git objects, never from these metadata-only placeholders.
await fs.mkdir(publicRoot, { recursive: true });
for (const file of trackedPublic) {
  const target = path.join(publicRoot, file);
  if (path.relative(publicRoot, target).startsWith('..')) throw new Error('Invalid public resource');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, '');
}
const entries = {
  'account.html': 'account.tsx',
  'account-wallet.html': 'accountWallet.tsx',
  'account-profile.html': 'accountProfile.tsx',
  'account-security.html': 'accountSecurity.tsx',
  'account-prefs.html': 'accountPrefs.tsx',
  'account-verification.html': 'accountArea.tsx',
  'account-tier.html': 'accountArea.tsx',
  'account-benefits.html': 'accountArea.tsx',
  'account-indicators.html': 'accountArea.tsx',
  'account-exchanges.html': 'accountArea.tsx',
  'account-api.html': 'accountArea.tsx',
};
const relative = file => './' + path.relative(staging, file).split(path.sep).join('/');
const runtime = await fs.readFile(path.join(spec, 'scripts/website-sample-runtime.js'), 'utf8');
await fs.writeFile(path.join(staging, 'spec-runtime.js'), runtime);
for (const [html, entry] of Object.entries(entries)) {
  const original = execFileSync('git', ['show', `${sha}:${html}`], { cwd: website, encoding: 'utf8' });
  const script = `import './spec-runtime.js';\nimport { seedDemoSession } from ${JSON.stringify(relative(path.join(frozen, 'src/auth/authMock.ts')))};\nseedDemoSession();\nawait import(${JSON.stringify(relative(path.join(frozen, 'src', entry)))});\n`;
  // Dynamic import ensures the storage adapter runs before auth/viewport modules.
  await fs.writeFile(path.join(staging, entry.replace('.tsx', '-' + html + '.js')), script);
  await fs.writeFile(path.join(staging, html), original.replace(/src="\/src\/[^"]+"/, `src="./${entry.replace('.tsx', '-' + html + '.js')}"`));
}
const sourceTexts = new Map();
const resources = new Set(['assets/fonts', 'assets/brand/canonical', 'assets/account/overview-vip-app', 'assets/crypto', 'assets/social-mono']);
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => walk(child, visit)); else if (value && typeof value === 'object') walk(value, visit);
}
await build({
  configFile: false, root: staging, base: './', publicDir: publicRoot,
  plugins: [react(), {
    name: 'openx-spec-website-adapter',
    transform(code, id) {
      const source = id.split('?')[0];
      if (source.startsWith(frozen + path.sep) || source.startsWith(frozen.split(path.sep).join('/') + '/')) {
        if (!source.includes('node_modules')) sourceTexts.set(source, code);
      }
      for (const match of code.matchAll(/assets\/[A-Za-z0-9_./@%+\-]+/g)) resources.add(match[0].replace(/[.,]+$/, ''));
      return null;
    },
    renderChunk(code) {
      const replacements = [];
      walk(this.parse(code), node => {
        if (node.type === 'Literal' && typeof node.value === 'string' && node.value.includes('/assets/')) {
          replacements.push({ start: node.start, end: node.end, text: `(${JSON.stringify(node.value)}).replaceAll("/assets/",new URL("./assets/",location.href).href)` });
        }
      });
      for (const change of replacements.sort((a, b) => b.start - a.start)) code = code.slice(0, change.start) + change.text + code.slice(change.end);
      return { code, map: null };
    },
  }],
  resolve: { alias: [{ find: '@', replacement: path.join(frozen, 'src') }, { find: /^tailwindcss$/, replacement: requireWebsite.resolve('tailwindcss/index.css') }, ...[...Object.keys(packages.dependencies), '@ant-design/icons-svg', 'qrcode'].map(name => ({ find: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=/|$)'), replacement: path.join(website, 'node_modules', name) }))] },
  build: { target: 'esnext', outDir: output, emptyOutDir: true, copyPublicDir: false, rollupOptions: { input: Object.fromEntries(Object.keys(entries).map(html => [html.replace('.html', ''), path.join(staging, html)])) } },
});

let copied = 0, bytes = 0;
const copiedFiles = new Set();
async function copyResource(relativePath) {
  relativePath = relativePath.replaceAll('\\', '/').replace(/\/+$/, '');
  if (relativePath === 'assets') return;
  if (relativePath.includes('..')) return;
  let matches = trackedPublic.has(relativePath) ? [relativePath] : [...trackedPublic].filter(file => file.startsWith(relativePath + '/'));
  if (!matches.length && relativePath.includes('/')) {
    relativePath = path.posix.dirname(relativePath);
    if (!relativePath.startsWith('assets/')) return;
    matches = [...trackedPublic].filter(file => file.startsWith(relativePath + '/'));
  }
  for (const file of matches) {
    if (copiedFiles.has(file)) continue;
    const dest = path.join(output, file);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const content = execFileSync('git', ['show', `${sha}:public/${file}`], { cwd: website, maxBuffer: 100 * 1024 * 1024 });
    await fs.writeFile(dest, content);
    copiedFiles.add(file); copied++; bytes += content.length;
  }
}
for (const resource of resources) await copyResource(resource);
// Sources inside CSS/JSON can reference additional assets by indirection.
for (const text of sourceTexts.values()) for (const match of text.matchAll(/assets\/[A-Za-z0-9_./@%+\-]+/g)) await copyResource(match[0].replace(/[.,]+$/, ''));
const sourceFiles = [];
for (const file of [...sourceTexts.keys()].sort()) {
  const content = await fs.readFile(file);
  sourceFiles.push({ file: path.relative(frozen, file).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(content).digest('hex') });
}
await fs.writeFile(path.join(output, 'source-manifest.json'), JSON.stringify({ websiteCommit: sha, builtAt: new Date().toISOString(), sourcePolicy: 'Website components, CSS, HTML and public resources frozen to one Git commit before build; live source and resource edits excluded', entries, sourceFiles, copiedResources: copiedFiles.size, storageNamespace: 'openx-design-spec:website-components:', network: 'Only public OKX GET ticker/instruments; all business writes blocked' }, null, 2) + '\n');
console.log(`Website components ready: ${Object.keys(entries).length} entries, ${sourceFiles.length} source files, ${copied} public resources (${(bytes / 1048576).toFixed(1)} MB)`);
