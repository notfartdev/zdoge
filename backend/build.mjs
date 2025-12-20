import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

// Build main entry point
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  format: 'esm',
  sourcemap: true,
  external: [
    // Don't bundle native modules and large dependencies
    'pg',
    'pg-native',
    'snarkjs',
    'circomlibjs',
    'ffjavascript',
    'express',
    'cors',
    'ws',
    'dotenv',
    'express-rate-limit',
  ],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`,
  },
});

// Copy SQL schema file if it exists
const schemaPath = join('src', 'database', 'schema.sql');
if (existsSync(schemaPath)) {
  const destDir = join('dist', 'database');
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  cpSync(schemaPath, join(destDir, 'schema.sql'));
}

console.log('✅ Build complete');

