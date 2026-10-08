import {test, expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFile, unlink} from 'node:fs/promises';

test('development server denies direct access to private backend files', async ({request}) => {
  const name = 'privacy-check-' + randomUUID() + '.sqlite3';
  const databasePath = fileURLToPath(new URL('../backend/' + name, import.meta.url));
  await writeFile(databasePath, 'Private storage test fixture');
  try {
    for (const pathname of [
      '/backend/server.py', '/backend/document_service.py?raw', '/backend/document_service.py?url',
      '/backend/' + name, '/backend/' + name + '?raw',
      '/@fs/' + databasePath.replaceAll('\\', '/'),
    ]) {
      const response = await request.head(pathname);
      expect(response.status(), pathname).toBe(403);
    }
  } finally {
    await unlink(databasePath);
  }
  expect((await request.head('/pasion-logo.png')).status()).toBe(200);
});
