"use client";

import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from 'react';
import { fetchVideoPreview, registerVideo, registerSong, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel } from './actions';
import type { ITunesSearchResult } from './actions';
import type { YouTubeVideoMetadata, Video, Song, Production } from '@/types';
import { formatTime, parseTime } from '@/lib/utils';
import Link from 'next/link';
import { Search, X, Music, Info, Pencil, Save, Trash2, CheckCircle2, AlertCircle, UserPlus, Building2 } from 'lucide-react';
import { updateSong, deleteSong, updateSongMaster, searchSongForEdit } from '@/app/videos/[videoId]/edit/actions';
import { useSearchParams, useRouter } from 'next/navigation';
import { convertGSheetUrlToCsv, parseCsv, processImportedData, type BatchArchive, type ImportedSong } from '@/utils/batch-parser';
import { FileUp, Table, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { motion } from 'framer-motion';
import Hero from '@/components/Hero';


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
  isConfirmed: boolean; // ユーザーが曲名・アーティスト名を確定させたか
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
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');

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
  const { locale, t: tl, T } = useLocale();

  // モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: 'warning' | 'danger' | 'info';
  }>({
    title: T('newSong.confirmDiscard'),
    message: T('newSong.discardMessage'),
    confirmText: T('newSong.move'),
    cancelText: T('common.cancel'),
    type: 'warning',
  });
  const [step, setStep] = useState<1 | 2>(1);

  // VTuber登録モーダル
  const [isVtuberModalOpen, setIsVtuberModalOpen] = useState(false);
  const [productions, setProductions] = useState<Production[]>([]);
  const [vtuberForm, setVtuberForm] = useState({
    name: '',
    gender: T('vtuber.genders.unknown') as any,
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

  const [isCoverVideo, setIsCoverVideo] = useState(false);

  // 歌ってみた動画モードの自動入力
  useEffect(() => {
    if (isCoverVideo && metadata) {
      setStartTime('0:00');
      setEndTime(formatTime(metadata.duration));
    }
  }, [isCoverVideo, metadata]);

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
      setModalConfig({
        title: T('newSong.confirmDiscard'),
        message: T('newSong.discardMessage'),
        confirmText: T('newSong.move'),
        cancelText: T('common.cancel'),
        type: 'warning',
      });
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
    const startSec = parseTime(startTime);
    if (!startSec || isNaN(startSec) || selectedSong.durationSec <= 0) return;
    const endSec = startSec + selectedSong.durationSec;
    setEndTime(formatTime(endSec));
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
      setIsCoverVideo(!result.data.metadata.isStream); // 自動判定

      const convertedSongs: EditableSong[] = result.data.existingSongs.map(song => ({
        id: song.id,
        song,
        startTime: formatTime(song.start_sec),
        endTime: formatTime(song.end_sec),
        isEditing: false,
        isChangingSong: false,
        searchQuery: '',
        searchResults: [],
        isSearching: false,
        isPersisted: true,
        isConfirmed: true,
      }));

      // バッチモードの場合、既存曲とインポートデータをマージ
      if (batchIndex !== undefined && batchIndex !== -1) {
        const dataToUse = batchData || batchArchives;
        const batchItem = dataToUse[batchIndex];

        if (batchItem) {
          const existingStartTimes = result.data.existingSongs.map(s => s.start_sec);

          const newBatchSongs: EditableSong[] = batchItem.songs
            .filter(s => {
              const startSec = parseTime(s.startTime);
              if (startSec === null) return true;
              // ±5秒以内の重複を回避
              return !existingStartTimes.some(existingSec => Math.abs(existingSec - startSec) <= 5);
            })
            .map((s: ImportedSong) => ({
              song: {
                master_songs: { title: s.title, artist: s.artist },
                start_sec: parseTime(s.startTime) || 0,
                end_sec: s.endTime ? parseTime(s.endTime) || 0 : 0
              } as any,
              startTime: s.startTime,
              endTime: s.endTime || '',
              isEditing: false,
              isChangingSong: true, // 曲検索を表示
              searchQuery: s.title,
              searchResults: [],
              isSearching: false,
              isPersisted: false,
              isConfirmed: false,
            }));
          setAllSongs([...convertedSongs, ...newBatchSongs]);
        } else {
          setAllSongs(convertedSongs);
        }
      } else {
        setAllSongs(convertedSongs);
      }

      if (result.data.existingSongs.length > 0) {
        setSuccess(T('newSong.fetchExisting'));
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
          setError(T('newSong.error'));
          return;
        }
        setBatchArchives(processed);
        setCurrentBatchIndex(0);
        setUrl(processed[0].url);
        handleFetchVideo(processed[0].url, 0, processed);
      } catch (err: any) {
        setError(err.message || T('newSong.csvLoadError'));
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
          setError(T('newSong.error'));
          return;
        }
        setBatchArchives(processed);
        setCurrentBatchIndex(0);
        setUrl(processed[0].url);
        handleFetchVideo(processed[0].url, 0, processed);
      } catch (err: any) {
        setError(err.message || T('newSong.gsLoadError'));
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
      setSuccess(T('vtuber.registerSuccess', { name: vtuberForm.name }));

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsManualInput(false);
    setIsSearching(true);
    setError('');
    try {
      const country = locale === 'en' ? 'us' : 'jp';
      const lang = locale === 'en' ? 'en_us' : 'ja_jp';
      const result = await searchSongAction(searchQuery, country, lang);
      if (result.success) {
        setSearchResults(result.data);
        if (result.data.length === 0) {
          setError(T('newSong.noSongsFound'));
          setIsManualInput(true);
          setManualTitle(searchQuery);
        }
      } else {
        setError(result.error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSong = (track: ITunesSearchResult) => {
    setSelectedSong(track);
    setSearchResults([]);
    setSearchQuery('');
    setIsManualInput(false);
  };

  const handleManualSongSelect = () => {
    const manualSong: ITunesSearchResult = {
      trackId: -1,
      title: manualTitle || searchQuery || T('common.unknown'),
      artist: manualArtist || T('common.unknown'),
      albumName: '手動登録',
      artworkUrl: '', // 空文字にしておく（プレースホルダー表示用）
      durationSec: 0,
    };
    setSelectedSong(manualSong);
    setIsManualInput(false);
    setSearchResults([]);
  };

  const handleClearSelection = () => {
    setSelectedSong(null);
  };

  const handleRegisterSong = () => {
    setError('');
    if (!selectedSong || !startTime || !endTime) return;

    if (isCoverVideo && allSongs.filter(s => !s.isDeleted).length > 0) {
      setError(T('newSong.isCoverError'));
      return;
    }

    const startSec = parseTime(startTime);
    const endSec = parseTime(endTime);
    if (startSec === null || endSec === null || startSec >= endSec) {
      setError(T('newSong.timeError'));
      return;
    }

    const newSong: EditableSong = {
      song: {
        master_songs: {
          title: selectedSong.title,
          artist: selectedSong.artist,
          artwork_url: selectedSong.artworkUrl || '',
          itunes_id: selectedSong.trackId === -1 ? null : String(selectedSong.trackId),
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
      isConfirmed: true,
    };

    // クライアント側での管理用に検索時のロケールを保存
    (newSong as any).searchLocale = locale;

    setAllSongs((prev) => [...prev, newSong]);
    setSuccess(T('newSong.addToListSuccess'));

    setSelectedSong(null);
    setSearchQuery('');
    setStartTime('');
    setEndTime('');
  };

  const handleSaveBatch = () => {
    if (!metadata) return;
    setError('');
    setSuccess('');

    // 未確定（未検索・未入力）の楽曲があるかチェック
    const unconfirmedCount = allSongs.filter(s => !s.isConfirmed && !s.isDeleted).length;

    const performSave = async () => {
      startTransition(async () => {
        // 確定済みのものだけを対象にする
        const songsToRegister = allSongs
          .filter(s => s.isConfirmed || s.id) // 既存曲(idあり)または確定済み
          .map(item => ({
            id: item.id,
            songTitle: item.song.master_songs?.title || '',
            songArtist: item.song.master_songs?.artist || '',
            artworkUrl: item.song.master_songs?.artwork_url || '',
            itunesId: item.song.master_songs?.itunes_id || '',
            durationSec: item.song.master_songs?.duration_sec || 0,
            startSec: parseTime(item.startTime) || 0,
            endSec: parseTime(item.endTime) || 0,
            isDeleted: item.isDeleted,
            searchLocale: (item as any).searchLocale || locale,
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
          startTime: formatTime(song.start_sec),
          endTime: formatTime(song.end_sec),
          isEditing: false,
          isChangingSong: false,
          searchQuery: '',
          searchResults: [],
          isSearching: false,
          isPersisted: true,
          isConfirmed: true,
        }));
        setAllSongs(updatedSongs);
        setSuccess(T('newSong.saveSuccess') + (unconfirmedCount > 0 ? T('newSong.skippedUnconfirmed', { count: unconfirmedCount }) : ''));
      });
    };

    if (unconfirmedCount > 0) {
      setModalConfig({
        title: T('newSong.unconfirmedTitle'),
        message: T('newSong.unconfirmedMessage', { count: unconfirmedCount }),
        confirmText: T('newSong.confirmSave'),
        cancelText: T('newSong.backToConfirm'),
        type: 'warning',
      });
      setOnConfirmAction(() => performSave);
      setIsModalOpen(true);
    } else {
      performSave();
    }
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
    const s = parseTime(item.startTime);
    const e = parseTime(item.endTime);

    if (s === null || e === null || s >= e) {
      setError(T('newSong.timeFormatError'));
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

    const country = locale === 'en' ? 'us' : 'jp';
    const lang = locale === 'en' ? 'en_us' : 'ja_jp';
    const result = await searchSongForEdit(item.searchQuery, country, lang);

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
          const startSec = parseTime(it.startTime);
          const newEndTime = (!it.endTime && startSec !== null && track.durationSec > 0)
            ? formatTime(startSec + track.durationSec)
            : it.endTime;

          return {
            ...it,
            song: {
              ...it.song,
              master_songs: {
                title: track.title,
                artist: track.artist,
                artwork_url: track.artworkUrl || '',
                itunes_id: track.trackId === -1 ? null : String(track.trackId),
                duration_sec: track.durationSec,
              } as any
            },
            endTime: newEndTime,
            isConfirmed: true,
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
      setModalConfig({
        title: T('newSong.confirmDiscard'),
        message: T('newSong.discardMessage'),
        confirmText: T('newSong.move'),
        cancelText: T('common.cancel'),
        type: 'warning',
      });
      setOnConfirmAction(() => () => {
        router.push(targetUrl);
      });
      setIsModalOpen(true);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Hero
        title={T('newSong.pageTitle')}
        description={T('newSong.pageDescription')}
        icon={<Music size={64} />}
      />

      <div className="container py-12 pb-48 px-6 max-w-5xl mx-auto">

        {/* エラー・成功メッセージ */}
        {error && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

        {/* バッチナビゲーション */}
        {isBatchMode && (
          <div className="card mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-subtle)' }}>
            <div className="card__body py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[13px] font-bold text-white px-3 py-1 bg-[var(--accent)]/20 rounded-full border border-[var(--accent)]/30">
                  {T('newSong.batchMode')}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)] font-medium">
                  アーカイブ {currentBatchIndex + 1} / {batchArchives.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn--secondary btn--sm flex items-center gap-1"
                  disabled={currentBatchIndex === 0}
                  onClick={() => navigateToBatchItem(currentBatchIndex - 1)}
                >
                  <ChevronLeft size={16} /> {T('newSong.prevArchive')}
                </button>
                <button
                  className="btn btn--secondary btn--sm flex items-center gap-1"
                  disabled={currentBatchIndex === batchArchives.length - 1}
                  onClick={() => navigateToBatchItem(currentBatchIndex + 1)}
                >
                  {T('newSong.nextArchive')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: YouTube URL 入力 */}
        <div className={`card ${step === 1 ? '' : 'card--completed'}`}>
          <div className="card__header">
            <span className="card__step">1</span>
            <h2 className="card__title">{T('newSong.youtubeUrl')}</h2>
            {step === 2 && (
              <button onClick={handleReset} className="card__change-btn">
                {T('common.edit')}
              </button>
            )}
          </div>

          {step === 1 ? (
            <div className="card__body">
              <div className="form-group">
                <label htmlFor="youtube-url" className="form-label">
                  {T('newSong.youtubeUrl')}
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
                    {isPending ? T('newSong.fetching') : T('newSong.fetch')}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Table size={16} className="text-[var(--accent)]" /> {T('newSong.bulkImport')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-tertiary)]/50 border border-[var(--border)] rounded-xl p-4 hover:bg-[var(--bg-hover)] transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <FileUp size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" /> {T('newSong.fromCsv')}
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
                        className="text-[11px] font-bold text-[var(--accent)] cursor-pointer hover:underline"
                      >
                        {T('newSong.selectFile')}
                      </label>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {T('newSong.csvDescription')}
                    </p>
                  </div>

                  <div className="bg-[var(--bg-tertiary)]/50 border border-[var(--border)] rounded-xl p-4 hover:bg-[var(--bg-hover)] transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Table size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" /> {T('newSong.fromGoogleSheet')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={gsUrl}
                        onChange={(e) => setGsUrl(e.target.value)}
                        placeholder={T('newSong.enterGsUrl')}
                        className="form-input text-[11px] py-1.5 h-auto"
                      />
                      <button
                        onClick={handleGsImport}
                        disabled={isPending || !gsUrl.trim()}
                        className="btn btn--primary btn--sm text-[11px] px-3 whitespace-nowrap"
                      >
                        {T('newSong.fetch')}
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
                  <h2 className="card__title">{T('newSong.searchSong')}</h2>
                  {allSongs.length > 0 && (
                    <span className="card__badge">
                      {allSongs.length} {T('newSong.registeredCount')}
                    </span>
                  )}
                </div>

                <div className="card__body">
                  {/* 歌ってみた動画トグル */}
                  <div className="mb-6 flex items-center gap-2 bg-[#ff4e8e]/5 border border-[#ff4e8e]/10 p-3 rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isCoverVideo}
                          onChange={(e) => setIsCoverVideo(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ff4e8e]"></div>
                      </div>
                      <span className="text-[13px] font-bold text-[#e0e0e0]">{T('newSong.isCover')}</span>
                    </label>
                    <div className="group relative">
                      <Info size={14} className="text-[#666]" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-[11px] text-[#999] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl leading-relaxed">
                        {T('newSong.coverTooltip')}
                      </div>
                    </div>
                  </div>

                  {/* 選択済みの曲カード */}
                  {selectedSong ? (
                    <div className="selected-song">
                      {selectedSong.artworkUrl ? (
                        <img
                          src={selectedSong.artworkUrl}
                          alt={selectedSong.title}
                          className="selected-song__artwork"
                        />
                      ) : (
                        <div className="selected-song__artwork" style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                          <Music size={24} style={{ margin: 'auto' }} />
                        </div>
                      )}
                      <div className="selected-song__info">
                        <span className="selected-song__title">{selectedSong.title}</span>
                        <span className="selected-song__artist">{selectedSong.artist}</span>
                      </div>
                      <button
                        onClick={handleClearSelection}
                        className="selected-song__clear"
                        title={T('common.clear')}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 検索バー */}
                      <div className="form-group">
                        <label htmlFor="song-search" className="form-label">
                          {T('newSong.searchByName')} <span className="form-required">*</span>
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
                            placeholder={T('newSong.searchPlaceholder')}
                            className="form-input"
                            disabled={isSearching}
                          />
                          <button
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="btn btn--primary"
                          >
                            {isSearching ? T('newSong.searching') : <Search size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* 検索結果一覧 */}
                      {searchResults.length > 0 && (
                        <div className="search-results" style={{ marginBottom: '1rem' }}>
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

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button
                          onClick={() => {
                            setIsManualInput(!isManualInput);
                            if (!isManualInput) {
                              setManualTitle(searchQuery);
                              setSearchResults([]);
                            }
                          }}
                          className="btn btn--sm"
                          style={{ fontSize: '12px' }}
                        >
                          {isManualInput ? T('newSong.backToSearch') : T('newSong.manualInput')}
                        </button>
                      </div>

                      {isManualInput && (
                        <div className="manual-input-form" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                          <div className="form-group">
                            <label className="form-label">{T('archive.title')}</label>
                            <input
                              type="text"
                              value={manualTitle}
                              onChange={(e) => setManualTitle(e.target.value)}
                              className="form-input"
                              placeholder={T('archive.title')}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{T('archive.artist')}</label>
                            <input
                              type="text"
                              value={manualArtist}
                              onChange={(e) => setManualArtist(e.target.value)}
                              className="form-input"
                              placeholder={T('archive.artist')}
                            />
                          </div>
                          <button
                            onClick={handleManualSongSelect}
                            className="btn btn--secondary btn--full btn--sm"
                            disabled={!manualTitle.trim()}
                          >
                            {T('newSong.confirmManual')}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* 区間入力 */}
                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="start-time" className="form-label">
                        {T('newSong.startTime')} <span className="form-required">*</span>
                      </label>
                      <input
                        id="start-time"
                        type="text"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        placeholder="m:ss or h:mm:ss"
                        className="form-input"
                        disabled={isPending}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="end-time" className="form-label">
                        {T('newSong.endTime')} <span className="form-required">*</span>
                      </label>
                      <input
                        id="end-time"
                        type="text"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        placeholder="m:ss or h:mm:ss"
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
                    {isPending ? T('newSong.adding') : T('newSong.addToList')}
                  </button>
                </div>
              </div>
            )}

            {/* 一括保存ボタン（フローティングまたは目立つ位置） */}
            {hasChanges && (
              <div className="batch-save-banner">
                <div className="batch-save-banner__content">
                  <AlertCircle size={20} className="batch-save-banner__icon" />
                  <span className="batch-save-banner__text">{T('newSong.unsavedChanges')}</span>
                </div>
                <button
                  onClick={handleSaveBatch}
                  disabled={isPending}
                  className="btn btn--success btn--sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {isPending ? T('newSong.saving') : (
                    <>
                      <Save size={16} />
                      {T('newSong.saveAll')}
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
                    {T('newSong.songList')}（{allSongs.length} {T('archive.songs')}）
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
                          {item.song.master_songs?.artwork_url ? (
                            <img
                              src={item.song.master_songs.artwork_url}
                              alt={item.song.master_songs.title}
                              className="edit-songs__artwork"
                              style={{ width: '40px', height: '40px' }}
                            />
                          ) : (
                            <div className="edit-songs__artwork" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyItems: 'center', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                              <Music size={20} style={{ margin: 'auto' }} />
                            </div>
                          )}
                          <div className="edit-songs__info" style={{ flex: 1 }}>
                            <span className="edit-songs__title" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {tl(item.song.master_songs?.title || '(不明)', item.song.master_songs?.title_en || item.song.master_songs?.title || '(Unknown)')}
                            </span>
                            <span className="edit-songs__artist" style={{ fontSize: '12px' }}>
                              {tl(item.song.master_songs?.artist || '-', item.song.master_songs?.artist_en || item.song.master_songs?.artist || '-')}
                            </span>
                          </div>
                          {!isBatchMode && (
                            <div className="edit-songs__actions">
                                <button
                                  onClick={() => toggleEdit(index)}
                                  className="edit-songs__btn"
                                  title={item.isEditing ? T('common.cancel') : T('common.edit')}
                                >
                                {item.isEditing ? <X size={14} /> : <Pencil size={14} />}
                              </button>
                                <button
                                  onClick={() => handleDeleteSong(index)}
                                  className={`edit-songs__btn ${item.isDeleted ? 'edit-songs__btn--active' : 'edit-songs__btn--danger'}`}
                                  title={item.isDeleted ? T('common.cancel') : T('common.delete')}
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
                                {item.isChangingSong ? T('newSong.cancelChange') : T('newSong.changeSong')}
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
                                    placeholder={T('newSong.searchByName') + '...'}
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
                                {item.searchResults.length === 0 && item.searchQuery && !item.isSearching && (
                                  <div style={{ marginTop: '8px', textAlign: 'right' }}>
                                    <button
                                      onClick={() => {
                                        const manualResult: ITunesSearchResult = {
                                          trackId: -1,
                                          title: item.searchQuery,
                                          artist: T('common.unknown'),
                                          albumName: T('newSong.manualLabel'),
                                          artworkUrl: '',
                                          durationSec: 0,
                                        };
                                        handleSelectNewSongInPlaceLocal(index, manualResult);
                                      }}
                                      className="btn btn--sm"
                                      style={{ fontSize: '11px' }}
                                    >
                                      {T('newSong.manualInput')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                             <div className="form-row" style={{ gap: '8px' }}>
                               <div className="form-group" style={{ marginBottom: 0 }}>
                                 <label className="form-label" style={{ fontSize: '12px' }}>{T('common.start')}</label>
                                <input
                                  type="text"
                                  value={item.startTime}
                                  onChange={(e) => updateSongField(index, 'startTime', e.target.value)}
                                  placeholder="m:ss or h:mm:ss"
                                  className="form-input form-input--sm"
                                  disabled={isPending}
                                />
                              </div>
                               <div className="form-group" style={{ marginBottom: 0 }}>
                                 <label className="form-label" style={{ fontSize: '12px' }}>{T('common.end')}</label>
                                <input
                                  type="text"
                                  value={item.endTime}
                                  onChange={(e) => updateSongField(index, 'endTime', e.target.value)}
                                  placeholder="m:ss or h:mm:ss"
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
                                     {T('common.save')}
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
                        {T('newSong.checkOnArchive')} →
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
                <h3 className="modal-title" style={{ alignSelf: 'center' }}>{T('vtuber.registerTitle')}</h3>
                <p className="modal-text" style={{ alignSelf: 'center', marginBottom: '16px' }}>
                  {T('vtuber.description')}
                </p>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{T('vtuber.name')} <span className="form-required">*</span></label>
                  <input
                    type="text"
                    value={vtuberForm.name}
                    onChange={e => setVtuberForm(p => ({ ...p, name: e.target.value }))}
                    className="form-input"
                    placeholder={T('vtuber.name')}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{T('vtuber.gender')}</label>
                    <select
                      value={vtuberForm.gender}
                      onChange={e => setVtuberForm(p => ({ ...p, gender: e.target.value as any }))}
                      className="form-input"
                    >
                      <option value="女性">{T('vtuber.genders.female')}</option>
                      <option value="男性">{T('vtuber.genders.male')}</option>
                      <option value="その他">{T('vtuber.genders.other')}</option>
                      <option value="不明">{T('vtuber.genders.unknown')}</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{T('vtuber.production')}</label>
                    <select
                      value={vtuberForm.productionId}
                      onChange={e => setVtuberForm(p => ({ ...p, productionId: e.target.value, newProductionName: '' }))}
                      className="form-input"
                    >
                      <option value="">{T('vtuber.noProduction')}</option>
                      {productions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      <option value="new">+ {T('vtuber.createNew')}...</option>
                    </select>
                  </div>
                </div>

                {vtuberForm.productionId === 'new' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{T('vtuber.newProduction')}</label>
                    <div className="form-input-group">
                      <Building2 size={18} className="form-input-icon" />
                      <input
                        type="text"
                        value={vtuberForm.newProductionName}
                        onChange={e => setVtuberForm(p => ({ ...p, newProductionName: e.target.value }))}
                        className="form-input"
                        placeholder={T('vtuber.newProduction')}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{T('vtuber.twitter')}</label>
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
                    <p style={{ fontSize: '13px', fontWeight: 600 }}>{T('vtuber.linkedChannel')}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{channelDataForReg?.name}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => {
                setIsVtuberModalOpen(false);
                setStep(1);
              }} disabled={isPending}>{T('common.cancel')}</button>
              <button
                className="btn btn--primary"
                onClick={handleRegisterVtuber}
                disabled={isPending || !vtuberForm.name.trim() || (vtuberForm.productionId === 'new' && !vtuberForm.newProductionName.trim())}
              >
                {isPending ? T('newSong.adding') : T('vtuber.registerAndProceed')}
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
              <div className={`modal-icon modal-icon--${modalConfig.type}`}>
                {modalConfig.type === 'warning' && <AlertCircle size={32} />}
                {modalConfig.type === 'danger' && <Trash2 size={32} />}
                {modalConfig.type === 'info' && <Info size={32} />}
              </div>
              <h3 className="modal-title">{modalConfig.title}</h3>
              <p className="modal-text">
                {modalConfig.message}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn--secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
              >
                {modalConfig.cancelText}
              </button>
              <button
                className={`btn ${modalConfig.type === 'warning' ? 'btn--warning' : modalConfig.type === 'danger' ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => {
                  setIsModalOpen(false);
                  if (onConfirmAction) onConfirmAction();
                }}
                disabled={isPending}
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
    </>
  );
}
