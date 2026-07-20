import { describe, it, expect } from 'vitest';
import { parseTime, calculateAutoEndTimeSec } from '@/lib/utils';

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

  describe('calculateAutoEndTimeSec (自動計算終了時間の上限補正)', () => {
    it('曲の長さが動画の再生時間を超える場合、動画の再生時間を上限として返すこと', () => {
      const startSec = 0;
      const songDuration = 180; // 3分 (原曲)
      const videoDuration = 120; // 2分 (ショート動画アーカイブ)

      const calculated = calculateAutoEndTimeSec(startSec, songDuration, videoDuration);
      expect(calculated).toBe(120); // 動画の再生時間でクランプされる
    });

    it('開始時間 + 曲の長さが動画の再生時間内に収まる場合、そのままの終了時間を返すこと', () => {
      const startSec = 10;
      const songDuration = 90; // 1分30秒
      const videoDuration = 120; // 2分

      const calculated = calculateAutoEndTimeSec(startSec, songDuration, videoDuration);
      expect(calculated).toBe(100);
    });

    it('動画再生時間が指定されていない場合はクランプせずそのままの終了時間を返すこと', () => {
      const startSec = 0;
      const songDuration = 180;

      const calculated = calculateAutoEndTimeSec(startSec, songDuration);
      expect(calculated).toBe(180);
    });
  });
});

