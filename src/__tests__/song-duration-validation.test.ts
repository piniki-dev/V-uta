import { describe, it, expect } from 'vitest';
import { parseTime } from '@/lib/utils';

describe('曲登録の終了時間バリデーションテスト', () => {
  it('終了時間がアーカイブの長さ（duration）を超えている場合に検知できること', () => {
    const videoDuration = 180; // 3分 = 180秒
    const validEndTimeStr = '02:50'; // 170秒
    const invalidEndTimeStr = '03:10'; // 190秒

    const validEndSec = parseTime(validEndTimeStr);
    const invalidEndSec = parseTime(invalidEndTimeStr);

    expect(validEndSec).not.toBeNull();
    expect(invalidEndSec).not.toBeNull();

    expect(validEndSec! <= videoDuration).toBe(true);
    expect(invalidEndSec! > videoDuration).toBe(true);
  });
});
