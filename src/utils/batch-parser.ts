/**
 * 一括インポート用のデータ型
 */
export interface ImportedSong {
  archiveUrl: string;
  title: string;
  artist?: string;
  startTime: string; // "mm:ss" or "ss"
  endTime?: string;   // "mm:ss" or "ss"
}

export interface BatchArchive {
  url: string;
  songs: ImportedSong[];
}

/**
 * Googleスプレッドシートの共有リンクをCSVエクスポート用URLに変換する
 */
export function convertGSheetUrlToCsv(url: string): string {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return url;
    const scrollId = match[1];
    
    // シートID (gid) が指定されている場合はそれも引き継ぐ
    const gidMatch = url.match(/gid=([0-9]+)/);
    const gid = gidMatch ? `&gid=${gidMatch[1]}` : '';
    
    return `https://docs.google.com/spreadsheets/d/${scrollId}/export?format=csv${gid}`;
  } catch {
    return url;
  }
}

/**
 * 簡易的なCSVパース処理
 * クォート囲み、カンマ区切りに対応
 */
export function parseCsv(csvText: string): string[][] {
  const lines: string[][] = [];
  const rows = csvText.split(/\r?\n/);
  
  for (const row of rows) {
    if (!row.trim()) continue;
    
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());
    lines.push(cells);
  }
  
  return lines;
}

/**
 * CSVデータ（二次元配列）を BatchArchive 型に変換する
 */
export function processImportedData(data: string[][]): BatchArchive[] {
  if (data.length < 2) return [];

  const headers = data[0].map(h => h.toLowerCase());
  
  // マッピングの特定
  const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
  
  const urlIdx = getIndex(['url', 'アーカイブ', '動画']);
  const titleIdx = getIndex(['title', '曲名', '楽曲']);
  const artistIdx = getIndex(['artist', '歌手', 'アーティスト']);
  const startIdx = getIndex(['start', '開始']);
  const endIdx = getIndex(['end', '終了']);

  if (urlIdx === -1 || titleIdx === -1 || startIdx === -1) {
    throw new Error('必須な列（URL、曲名、開始時間）が見つかりません。ヘッダーを確認してください。');
  }

  const songs: ImportedSong[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length <= Math.max(urlIdx, titleIdx, startIdx)) continue;
    
    const url = row[urlIdx];
    if (!url) continue;

    songs.push({
      archiveUrl: url,
      title: row[titleIdx],
      artist: artistIdx !== -1 ? row[artistIdx] : undefined,
      startTime: row[startIdx],
      endTime: endIdx !== -1 ? row[endIdx] : undefined,
    });
  }

  // アーカイブURLごとにグループ化
  const grouped = songs.reduce((acc, song) => {
    if (!acc[song.archiveUrl]) {
      acc[song.archiveUrl] = [];
    }
    acc[song.archiveUrl].push(song);
    return acc;
  }, {} as Record<string, ImportedSong[]>);

  return Object.entries(grouped).map(([url, songs]) => ({
    url,
    songs,
  }));
}
