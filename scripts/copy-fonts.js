import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '..', 'server', 'fonts');
const targetDir = path.join(__dirname, '..', 'dist', 'fonts');

console.log('[Build] Copying fonts from', sourceDir, 'to', targetDir);

if (!fs.existsSync(sourceDir)) {
  console.error('[Build] Source fonts directory does not exist:', sourceDir);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(sourceDir);
files.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[Build] Copied ${file}`);
});

console.log(`[Build] Successfully copied ${files.length} font files`);
