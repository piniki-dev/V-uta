/**
 * 秒数を "m:ss" または "h:mm:ss" 形式に変換
 */
export function formatTime(sec: number): string {
  if (sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 秒数を常に "HH:mm:ss" 形式に変換
 */
export function formatTimeFull(sec: number): string {
  if (sec < 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}


/**
 * "mm:ss" または "hh:mm:ss" を秒に変換
 */
export function parseTime(time: string): number | null {
  // HH:MM:SS or H:MM:SS
  const hmsMatch = time.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1], 10);
    const m = parseInt(hmsMatch[2], 10);
    const s = parseInt(hmsMatch[3], 10);
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }

  // MM:SS or M:SS
  const msMatch = time.match(/^(\d{1,3}):(\d{2})$/);
  if (msMatch) {
    const m = parseInt(msMatch[1], 10);
    const s = parseInt(msMatch[2], 10);
    if (s >= 60) return null;
    return m * 60 + s;
  }

  return null;
}

/**
 * チャンネルの安全かつ綺麗な URL パスを取得する
 * - 英数字ハンドルの場合は /channels/@handle (生の @ 表記)
 * - 日本語/非ASCIIハンドルの場合は /channels/ID (数値 ID パス)
 */
export function getChannelUrl(channel: { id: number; handle?: string | null }): string {
  if (channel.handle) {
    const handleWithAt = channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`;
    if (/^@[a-zA-Z0-9_-]+$/.test(handleWithAt)) {
      return `/channels/${handleWithAt}`;
    }
  }
  return `/channels/${channel.id}`;
}

/**
 * 開始時間と曲の長さ(ITunes)から自動計算される終了時間を算出する。
 * アーカイブ(動画)の最大再生時間が指定されている場合、それを超えないようにクランプする。
 */
export function calculateAutoEndTimeSec(
  startSec: number,
  trackDurationSec: number,
  maxVideoDurationSec?: number
): number {
  const rawEndSec = startSec + trackDurationSec;
  if (maxVideoDurationSec && maxVideoDurationSec > 0 && rawEndSec > maxVideoDurationSec) {
    return maxVideoDurationSec;
  }
  return rawEndSec;
}

