import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// jest-dom のマッチャーを expect に拡張
expect.extend(matchers);

// 各テストの後にクリーンアップを実行
afterEach(() => {
  cleanup();
});
