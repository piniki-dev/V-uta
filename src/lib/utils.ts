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
