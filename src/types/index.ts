// ===== データベースモデル =====

export interface Production {
  id: number;
  name: string;
  link: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Vtuber {
  id: number;
  name: string;
  gender: '男性' | '女性' | 'その他' | '不明' | null;
  link: string | null;
  production_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  vtubers?: Vtuber;
}

export interface Video {
  id: number;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string | null;
  // 新規追加
  channel_record_id: number | null;
  description: string | null;
  thumbnail: string | null;
  duration: number; // 秒数
  is_stream: boolean;
  is_publish: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  channels?: Channel;
}

export interface MasterSong {
  id: number;
  title: string;
  artist: string;
  artwork_url: string | null;
  itunes_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
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
  updated_at: string;
  updated_by: string | null;
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
  isStream: boolean;
  duration: number;
  description: string;
}

// ===== フォーム =====

export interface SongFormData {
  startTime: string;  // "mm:ss" 形式
  endTime: string;    // "mm:ss" 形式
}
