import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distPath = path.resolve('./dist');

// 1. Ensure Vite has built the static assets
console.log('Building Vite Project...');
execSync('npm run build', { stdio: 'inherit' });

// 2. Create minimal package.json in dist
console.log('Generating minimal package.json for distribution...');
const minPackageJson = {
  name: "markdown-viewer",
  main: "index.html",
  version: "1.0.0",
  author: "Antigravity",
  description: "Antigravity Reader for Markdown",
  window: {
    title: "Antigravity Reader",
    width: 1280,
    height: 800,
    position: "center",
    icon: ""
  }
};
fs.writeFileSync(path.join(distPath, 'package.json'), JSON.stringify(minPackageJson, null, 2));

// 3. Build with nw-builder
console.log('Packaging NW.js Executable...');
try {
  // Use npx nwbuild to build targeting the dist folder
  // Mode build, Target Windows 64-bit
  // We touch a dummy icon to avoid validation error
  fs.writeFileSync(path.join(distPath, 'icon.ico'), '');
  minPackageJson.window.icon = 'icon.ico';
  fs.writeFileSync(path.join(distPath, 'package.json'), JSON.stringify(minPackageJson, null, 2));

  execSync('npx nwbuild --mode build --version 0.110.0 --flavor normal --glob false --outDir ../release .', { 
    cwd: distPath, 
    stdio: 'inherit' 
  });
  console.log('Build complete! Check the /release folder.');
} catch (e) {
  console.error('NW Builder failed. Make sure to run on a compatible environment.', e);
}
