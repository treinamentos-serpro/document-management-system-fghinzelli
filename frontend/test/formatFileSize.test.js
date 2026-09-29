import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFileSize } from '../src/utils/formatFileSize.js';

test('formata tamanhos de arquivos consistentemente', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(1024), '1 KB');
  assert.equal(formatFileSize(10 * 1024 * 1024), '10 MB');
  assert.equal(formatFileSize(1024 ** 3), '1 GB');
});