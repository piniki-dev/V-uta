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
 * @param country - 検索地域 (デフォルト: 'jp')
 * @param lang - 言語コード (デフォルト: 'ja_jp')
 * @returns 検索結果の楽曲リスト
 */
export async function searchTracks(
  query: string, 
  limit = 10, 
  country = 'jp', 
  lang = 'ja_jp'
): Promise<ITunesTrack[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    country: country,
    lang: lang,
    limit: String(limit),
  });

  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    next: { revalidate: 3600 }, // キャッシュ（1時間）
  });

  if (!res.ok) {
    throw new Error(`iTunes API error: ${res.status}`);
  }

  const data: ITunesSearchResponse = await res.json();
  return data.results;
}

/**
 * 指定された iTunes ID の楽曲情報を取得する
 * @param trackId - iTunes Track ID
 * @param country - 取得地域
 * @param lang - 言語コード
 */
export async function getTrackById(
  trackId: number | string,
  country = 'jp',
  lang = 'ja_jp'
): Promise<ITunesTrack | null> {
  const params = new URLSearchParams({
    id: String(trackId),
    country: country,
    lang: lang,
  });

  const res = await fetch(`https://itunes.apple.com/lookup?${params.toString()}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  const data: ITunesSearchResponse = await res.json();
  return data.results.length > 0 ? data.results[0] : null;
}

/**
 * アートワークURLを高解像度に変換する
 * iTunes API はデフォルトで 100x100 を返すが、URLの数値部分を変更すれば任意サイズを取得可能
 */
export function getHighResArtwork(artworkUrl100: string, size = 300): string {
  return artworkUrl100.replace('100x100', `${size}x${size}`);
}
