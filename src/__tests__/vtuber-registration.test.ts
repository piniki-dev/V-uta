import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// 手動で .env.local を環境変数にロード
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = val;
    }
  }
}

import { searchVtubers, checkDuplicateVtuber, fetchChannelWithVideosFromDb } from '@/app/songs/new/actions';
import { getChannelsForStatic, getAllChannelsForStatic } from '@/app/channels/actions';

// トピックチャンネル判定ロジック関数
function detectTopicChannel(rawChannelName: string) {
  const isTopic = /(?:[-–—\s]\s*|\s+)(Topic|トピック)\s*$/i.test(rawChannelName);
  const cleanName = rawChannelName.replace(/(?:[-–—\s]\s*|\s+)(Topic|トピック)\s*$/i, '').trim();
  return { isTopic, cleanName };
}

describe('VTuber・チャンネル統合および登録系テストシナリオ', () => {

  describe('シナリオ 1: トピックチャンネル名判定・正規表現クリーニング', () => {
    it('NekomaShiroa - Topic から Topic を判定し、NekomaShiroa を抽出する', () => {
      const res = detectTopicChannel('NekomaShiroa - Topic');
      expect(res.isTopic).toBe(true);
      expect(res.cleanName).toBe('NekomaShiroa');
    });

    it('NekomaShiroa – Topic (エンダッシュ) を判定できる', () => {
      const res = detectTopicChannel('NekomaShiroa – Topic');
      expect(res.isTopic).toBe(true);
      expect(res.cleanName).toBe('NekomaShiroa');
    });

    it('猫魔しろあ - トピック (日本語トピック) を判定し、猫魔しろあ を抽出する', () => {
      const res = detectTopicChannel('猫魔しろあ - トピック');
      expect(res.isTopic).toBe(true);
      expect(res.cleanName).toBe('猫魔しろあ');
    });

    it('NekomaShiroa Topic (ハイフンなしスペースのみ) を判定できる', () => {
      const res = detectTopicChannel('NekomaShiroa Topic');
      expect(res.isTopic).toBe(true);
      expect(res.cleanName).toBe('NekomaShiroa');
    });

    it('通常のメインチャンネル名 (NekomaShiroa / 猫魔しろあ) は isTopic: false と判定される', () => {
      const res1 = detectTopicChannel('NekomaShiroa');
      expect(res1.isTopic).toBe(false);
      expect(res1.cleanName).toBe('NekomaShiroa');

      const res2 = detectTopicChannel('猫魔しろあ / Nekoma Shiroa');
      expect(res2.isTopic).toBe(false);
      expect(res2.cleanName).toBe('猫魔しろあ / Nekoma Shiroa');
    });
  });

  describe('シナリオ 2: VTuber 検索 (searchVtubers) と表記ゆれマッピング', () => {
    it('キャメルケース表記 NekomaShiroa で検索して DB の 猫魔しろあ / Nekoma Shiroa がヒットする', async () => {
      const res = await searchVtubers('NekomaShiroa');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBeGreaterThan(0);
        const matched = res.data.find(v => v.name.includes('猫魔しろあ'));
        expect(matched).toBeDefined();
      }
    });

    it('日本語名の一部 (しろあ) で検索して該当 VTuber がヒットする', async () => {
      const res = await searchVtubers('しろあ');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0].name).toContain('猫魔しろあ');
      }
    });

    it('チャンネルのハンドル (@nekomashiroa または nekomashiroa) で逆引きヒットする', async () => {
      const res = await searchVtubers('@nekomashiroa');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0].name).toContain('猫魔しろあ');
      }
    });

    it('存在しない VTuber 名の検索では空配列が返る', async () => {
      const res = await searchVtubers('NonExistentVtuberTest9999');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data).toEqual([]);
      }
    });
  });

  describe('シナリオ 3: 重複チェック (checkDuplicateVtuber)', () => {
    it('登録済みの VTuber 名 NekomaShiroa で完全・類似一致 (exactMatch) が検出される', async () => {
      const res = await checkDuplicateVtuber('NekomaShiroa');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.exactMatch).not.toBeNull();
        expect(res.data.exactMatch?.name).toContain('猫魔しろあ');
      }
    });

    it('未登録の名前 NewTestVtuberX でチェックすると exactMatch が null になる', async () => {
      const res = await checkDuplicateVtuber('NewTestVtuberX');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.exactMatch).toBeNull();
      }
    });
  });

  describe('シナリオ 4: チャンネルデータの統合取得 (fetchChannelWithVideosFromDb)', () => {
    it('メインチャンネル詳細データを取得し、動画一覧が取得されること', async () => {
      const res = await fetchChannelWithVideosFromDb('@nekomashiroa');
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.name).toContain('猫魔しろあ');
        expect(res.data.is_primary).toBe(true);
        expect(Array.isArray(res.data.videos)).toBe(true);
      }
    });
  });

  describe('シナリオ 5: チャンネル一覧取得の is_primary フィルタリング (getChannelsForStatic)', () => {
    it('getChannelsForStatic は is_primary = true のチャンネルのみを返す', async () => {
      const res = await getChannelsForStatic();
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        const nonPrimary = res.data.filter(c => c.is_primary === false);
        expect(nonPrimary.length).toBe(0);
      }
    });

    it('getAllChannelsForStatic はすべてのチャンネルを返す', async () => {
      const res = await getAllChannelsForStatic();
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.length).toBeGreaterThan(0);
      }
    });
  });

});
