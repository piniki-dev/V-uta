// ===== iTunes Search API ユーティリティ =====

export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string; // アルバム名
  artworkUrl100: string;  // 100x100 アートワーク
  trackViewUrl: string;   // iTunes ストアへのリンク
  trackTimeMillis: number; // 曲の長さ（ミリ秒）
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesTrack[];
}

/**
 * iTunes Search API で楽曲を検索する
 * @param query - 検索クエリ（曲名、アーティスト名など）
 * @param limit - 最大取得件数（デフォルト: 10）
 * @returns 検索結果の楽曲リスト
 */
export async function searchTracks(query: string, limit = 10): Promise<ITunesTrack[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    country: 'jp',
    lang: 'ja_jp',
    limit: String(limit),
  });

  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    next: { revalidate: 60 }, // 1分間キャッシュ
  });

  if (!res.ok) {
    throw new Error(`iTunes API error: ${res.status}`);
  }

  const data: ITunesSearchResponse = await res.json();
  return data.results;
}

/**
 * アートワークURLを高解像度に変換する
 * iTunes API はデフォルトで 100x100 を返すが、URLの数値部分を変更すれば任意サイズを取得可能
 */
export function getHighResArtwork(artworkUrl100: string, size = 300): string {
  return artworkUrl100.replace('100x100', `${size}x${size}`);
}
