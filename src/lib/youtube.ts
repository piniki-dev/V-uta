import type { YouTubeVideoMetadata } from '@/types';

/**
 * YouTube URL から動画IDを抽出する
 * 対応フォーマット:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/live/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // 動画ID直接入力の場合
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * YouTube Data API v3 で動画メタデータを取得する
 */
export async function fetchVideoMetadata(
  videoId: string
): Promise<YouTubeVideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY が設定されていません');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`YouTube API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const snippet = data.items[0].snippet;

  return {
    videoId,
    title: snippet.title,
    channelId: snippet.channelId,
    channelName: snippet.channelTitle,
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      '',
    publishedAt: snippet.publishedAt,
  };
}
