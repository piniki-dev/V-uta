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
  production?: Production; // 以前は productions
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
  vtuber?: Vtuber; // 以前は vtubers
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
  channel?: Channel; // 以前は channels
}

export interface MasterSong {
  id: number;
  title: string;
  artist: string;
  title_en: string | null;
  artist_en: string | null;
  artwork_url: string | null;
  itunes_id: string | null;
  duration_sec: number | null;
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
  master_song?: MasterSong; // 以前は master_songs
}

/** Song + 親 Video 情報を含む結合型 */
export interface SongWithVideo extends Song {
  video: Video;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  is_favorites: boolean;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  items?: PlaylistItem[];
}

export interface PlaylistItem {
  id: number;
  playlist_id: number;
  song_id: number;
  position: number;
  added_at: string;
  song?: Song & { master_song: MasterSong; video: Video }; // 以前は songs
}

// ===== プレイヤー =====

export type PipPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PlayerSong {
  id: number;
  title: string;
  artist: string | null;
  title_en: string | null;
  artist_en: string | null;
  artworkUrl: string | null;
  videoId: string;         // YouTube video ID
  startSec: number;
  endSec: number;
  channelName: string | null;
  channelThumbnailUrl: string | null;
  thumbnailUrl: string | null;
  videoTitle: string | null;
  playedAt?: string;    // ISO string for history
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
  videoRatio: string; // "16/9", "9/16" etc.
  videoRatioMode: 'auto' | '16/9' | '9/16';
  sourceType: string | null;
  sourceId: string | null;
  currentHistoryId: number | null;
  playSessionKey: number;
  pipPosition: PipPosition;
  isPrivacyMode: boolean;
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

export interface YouTubeChannelData {
  ytChannelId: string;
  name: string;
  handle: string;
  description: string;
  image: string;
  officialLink?: string;
}

// ===== フォーム =====

export interface SongFormData {
  startTime: string;  // "mm:ss" 形式
  endTime: string;    // "mm:ss" 形式
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: true; data?: never } // void の場合は data なしを許容
  | { success: false; error: string };

// ===== Search =====

export interface SearchSongItem {
  id: number;
  start_sec: number;
  end_sec: number;
  master_song?: { // 以前は master_songs
    title: string;
    artist: string;
    title_en: string | null;
    artist_en: string | null;
    artwork_url: string | null;
  };
  video?: { // 以前は videos
    video_id: string;
    title: string;
    thumbnail_url: string | null;
    channel?: { // 以前は channels
      name: string;
      image: string | null;
    };
  };
}
