import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appFiles = [
  '../src/app/page.tsx',
  '../src/app/settings/page.tsx',
  '../src/app/tools/page.tsx',
];

test('visible workbench copy should not mention GA-Go backend/service branding', () => {
  for (const rel of appFiles) {
    const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /GA-Go 后端|GA-Go 服务|from GA-Go backend|GA-Go 控制台/);
  }
});
