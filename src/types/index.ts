// ===== データベースモデル =====

export interface Video {
  id: number;
  video_id: string;
  title: string;
  channel_id: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string;
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
