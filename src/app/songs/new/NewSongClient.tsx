"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from 'react';
import { fetchVideoPreview, registerVideo, registerSong, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel } from './actions';
import type { ITunesSearchResult } from './actions';
import type { YouTubeVideoMetadata, Video, Song, Production } from '@/types';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Search, X, Music, Info, Pencil, Save, Trash2, CheckCircle2, AlertCircle, UserPlus, Building2 } from 'lucide-react';
import { updateSong, deleteSong, updateSongMaster, searchSongForEdit } from '@/app/videos/[videoId]/edit/actions';
import { useSearchParams, useRouter } from 'next/navigation';
import { convertGSheetUrlToCsv, parseCsv, processImportedData, type BatchArchive, type ImportedSong } from '@/utils/batch-parser';
import { FileUp, Table, ChevronLeft, ChevronRight } from 'lucide-react';

/** 秒数を "mm:ss" に変換 */
function secondsToMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "mm:ss" を秒数に変換 */
function parseTimeToSeconds(time: string): number | null {
  const match = time.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

interface EditableSong {
  id?: number; // DB 登録済みの場合は ID がある
  song: Partial<Song> & { master_songs?: any }; // プレビュー用
  startTime: string;
  endTime: string;
  isEditing: boolean;
  isChangingSong: boolean;
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  isPersisted: boolean; // DB 保存済みか
  isDeleted?: boolean; // 削除フラグ（一括保存時に反映）
}

export default function NewSongClient() {
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get('url');
  const hasAutoFetched = useRef(false);

  // Step 1: URL 入力
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [video, setVideo] = useState<Video | null>(null);

  // Step 2: 曲検索・選択
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ITunesSearchResult[]>([]);
  const [selectedSong, setSelectedSong] = useState<ITunesSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Step 3: 区間入力
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // 統合された曲リスト（既存 + 新規）
  const [allSongs, setAllSongs] = useState<EditableSong[]>([]);

  // UI 状態
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // VTuber登録モーダル
  const [isVtuberModalOpen, setIsVtuberModalOpen] = useState(false);
  const [productions, setProductions] = useState<Production[]>([]);
  const [vtuberForm, setVtuberForm] = useState({
    name: '',
    gender: '不明' as any,
    link: '',
    productionId: '',
    newProductionName: '',
  });
  const [channelDataForReg, setChannelDataForReg] = useState<any>(null);

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    // 1. リスト内に未保存、削除予定、または編集中のものがある場合
    const hasUnsavedInList = allSongs.some(s => !s.isPersisted || s.isDeleted || s.isEditing);
    // 2. 現在新規追加フォームに入力中のものがある場合
    const hasActiveInput = !!selectedSong || !!startTime.trim() || !!endTime.trim() || !!searchQuery.trim();
    
    return hasUnsavedInList || hasActiveInput;
  }, [allSongs, selectedSong, startTime, endTime, searchQuery]);

  // 一括モード用
  const [batchArchives, setBatchArchives] = useState<BatchArchive[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [gsUrl, setGsUrl] = useState('');
  const isBatchMode = currentBatchIndex !== -1;

  // ブラウザのナビゲーション（タブ閉じ、戻る等）に対しても警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = ''; // ほとんどのブラウザで必要
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // バッチアイテムへの移動
  const navigateToBatchItem = (index: number) => {
    if (index < 0 || index >= batchArchives.length) return;

    if (hasChanges) {
      setPendingUrl(null); // URL遷移ではないことを示す
      setOnConfirmAction(() => () => {
        const item = batchArchives[index];
        setCurrentBatchIndex(index);
        setUrl(item.url);
        handleFetchVideo(item.url, index, batchArchives);
      });
      setIsModalOpen(true);
      return;
    }

    const item = batchArchives[index];
    setCurrentBatchIndex(index);
    setUrl(item.url);
    handleFetchVideo(item.url, index, batchArchives);
  };

  // 自動読み込み
  useEffect(() => {
    if (initialUrl && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      setUrl(initialUrl);
      // Fetch video immediately
      handleFetchVideo(initialUrl);
    }
  }, [initialUrl]);

  // 開始時間変更時に曲の長さから終了時間を自動入力
  useEffect(() => {
    if (!selectedSong || !startTime) {
      return;
    }
    const match = startTime.match(/^(\d{1,3}):(\d{2})$/);
    if (!match) return;
    const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
    if (isNaN(startSec) || selectedSong.durationSec <= 0) return;
    const endSec = startSec + selectedSong.durationSec;
    setEndTime(secondsToMmSs(endSec));
  }, [startTime, selectedSong]);

  const handleFetchVideo = (manualUrl?: string, batchIndex?: number, batchData?: BatchArchive[]) => {
    const targetUrl = manualUrl || url;
    if (!targetUrl.trim()) return;

    setError('');
    setSuccess('');
    startTransition(async () => {
      const result = await fetchVideoPreview(targetUrl);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMetadata(result.data.metadata);
      
      const convertedSongs: EditableSong[] = result.data.existingSongs.map(song => ({
        id: song.id,
        song,
        startTime: secondsToMmSs(song.start_sec),
        endTime: secondsToMmSs(song.end_sec),
        isEditing: false,
        isChangingSong: false,
        searchQuery: '',
        searchResults: [],
        isSearching: false,
        isPersisted: true,
      }));

      // バッチモードの場合、既存曲とインポートデータをマージ
      if (batchIndex !== undefined && batchIndex !== -1) {
        const dataToUse = batchData || batchArchives;
        const batchItem = dataToUse[batchIndex];
        
        if (batchItem) {
          const existingStartTimes = result.data.existingSongs.map(s => s.start_sec);
        
        const newBatchSongs: EditableSong[] = batchItem.songs
          .filter(s => {
            const startSec = parseTimeToSeconds(s.startTime);
            if (startSec === null) return true;
            // ±5秒以内の重複を回避
            return !existingStartTimes.some(existingSec => Math.abs(existingSec - startSec) <= 5);
          })
          .map((s: ImportedSong) => ({
            song: {
              master_songs: { title: s.title, artist: s.artist },
              start_sec: parseTimeToSeconds(s.startTime) || 0,
              end_sec: s.endTime ? parseTimeToSeconds(s.endTime) || 0 : 0
            } as any,
            startTime: s.startTime,
            endTime: s.endTime || '',
            isEditing: false,
            isChangingSong: true, // 曲検索を表示
            searchQuery: s.title,
            searchResults: [],
            isSearching: false,
            isPersisted: false,
          }));
          setAllSongs([...convertedSongs, ...newBatchSongs]);
        } else {
          setAllSongs(convertedSongs);
        }
      } else {
        setAllSongs(convertedSongs);
      }

      if (result.data.existingSongs.length > 0) {
        setSuccess('登録済みのアーカイブを取得しました。変更を加えられます。');
      }

      // チャンネル未登録の場合はモーダルを表示
      if (!result.data.isChannelRegistered && result.data.channelData) {
        setChannelDataForReg(result.data.channelData);
        setVtuberForm(prev => ({ 
          ...prev, 
          name: result.data.channelData.name,
          link: result.data.channelData.officialLink || ''
        }));
        
        // 事務所一覧を取得してモーダルを開く
        const prods = await getProductions();
        if (prods.success) {
          setProductions(prods.data);
        }
        setIsVtuberModalOpen(true);
        // ここで一旦止める（動画登録はVTuber登録後）
        return;
      }

      // 登録済みなら動画登録（冪等）
      const videoResult = await registerVideo(result.data.metadata);
      if (videoResult.success) {
        setVideo(videoResult.data);
      }
      setStep(2);
    });
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const csvData = parseCsv(text);
        const processed = processImportedData(csvData);
        if (processed.length === 0) {
          setError('有効なデータが見つかりませんでした。CSVのフォーマットを確認してください。');
          return;
        }
        setBatchArchives(processed);
        setCurrentBatchIndex(0);
        setUrl(processed[0].url);
        handleFetchVideo(processed[0].url, 0, processed);
      } catch (err: any) {
        setError(err.message || 'CSVの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  };

  const handleGsImport = async () => {
    if (!gsUrl.trim()) return;
    setError('');
    startTransition(async () => {
      try {
        const csvUrl = convertGSheetUrlToCsv(gsUrl);
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('スプレッドシートの取得に失敗しました。共有設定を確認してください。');
        const text = await response.text();
        const csvData = parseCsv(text);
        const processed = processImportedData(csvData);
        if (processed.length === 0) {
          setError('有効なデータが見つかりませんでした。スプレッドシートの内容を確認してください。');
          return;
        }
        setBatchArchives(processed);
        setCurrentBatchIndex(0);
        setUrl(processed[0].url);
        handleFetchVideo(processed[0].url, 0, processed);
      } catch (err: any) {
        setError(err.message || 'スプレッドシートの読み込みに失敗しました。');
      }
    });
  };

  const handleRegisterVtuber = async () => {
    if (!channelDataForReg) return;
    setError('');
    startTransition(async () => {
      const result = await registerVtuberAndChannel({
        vtuberName: vtuberForm.name,
        gender: vtuberForm.gender,
        vtuberLink: vtuberForm.link,
        productionId: (vtuberForm.productionId && vtuberForm.productionId !== 'new') ? Number(vtuberForm.productionId) : undefined,
        newProductionName: vtuberForm.productionId === 'new' ? vtuberForm.newProductionName : undefined,
        channelData: channelDataForReg,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setIsVtuberModalOpen(false);
      setSuccess(`${vtuberForm.name} さんとチャンネルを登録しました！`);
      
      // 改めて動画を登録
      if (metadata) {
        const videoResult = await registerVideo(metadata);
        if (videoResult.success) {
          setVideo(videoResult.data);
        }
        setStep(2);
      }
    });
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError('');
    try {
      const result = await searchSongAction(searchQuery);
      if (result.success) {
        setSearchResults(result.data);
      } else {
        setError(result.error);
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectSong = (track: ITunesSearchResult) => {
    setSelectedSong(track);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    setSelectedSong(null);
  };

  const handleRegisterSong = () => {
    setError('');
    if (!selectedSong || !startTime || !endTime) return;

    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);
    if (startSec === null || endSec === null || startSec >= endSec) {
      setError('時間の形式が正しくないか、終了時間が開始時間以前です');
      return;
    }

    const newSong: EditableSong = {
      song: {
        master_songs: {
          title: selectedSong.title,
          artist: selectedSong.artist,
          artwork_url: selectedSong.artworkUrl,
          itunes_id: String(selectedSong.trackId),
          duration_sec: selectedSong.durationSec,
        } as any,
        start_sec: startSec,
        end_sec: endSec,
      },
      startTime,
      endTime,
      isEditing: false,
      isChangingSong: false,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      isPersisted: false,
    };

    setAllSongs((prev) => [...prev, newSong]);
    setSuccess(`「${selectedSong.title}」をリストに追加しました。最後に一括保存してください。`);
    
    setSelectedSong(null);
    setSearchQuery('');
    setStartTime('');
    setEndTime('');
  };

  const handleSaveBatch = () => {
    if (!metadata) return;
    setError('');
    setSuccess('');

    startTransition(async () => {
      const songsToRegister = allSongs.map(item => ({
        id: item.id,
        songTitle: item.song.master_songs?.title || '',
        songArtist: item.song.master_songs?.artist || '',
        artworkUrl: item.song.master_songs?.artwork_url || '',
        itunesId: item.song.master_songs?.itunes_id || '',
        durationSec: item.song.master_songs?.duration_sec || 0,
        startSec: parseTimeToSeconds(item.startTime) || 0,
        endSec: parseTimeToSeconds(item.endTime) || 0,
        isDeleted: item.isDeleted,
      }));

      const result = await registerFullArchive({
        videoMetadata: metadata,
        songs: songsToRegister,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setVideo(result.data.video);
      const updatedSongs: EditableSong[] = result.data.songs.map(song => ({
        id: song.id,
        song,
        startTime: secondsToMmSs(song.start_sec),
        endTime: secondsToMmSs(song.end_sec),
        isEditing: false,
        isChangingSong: false,
        searchQuery: '',
        searchResults: [],
        isSearching: false,
        isPersisted: true,
      }));
      setAllSongs(updatedSongs);
      setSuccess('全ての変更を保存しました！');
    });
  };

  // ----- インライン編集機能 -----

  const toggleEdit = (index: number) => {
    setAllSongs((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              isEditing: !item.isEditing,
              isChangingSong: false,
              searchQuery: '',
              searchResults: [],
            }
          : item
      )
    );
  };

  const updateSongField = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setAllSongs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveSongLocal = (index: number) => {
    const item = allSongs[index];
    const s = parseTimeToSeconds(item.startTime);
    const e = parseTimeToSeconds(item.endTime);
    
    if (s === null || e === null || s >= e) {
      setError('時間の形式が正しくありません');
      return;
    }

    setAllSongs((prev) =>
      prev.map((it, i) =>
        i === index 
          ? { 
              ...it, 
              song: { ...it.song, start_sec: s, end_sec: e }, 
              isEditing: false,
              isPersisted: false 
            } 
          : it
      )
    );
  };

  const handleDeleteSong = (index: number) => {
    const item = allSongs[index];
    if (item.isPersisted) {
      setAllSongs((prev) =>
        prev.map((it, i) => (i === index ? { ...it, isDeleted: !it.isDeleted } : it))
      );
    } else {
      setAllSongs((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const toggleChangeSong = (index: number) => {
    setAllSongs((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, isChangingSong: !item.isChangingSong, searchQuery: '', searchResults: [] }
          : item
      )
    );
  };

  const handleSearchSongForEditInPlace = async (index: number) => {
    const item = allSongs[index];
    if (!item.searchQuery.trim()) return;

    setAllSongs((prev) =>
      prev.map((it, i) => (i === index ? { ...it, isSearching: true } : it))
    );

    const result = await searchSongForEdit(item.searchQuery);

    setAllSongs((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              isSearching: false,
              searchResults: result.success ? result.data : [],
            }
          : it
      )
    );

    if (!result.success) {
      setError(result.error);
    }
  };

  const updateSongSearchQuery = (index: number, value: string) => {
    setAllSongs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, searchQuery: value } : item))
    );
  };

  const handleSelectNewSongInPlaceLocal = (index: number, track: any) => {
    setAllSongs((prev) =>
      prev.map((it, i) => {
        if (i === index) {
          const startSec = parseTimeToSeconds(it.startTime);
          const newEndTime = (!it.endTime && startSec !== null && track.durationSec > 0) 
            ? secondsToMmSs(startSec + track.durationSec)
            : it.endTime;

          return {
            ...it,
            song: {
              ...it.song,
              master_songs: {
                title: track.title,
                artist: track.artist,
                artwork_url: track.artworkUrl,
                itunes_id: String(track.trackId),
                duration_sec: track.durationSec,
              } as any
            },
            endTime: newEndTime,
            isChangingSong: false,
            isPersisted: false,
            searchQuery: '',
            searchResults: [],
          };
        }
        return it;
      })
    );
  };

  const handleReset = () => {
    const resetAction = () => {
      setUrl('');
      setMetadata(null);
      setVideo(null);
      setAllSongs([]);
      setSelectedSong(null);
      setSearchQuery('');
      setSearchResults([]);
      setStartTime('');
      setEndTime('');
      setError('');
      setSuccess('');
      setStep(1);
      setCurrentBatchIndex(-1);
      setBatchArchives([]);
      setGsUrl('');
      hasAutoFetched.current = false;
      setIsModalOpen(false);
    };

    if (hasChanges) {
      setPendingUrl(null);
      setOnConfirmAction(() => resetAction);
      setIsModalOpen(true);
    } else {
      resetAction();
    }
  };

  const handleNavigationClick = (e: React.MouseEvent, targetUrl: string) => {
    if (hasChanges) {
      e.preventDefault();
      setPendingUrl(targetUrl);
      setOnConfirmAction(null);
      setIsModalOpen(true);
    }
  };

  const handleConfirmNavigation = () => {
    if (onConfirmAction) {
      onConfirmAction();
    } else if (pendingUrl) {
      router.push(pendingUrl);
    }
    setIsModalOpen(false);
  };

  return (
    <>
    <div className="page-container">
      <h1 className="page-title">歌を登録</h1>
      <p className="page-description">
        YouTube 歌枠アーカイブから曲の区間を登録します。
        1つのアーカイブから複数の曲を連続で登録できます。
      </p>

      {/* エラー・成功メッセージ */}
      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {/* バッチナビゲーション */}
      {isBatchMode && (
        <div className="card mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-subtle)' }}>
          <div className="card__body py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[13px] font-bold text-white px-3 py-1 bg-[#ff4e8e]/20 rounded-full border border-[#ff4e8e]/30">
                一括登録モード
              </span>
              <span className="text-[13px] text-[#999] font-medium">
                アーカイブ {currentBatchIndex + 1} / {batchArchives.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn--secondary btn--sm flex items-center gap-1"
                disabled={currentBatchIndex === 0}
                onClick={() => navigateToBatchItem(currentBatchIndex - 1)}
              >
                <ChevronLeft size={16} /> 前のアーカイブ
              </button>
              <button
                className="btn btn--secondary btn--sm flex items-center gap-1"
                disabled={currentBatchIndex === batchArchives.length - 1}
                onClick={() => navigateToBatchItem(currentBatchIndex + 1)}
              >
                次のアーカイブ <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: YouTube URL 入力 */}
      <div className={`card ${step === 1 ? '' : 'card--completed'}`}>
        <div className="card__header">
          <span className="card__step">1</span>
          <h2 className="card__title">アーカイブ URL</h2>
          {step === 2 && (
            <button onClick={handleReset} className="card__change-btn">
              変更
            </button>
          )}
        </div>

        {step === 1 ? (
          <div className="card__body">
            <div className="form-group">
              <label htmlFor="youtube-url" className="form-label">
                YouTube URL
              </label>
              <div className="form-input-group">
                <input
                  id="youtube-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="form-input"
                  disabled={isPending}
                />
                <button
                  onClick={() => handleFetchVideo()}
                  disabled={isPending || !url.trim()}
                  className="btn btn--primary"
                >
                  {isPending ? '取得中...' : '取得'}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <h3 className="text-[14px] font-bold text-[#e0e0e0] mb-4 flex items-center gap-2">
                <Table size={16} className="text-[#ff4e8e]" /> 一括インポート
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-bold text-[#e0e0e0] flex items-center gap-2">
                      <FileUp size={16} className="text-[#999] group-hover:text-[#ff4e8e] transition-colors" /> CSVから追加
                    </span>
                    <input
                      type="file"
                      id="csv-upload"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="text-[11px] font-bold text-[#ff4e8e] cursor-pointer hover:underline"
                    >
                      ファイルを選択
                    </label>
                  </div>
                  <p className="text-[11px] text-[#666] leading-relaxed">
                    アーカイブURL, 曲名, アーティスト, 開始, 終了の順に含まれるCSVを読み込みます。
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-bold text-[#e0e0e0] flex items-center gap-2">
                      <Table size={16} className="text-[#999] group-hover:text-[#ff4e8e] transition-colors" /> Googleスプレッドシートから追加
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={gsUrl}
                      onChange={(e) => setGsUrl(e.target.value)}
                      placeholder="共有用リンクを入力"
                      className="form-input text-[11px] py-1.5 h-auto"
                    />
                    <button
                      onClick={handleGsImport}
                      disabled={isPending || !gsUrl.trim()}
                      className="btn btn--primary btn--sm text-[11px] px-3 whitespace-nowrap"
                    >
                      取得
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          metadata && (
            <div className="card__body">
              <div className="video-preview">
                {metadata.thumbnailUrl && (
                  <img
                    src={metadata.thumbnailUrl}
                    alt={metadata.title}
                    className="video-preview__thumbnail"
                  />
                )}
                <div className="video-preview__info">
                  <p className="video-preview__title">{metadata.title}</p>
                  <p className="video-preview__channel">{metadata.channelName}</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Step 2: 曲検索 + 区間入力 */}
      {step === 2 && (
        <>
          {/* 一括モード以外の場合のみ通常の検索フォームを表示 */}
          {!isBatchMode && (
            <div className="card">
              <div className="card__header">
                <span className="card__step">2</span>
                <h2 className="card__title">曲を検索</h2>
                {allSongs.length > 0 && (
                  <span className="card__badge">
                    {allSongs.length} 曲登録済み
                  </span>
                )}
              </div>

              <div className="card__body">
                {/* 選択済みの曲カード */}
                {selectedSong ? (
                  <div className="selected-song">
                    <img
                      src={selectedSong.artworkUrl}
                      alt={selectedSong.title}
                      className="selected-song__artwork"
                    />
                    <div className="selected-song__info">
                      <span className="selected-song__title">{selectedSong.title}</span>
                      <span className="selected-song__artist">{selectedSong.artist}</span>
                    </div>
                    <button
                      onClick={handleClearSelection}
                      className="selected-song__clear"
                      title="選択を解除"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 検索バー */}
                    <div className="form-group">
                      <label htmlFor="song-search" className="form-label">
                        曲名で検索 <span className="form-required">*</span>
                      </label>
                      <div className="form-input-group">
                        <input
                          id="song-search"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearch();
                            }
                          }}
                          placeholder="例: 夜に駆ける"
                          className="form-input"
                          disabled={isSearching}
                        />
                        <button
                          onClick={handleSearch}
                          disabled={isSearching || !searchQuery.trim()}
                          className="btn btn--primary"
                        >
                          {isSearching ? '検索中...' : <Search size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* 検索結果一覧 */}
                    {searchResults.length > 0 && (
                      <div className="search-results">
                        {searchResults.map((track) => (
                          <button
                            key={track.trackId}
                            onClick={() => handleSelectSong(track)}
                            className="search-results__item"
                          >
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              className="search-results__artwork"
                            />
                            <div className="search-results__info">
                              <span className="search-results__title">{track.title}</span>
                              <span className="search-results__artist">{track.artist}</span>
                            </div>
                            <Music size={16} className="search-results__icon" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* 区間入力 */}
                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="start-time" className="form-label">
                      開始時間 <span className="form-required">*</span>
                    </label>
                    <input
                      id="start-time"
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="mm:ss"
                      className="form-input"
                      disabled={isPending}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="end-time" className="form-label">
                      終了時間 <span className="form-required">*</span>
                    </label>
                    <input
                      id="end-time"
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="mm:ss"
                      className="form-input"
                      disabled={isPending}
                    />
                  </div>
                </div>

                <button
                  onClick={handleRegisterSong}
                  disabled={isPending || !selectedSong || !startTime || !endTime}
                  className="btn btn--primary btn--full"
                >
                  {isPending ? '登録中...' : 'リストに追加'}
                </button>
              </div>
            </div>
          )}

          {/* 一括保存ボタン（フローティングまたは目立つ位置） */}
          {hasChanges && (
            <div className="batch-save-banner">
              <div className="batch-save-banner__content">
                <AlertCircle size={20} className="batch-save-banner__icon" />
                <span className="batch-save-banner__text">未保存の変更があります</span>
              </div>
              <button
                onClick={handleSaveBatch}
                disabled={isPending}
                className="btn btn--success btn--sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {isPending ? '保存中...' : (
                  <>
                    <Save size={16} />
                    全ての変更を保存
                  </>
                )}
              </button>
            </div>
          )}

          {/* 統合された曲リスト */}
          {allSongs.length > 0 && (
            <div className="card">
              <div className="card__header">
                <span className="card__step">✓</span>
                <h2 className="card__title">
                  曲リスト（{allSongs.length} 曲）
                </h2>
              </div>
              <div className="card__body" style={{ padding: 0 }}>
                <div className="edit-songs">
                  {allSongs.map((item, index) => (
                    <div
                      key={item.id || `new-${index}`}
                      className={`edit-songs__card ${item.isEditing ? 'edit-songs__card--active' : ''} ${item.isDeleted ? 'edit-songs__card--deleted' : ''}`}
                      style={{ border: 'none', borderRadius: 0, borderBottom: '1px solid var(--border)', opacity: item.isDeleted ? 0.6 : 1 }}
                    >
                      <div className="edit-songs__info-row" style={{ padding: '12px 16px' }}>
                        <span className="edit-songs__num" style={{ width: '24px' }}>{index + 1}</span>
                        {item.song.master_songs?.artwork_url && (
                          <img
                            src={item.song.master_songs.artwork_url}
                            alt={item.song.master_songs.title}
                            className="edit-songs__artwork"
                            style={{ width: '40px', height: '40px' }}
                          />
                        )}
                        <div className="edit-songs__info" style={{ flex: 1 }}>
                          <span className="edit-songs__title" style={{ fontSize: '14px' }}>
                            {item.song.master_songs?.title || '(不明)'}
                          </span>
                          <span className="edit-songs__artist" style={{ fontSize: '12px' }}>
                            {item.song.master_songs?.artist || '-'}
                          </span>
                        </div>
                        {!isBatchMode && (
                          <div className="edit-songs__actions">
                            <button
                              onClick={() => toggleEdit(index)}
                              className="edit-songs__btn"
                              title={item.isEditing ? 'キャンセル' : '編集'}
                            >
                              {item.isEditing ? <X size={14} /> : <Pencil size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteSong(index)}
                              className={`edit-songs__btn ${item.isDeleted ? 'edit-songs__btn--active' : 'edit-songs__btn--danger'}`}
                              title={item.isDeleted ? '削除を取り消す' : '削除'}
                              disabled={isPending}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 編集フォーム（インライン） */}
                      {(item.isEditing || isBatchMode) && (
                        <div className="edit-songs__form" style={{ margin: '0 16px 16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                          {!isBatchMode && (
                            <button
                              onClick={() => toggleChangeSong(index)}
                              className="edit-songs__change-song-btn"
                              style={{ marginBottom: '12px' }}
                            >
                              <Music size={14} />
                              {item.isChangingSong ? '曲の変更をキャンセル' : '曲を変更する'}
                            </button>
                          )}

                          {(item.isChangingSong || isBatchMode) && (
                            <div className="edit-songs__search" style={{ marginBottom: '12px' }}>
                              <div className="form-input-group">
                                <input
                                  type="text"
                                  value={item.searchQuery}
                                  onChange={(e) => updateSongSearchQuery(index, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSearchSongForEditInPlace(index);
                                    }
                                  }}
                                  placeholder="曲名で検索..."
                                  className="form-input"
                                  disabled={item.isSearching}
                                />
                                <button
                                  onClick={() => handleSearchSongForEditInPlace(index)}
                                  disabled={item.isSearching || !item.searchQuery.trim()}
                                  className="btn btn--primary"
                                >
                                  {item.isSearching ? '...' : <Search size={16} />}
                                </button>
                              </div>

                              {item.searchResults.length > 0 && (
                                <div className="search-results" style={{ marginTop: '8px' }}>
                                  {item.searchResults.map((track) => (
                                    <button
                                      key={track.trackId}
                                      onClick={() => handleSelectNewSongInPlaceLocal(index, track)}
                                      className="search-results__item"
                                      disabled={isPending}
                                    >
                                      <img
                                        src={track.artworkUrl}
                                        alt={track.title}
                                        className="search-results__artwork"
                                        style={{ width: '32px', height: '32px' }}
                                      />
                                      <div className="search-results__info">
                                        <span className="search-results__title" style={{ fontSize: '12px' }}>{track.title}</span>
                                        <span className="search-results__artist" style={{ fontSize: '11px' }}>{track.artist}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="form-row" style={{ gap: '8px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '12px' }}>開始</label>
                              <input
                                type="text"
                                value={item.startTime}
                                onChange={(e) => updateSongField(index, 'startTime', e.target.value)}
                                placeholder="mm:ss"
                                className="form-input form-input--sm"
                                disabled={isPending}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '12px' }}>終了</label>
                              <input
                                type="text"
                                value={item.endTime}
                                onChange={(e) => updateSongField(index, 'endTime', e.target.value)}
                                placeholder="mm:ss"
                                className="form-input form-input--sm"
                                disabled={isPending}
                              />
                            </div>
                            {!isBatchMode && (
                              <div style={{ alignSelf: 'flex-end', flex: 1 }}>
                                <button
                                  onClick={() => handleSaveSongLocal(index)}
                                  disabled={isPending}
                                  className="btn btn--primary btn--full btn--sm"
                                  style={{ height: '36px' }}
                                >
                                  <Music size={14} />
                                  保存
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!item.isEditing && (
                        <div className="edit-songs__time-info" style={{ paddingLeft: '40px', marginLeft: '24px', paddingBottom: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {formatTime(item.song.start_sec ?? 0)} - {formatTime(item.song.end_sec ?? 0)}
                          </span>
                          <span className="edit-songs__duration" style={{ fontSize: '11px', marginLeft: '8px' }}>
                            ({formatTime((item.song.end_sec ?? 0) - (item.song.start_sec ?? 0))})
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* アーカイブページへのリンク */}
                {video && (
                  <div className="registered-songs__footer" style={{ padding: '16px', borderTop: 'none' }}>
                    <Link
                      href={`/videos/${video.video_id}`}
                      className="btn btn--secondary btn--full"
                      onClick={(e) => handleNavigationClick(e, `/videos/${video.video_id}`)}
                    >
                      アーカイブページで確認する →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

    </div>

    {/* VTuber登録モーダル */}
    {isVtuberModalOpen && (
      <div className="modal-overlay">
        <div className="modal-container" style={{ maxWidth: '500px' }}>
          <div className="modal-body" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            <div className="modal-icon" style={{ alignSelf: 'center' }}>
              <UserPlus size={32} />
            </div>
            <h3 className="modal-title" style={{ alignSelf: 'center' }}>VTuber情報を登録</h3>
            <p className="modal-text" style={{ alignSelf: 'center', marginBottom: '16px' }}>
              このチャンネルは未登録です。VTuber情報を入力してください。
            </p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">VTuber名 <span className="form-required">*</span></label>
                <input
                  type="text"
                  value={vtuberForm.name}
                  onChange={e => setVtuberForm(p => ({ ...p, name: e.target.value }))}
                  className="form-input"
                  placeholder="例: 博衣こより"
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">性別</label>
                  <select
                    value={vtuberForm.gender}
                    onChange={e => setVtuberForm(p => ({ ...p, gender: e.target.value as any }))}
                    className="form-input"
                  >
                    <option value="女性">女性</option>
                    <option value="男性">男性</option>
                    <option value="その他">その他</option>
                    <option value="不明">不明</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">所属事務所</label>
                  <select
                    value={vtuberForm.productionId}
                    onChange={e => setVtuberForm(p => ({ ...p, productionId: e.target.value, newProductionName: '' }))}
                    className="form-input"
                  >
                    <option value="">(選択なし / 個人勢)</option>
                    {productions.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="new">+ 新規作成...</option>
                  </select>
                </div>
              </div>

              {vtuberForm.productionId === 'new' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">新規事務所名</label>
                  <div className="form-input-group">
                    <Building2 size={18} className="form-input-icon" />
                    <input
                      type="text"
                      value={vtuberForm.newProductionName}
                      onChange={e => setVtuberForm(p => ({ ...p, newProductionName: e.target.value }))}
                      className="form-input"
                      placeholder="事務所名を入力"
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">X (Twitter) リンク</label>
                <input
                  type="text"
                  value={vtuberForm.link}
                  onChange={e => setVtuberForm(p => ({ ...p, link: e.target.value }))}
                  className="form-input"
                  placeholder="https://..."
                />
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                {channelDataForReg?.image && (
                  <img src={channelDataForReg.image} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="" />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>紐付けられるチャンネル</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{channelDataForReg?.name}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={() => {
              setIsVtuberModalOpen(false);
              setStep(1);
            }} disabled={isPending}>キャンセル</button>
            <button 
              className="btn btn--primary" 
              onClick={handleRegisterVtuber}
              disabled={isPending || !vtuberForm.name.trim() || (vtuberForm.productionId === 'new' && !vtuberForm.newProductionName.trim())}
            >
              {isPending ? '登録中...' : '登録して進む'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* カスタム確認モーダル */}
    {isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <div className="modal-icon">
              <AlertCircle size={32} />
            </div>
            <h3 className="modal-title">変更を破棄しますか？</h3>
            <p className="modal-text">
              未保存の変更があります。このまま移動すると、編集した内容は失われます。
            </p>
          </div>
          <div className="modal-footer">
            <button 
              className="btn btn--secondary" 
              onClick={() => setIsModalOpen(false)}
              disabled={isPending}
            >
              キャンセル
            </button>
            <button 
              className="btn btn--warning" 
              onClick={handleConfirmNavigation}
              disabled={isPending}
            >
              移動する
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
