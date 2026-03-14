// ===== データベースモデル =====

export interface Production {
  id: number;
  name: string;
  link: string | null;
  created_at: string;
}

export interface Vtuber {
  id: number;
  name: string;
  gender: '男性' | '女性' | 'その他' | '不明' | null;
  link: string | null;
  production_id: number | null;
  created_at: string;
  productions?: Production;
}

export interface Channel {
  id: number;
  yt_channel_id: string;
  name: string;
  handle: string | null;
  description: string | null;
  image: string | null;
  vtuber_id: number | null;
  created_at: string;
  vtubers?: Vtuber;
}

export interface Video {
  id: number;
  video_id: string;
  title: string;
  channel_id: string | null; // YouTube ID (移行用)
  channel_name: string | null; // 移行用
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string;
  // 新規追加
  channel_record_id: number | null;
  description: string | null;
  thumbnail: string | null;
  duration: string | null;
  is_stream: boolean;
  channels?: Channel;
}

export interface MasterSong {
  id: number;
  title: string;
  artist: string;
  artwork_url: string | null;
  itunes_id: string | null;
  created_at: string;
}

export interface Song {
  id: number;
  video_id: number;
  master_song_id: number | null;
  start_sec: number;
  end_sec: number;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  // JOINされた場合に含まれる
  master_songs?: MasterSong;
}

/** Song + 親 Video 情報を含む結合型 */
export interface SongWithVideo extends Song {
  video: Video;
}

// ===== プレイヤー =====

export interface PlayerSong {
  id: number;
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  videoId: string;         // YouTube video ID
  startSec: number;
  endSec: number;
  channelName: string | null;
  thumbnailUrl: string | null;
  videoTitle: string | null;
}

export interface PlayerState {
  currentSong: PlayerSong | null;
  playlist: PlayerSong[];
  currentIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  volume: number;          // 0–100
  isMuted: boolean;
  currentTime: number;     // 区間内の現在再生位置（秒）
  isFullPlayerOpen: boolean;
}

// ===== YouTube API =====

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
}

// ===== フォーム =====

export interface SongFormData {
  startTime: string;  // "mm:ss" 形式
  endTime: string;    // "mm:ss" 形式
}
