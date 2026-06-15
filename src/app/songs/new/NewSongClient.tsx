"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchVideoPreview, registerVideo, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel } from './actions';
import type { ITunesSearchResult } from './actions';
import type { YouTubeVideoMetadata, Video, Song, Production, MasterSong, YouTubeChannelData } from '@/types';
import { formatTime, parseTime } from '@/lib/utils';
import Link from 'next/link';
import { 
  Search, X, Music, Info, Pencil, Save, Trash2, 
  AlertCircle, UserPlus, Building2, FileUp, Loader2
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from '@/components/LocaleProvider';
import Image from 'next/image';
import Hero from '@/components/Hero';

interface EditableSong {
  id?: number; // DB 登録済みの場合は ID がある
  song: Partial<Song> & { master_song?: Partial<MasterSong> }; // プレビュー用
  startTime: string;
  endTime: string;
  isEditing: boolean;
  isChangingSong: boolean;
  searchQuery: string;
  searchResults: ITunesSearchResult[];
  isSearching: boolean;
  isPersisted: boolean; // DB 保存済みか
  isDeleted?: boolean; // 削除フラグ（一括保存時に反映）
  isConfirmed: boolean; // ユーザーが曲名・アーティスト名を確定させたか
  searchLocale?: 'ja' | 'en'; // 検索時のロケール
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { locale, t: tl, T } = useLocale();

  // モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [vtuberForm, setVtuberForm] = useState<{
    name: string;
    gender: '男性' | '女性' | 'その他' | '不明';
    link: string;
    productionId: string;
    newProductionName: string;
  }>({
    name: '',
    gender: '不明',
    link: '',
    productionId: '',
    newProductionName: '',
  });
  const [channelDataForReg, setChannelDataForReg] = useState<YouTubeChannelData | null>(null);

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    if (saveStatus === 'success' || saveStatus === 'error') return false;
    // 1. リスト内に未保存、削除予定、または編集中のものがある場合
    const hasUnsavedInList = allSongs.some(s => !s.isPersisted || s.isDeleted || s.isEditing);
    // 2. 現在新規追加フォームに入力中のものがある場合
    const hasActiveInput = !!selectedSong || !!startTime.trim() || !!endTime.trim() || !!searchQuery.trim();

    return hasUnsavedInList || hasActiveInput;
  }, [allSongs, selectedSong, startTime, endTime, searchQuery, saveStatus]);

  const [isCoverVideo, setIsCoverVideo] = useState(false);

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

  // クライアントサイドナビゲーションの監視（サイドバーやヘッダーのリンクなど）
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // クリックされた要素から最も近い a タグを探す
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && hasChanges) {
        const href = anchor.getAttribute('href');
        const targetAttr = anchor.getAttribute('target');

        // 内部リンク（# で始まらず、http で始まらない）かつ、別タブ表示でない場合にガード
        if (
          href && 
          !href.startsWith('#') && 
          !href.startsWith('http') && 
          (!targetAttr || targetAttr === '_self')
        ) {
          // 遷移を差し止める
          e.preventDefault();
          e.stopPropagation();

          // 確認モーダルの内容をセットして表示
          setModalConfig({
            title: T('newSong.confirmDiscard'),
            message: T('newSong.discardMessage'),
            confirmText: T('newSong.move'),
            cancelText: T('common.cancel'),
            type: 'warning',
          });
          setOnConfirmAction(() => () => {
            router.push(href);
          });
          setIsModalOpen(true);
        }
      }
    };

    // キャプチャフェーズでイベントを捕捉して、Next.js の Link コンポーネントの挙動より先に割り込む
    window.addEventListener('click', handleAnchorClick, true);
    return () => window.removeEventListener('click', handleAnchorClick, true);
  }, [hasChanges, router, T]);

  const handleFetchVideo = useCallback((manualUrl?: string) => {
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
      const isActuallyCover = !result.data.metadata.isStream;
      setIsCoverVideo(isActuallyCover); // 自動判定

      if (isActuallyCover) {
        setStartTime('0:00');
        setEndTime(formatTime(result.data.metadata.duration));
      }

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

      setAllSongs(convertedSongs);

      if (result.data.existingSongs.length > 0) {
        setSuccess(T('newSong.fetchExisting'));
      }

      // チャンネル未登録の場合はモーダルを表示
      if (!result.data.isChannelRegistered && result.data.channelData) {
        const channelData = result.data.channelData as unknown as YouTubeChannelData;
        setChannelDataForReg(channelData);
        setVtuberForm(prev => ({
          ...prev,
          name: channelData.name,
          link: channelData.officialLink || ''
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
  }, [url, T, setError, setSuccess, setMetadata, setIsCoverVideo, setStartTime, setEndTime, setAllSongs, setChannelDataForReg, setVtuberForm, setProductions, setIsVtuberModalOpen, setVideo, setStep]);

  // 自動読み込み
  useEffect(() => {
    if (initialUrl && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      setUrl(initialUrl);
      // Fetch video immediately
      handleFetchVideo(initialUrl);
    }
  }, [initialUrl, handleFetchVideo]);

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

    // 開始時間があり、曲に長さがある場合は終了時間を自動計算
    if (startTime && track.durationSec > 0) {
      const startSec = parseTime(startTime);
      if (startSec !== null) {
        setEndTime(formatTime(startSec + track.durationSec));
      }
    }
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
    setManualTitle('');
    setManualArtist('');
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
        master_song: {
          title: selectedSong.title,
          artist: selectedSong.artist,
          artwork_url: selectedSong.artworkUrl || '',
          itunes_id: selectedSong.trackId === -1 ? null : String(selectedSong.trackId),
          duration_sec: selectedSong.durationSec,
        } as unknown as Partial<MasterSong>,
        start_sec: startSec,
        end_sec: endSec,
      } as unknown as Partial<Song> & { master_song?: Partial<MasterSong> },
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
    newSong.searchLocale = locale;

    setAllSongs((prev) => [...prev, newSong]);
    setSuccess(T('newSong.addToListSuccess'));

    setSelectedSong(null);
    setSearchQuery('');
    setStartTime('');
    setEndTime('');
    setManualTitle('');
    setManualArtist('');
  };

  const performSave = useCallback(async () => {
    if (!metadata) return;
    setError('');
    setSuccess('');
    setSaveStatus('saving');
    setSaveErrorMsg('');

    // 未確定（未検索・未入力）の楽曲があるかチェック
    const unconfirmedCount = allSongs.filter(s => !s.isConfirmed && !s.isDeleted).length;

    startTransition(async () => {
      try {
        // 確定済みのものだけを対象にする
        const songsToRegister = allSongs
          .filter(s => s.isConfirmed || s.id) // 既存曲(idあり)または確定済み
          .map(item => ({
            id: item.id,
            songTitle: item.song.master_song?.title || '',
            songArtist: item.song.master_song?.artist || '',
            artworkUrl: item.song.master_song?.artwork_url || '',
            itunesId: item.song.master_song?.itunes_id || '',
            durationSec: item.song.master_song?.duration_sec || 0,
            startSec: parseTime(item.startTime) || 0,
            endSec: parseTime(item.endTime) || 0,
            isDeleted: item.isDeleted,
            searchLocale: item.searchLocale || locale,
          }));

        const result = await registerFullArchive({
          videoMetadata: metadata,
          songs: songsToRegister,
        });

        if (!result.success) {
          setError(result.error);
          setSaveErrorMsg(result.error);
          setSaveStatus('error');
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
        setSaveStatus('success');
      } catch (e) {
        const msg = e instanceof Error ? e.message : T('common.errorOccurred');
        setError(msg);
        setSaveErrorMsg(msg);
        setSaveStatus('error');
      }
    });
  }, [allSongs, metadata, locale, T]);

  const handleSaveAll = () => {
    if (!metadata) return;
    setError('');
    setSuccess('');

    // 未確定（未検索・未入力）の楽曲があるかチェック
    const unconfirmedCount = allSongs.filter(s => !s.isConfirmed && !s.isDeleted).length;

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
    const result = await searchSongAction(item.searchQuery, country, lang);

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

  const handleSelectNewSongInPlaceLocal = (index: number, track: ITunesSearchResult) => {
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
              master_song: {
                title: track.title,
                artist: track.artist,
                artwork_url: track.artworkUrl || '',
                itunes_id: track.trackId === -1 ? null : String(track.trackId),
                duration_sec: track.durationSec,
              } as unknown as Partial<MasterSong>
            } as unknown as Partial<Song> & { master_song?: Partial<MasterSong> },
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
      hasAutoFetched.current = false;
      setIsModalOpen(false);
    };

    if (hasChanges) {
      setModalConfig({
        title: T('newSong.confirmDiscard'),
        message: T('newSong.discardMessage'),
        confirmText: T('common.clear'),
        cancelText: T('common.cancel'),
        type: 'warning',
      });
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
    <div className="min-h-screen">
      <Hero
        title={T('newSong.pageTitle')}
        description={T('newSong.pageDescription')}
        icon={<Music size={64} />}
      />

      <div className="container py-12 pb-48 px-6 max-w-5xl mx-auto">

        {/* エラー・成功メッセージ */}
        {error && <div className="alert alert--error">{error}</div>}
        {success && <div className="alert alert--success">{success}</div>}

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

              <div className="mt-8 pt-8 border-t border-[var(--border)] text-center">
                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
                  {T('newSong.importDescription')}
                </p>
                <Link 
                  href="/songs/import" 
                  className="btn btn--secondary inline-flex items-center gap-2 px-8"
                  onClick={(e) => handleNavigationClick(e, '/songs/import')}
                >
                  <FileUp size={18} /> {T('newSong.importTitle')}
                </Link>
              </div>
            </div>
          ) : (
            metadata && (
              <div className="card__body">
                <div className="video-preview">
                  {metadata.thumbnailUrl && (
                    <Image
                      src={metadata.thumbnailUrl}
                      alt={metadata.title}
                      width={320}
                      height={180}
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
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
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
                <div className="mb-6 flex items-center gap-2 bg-[var(--bg-tertiary)] p-3 rounded-xl border border-[var(--border)]">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isCoverVideo}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsCoverVideo(checked);
                          if (checked && metadata) {
                            setStartTime('0:00');
                            setEndTime(formatTime(metadata.duration));
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                    </div>
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">{T('newSong.isCover')}</span>
                  </label>
                  <div className="group relative">
                    <Info size={14} className="text-[var(--text-tertiary)]" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-[11px] text-[#999] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl leading-relaxed">
                      {T('newSong.coverTooltip')}
                    </div>
                  </div>
                </div>

                {/* 選択済みの曲カード */}
                {selectedSong ? (
                  <div className="selected-song">
                    <div className="selected-song__artwork bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden">
                      {selectedSong.artworkUrl ? (
                        <Image
                          src={selectedSong.artworkUrl}
                          alt={selectedSong.title}
                          width={80}
                          height={80}
                          className="object-cover"
                        />
                      ) : (
                        <Music size={32} className="text-[var(--text-tertiary)]" />
                      )}
                    </div>
                    <div className="selected-song__info">
                      <span className="selected-song__title text-lg font-bold">{selectedSong.title}</span>
                      <span className="selected-song__artist text-[var(--text-secondary)]">{selectedSong.artist}</span>
                    </div>
                    <button
                      onClick={handleClearSelection}
                      className="selected-song__clear"
                      title={T('common.clear')}
                    >
                      <X size={20} />
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
                      <div className="search-results max-h-[300px] overflow-y-auto mb-4 border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
                        {searchResults.map((track) => (
                          <button
                            key={track.trackId}
                            onClick={() => handleSelectSong(track)}
                            className="search-results__item w-full flex items-center gap-4 p-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
                          >
                             <Image
                               src={track.artworkUrl}
                               alt={track.title}
                               width={48}
                               height={48}
                               className="rounded-lg shadow-sm"
                             />
                            <div className="search-results__info flex-1 min-w-0">
                              <span className="search-results__title font-bold block truncate">{track.title}</span>
                              <span className="search-results__artist text-xs text-[var(--text-secondary)] block truncate">{track.artist}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded border border-[var(--border)]">
                                {formatTime(track.durationSec)}
                              </span>
                              <Music size={16} className="text-[var(--text-tertiary)]" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => {
                          setIsManualInput(!isManualInput);
                          if (!isManualInput) {
                            setManualTitle(searchQuery);
                            setManualArtist('');
                            setSearchResults([]);
                          }
                        }}
                        className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        {isManualInput ? T('newSong.backToSearch') : T('newSong.manualInput')}
                      </button>
                    </div>

                    {isManualInput && (
                      <div className="manual-input-form mb-6 p-6 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl space-y-4">
                        <div className="form-group mb-0">
                          <label className="form-label text-xs uppercase tracking-widest text-[var(--text-tertiary)]">{T('archive.title')}</label>
                          <input
                            type="text"
                            value={manualTitle}
                            onChange={(e) => setManualTitle(e.target.value)}
                            className="form-input"
                            placeholder={T('archive.title')}
                          />
                        </div>
                        <div className="form-group mb-0">
                          <label className="form-label text-xs uppercase tracking-widest text-[var(--text-tertiary)]">{T('archive.artist')}</label>
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
                          className="btn btn--secondary btn--full"
                          disabled={!manualTitle.trim()}
                        >
                          {T('newSong.confirmManual')}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 区間入力 */}
                <div className="form-row mt-6">
                  <div className="form-group mb-0">
                    <label htmlFor="start-time" className="form-label">
                      {T('newSong.startTime')} <span className="form-required">*</span>
                    </label>
                    <input
                      id="start-time"
                      type="text"
                      value={startTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartTime(val);
                        if (selectedSong && selectedSong.durationSec > 0) {
                          const s = parseTime(val);
                          if (s !== null) {
                            setEndTime(formatTime(s + selectedSong.durationSec));
                          }
                        }
                      }}
                      placeholder="m:ss or h:mm:ss"
                      className="form-input"
                      disabled={isPending}
                    />
                  </div>

                  <div className="form-group mb-0">
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
                  className="btn btn--primary btn--full mt-8 shadow-lg shadow-[var(--accent)]/20"
                >
                  {isPending ? T('newSong.adding') : T('newSong.addToList')}
                </button>
              </div>
            </div>

            {/* 統合された曲リスト */}
            {allSongs.length > 0 && (
              <div className="card mt-8">
                <div className="card__header px-6 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
                  <h2 className="card__title text-lg font-black">
                    {T('newSong.songList')} ({allSongs.length} {T('archive.songs')})
                  </h2>
                  <button
                    onClick={handleSaveAll}
                    disabled={isPending}
                    className="btn btn--success btn--sm flex items-center gap-2"
                  >
                    {isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {T('newSong.saveAll')}
                  </button>
                </div>
                <div className="card__body p-0">
                  <div className="edit-songs">
                    {allSongs.map((item, index) => (
                      <div
                        key={item.id || `new-${index}`}
                        className={`edit-songs__card ${item.isEditing ? 'edit-songs__card--active' : ''} ${item.isDeleted ? 'edit-songs__card--deleted' : ''}`}
                        style={{ border: 'none', borderRadius: 0, borderBottom: '1px solid var(--border)', opacity: item.isDeleted ? 0.6 : 1 }}
                      >
                        <div className="edit-songs__info-row" style={{ padding: '12px 16px' }}>
                          <span className="edit-songs__num" style={{ width: '24px' }}>{index + 1}</span>
                          {item.song.master_song?.artwork_url ? (
                            <Image
                              src={item.song.master_song.artwork_url}
                              alt={item.song.master_song.title}
                              width={40}
                              height={40}
                              className="edit-songs__artwork"
                            />
                          ) : (
                            <div className="edit-songs__artwork" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyItems: 'center', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                               <Music size={20} style={{ margin: 'auto' }} />
                            </div>
                          )}
                          <div className="edit-songs__info" style={{ flex: 1 }}>
                            <span className="edit-songs__title" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {tl(item.song.master_song?.title || '(不明)', item.song.master_song?.title_en || item.song.master_song?.title || '(Unknown)')}
                            </span>
                            <span className="edit-songs__artist" style={{ fontSize: '12px' }}>
                              {tl(item.song.master_song?.artist || '-', item.song.master_song?.artist_en || item.song.master_song?.artist || '-')}
                            </span>
                          </div>
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
                        </div>

                        {/* インライン編集フォーム */}
                        {item.isEditing && (
                          <div className="edit-songs__form" style={{ margin: '0 16px 16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <button
                              onClick={() => toggleChangeSong(index)}
                              className="edit-songs__change-song-btn"
                              style={{ marginBottom: '12px' }}
                            >
                              <Music size={14} />
                              {item.isChangingSong ? T('newSong.cancelChange') : T('newSong.changeSong')}
                            </button>

                            {item.isChangingSong && (
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
                                        <Image
                                          src={track.artworkUrl}
                                          alt={track.title}
                                          width={32}
                                          height={32}
                                          className="search-results__artwork"
                                        />
                                        <div className="search-results__info">
                                          <span className="search-results__title" style={{ fontSize: '12px' }}>{track.title}</span>
                                          <span className="search-results__artist" style={{ fontSize: '11px' }}>{track.artist}</span>
                                        </div>
                                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)', marginLeft: 'auto', flexShrink: 0 }}>
                                          {formatTime(track.durationSec)}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="form-row" style={{ gap: '8px', marginBottom: 0 }}>
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
          </div>
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
                      onChange={e => setVtuberForm(p => ({ ...p, gender: e.target.value as '男性' | '女性' | 'その他' | '不明' }))}
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
                  <label className="form-label">{tl('Twitter', 'X (Twitter)')}</label>
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
                    <Image src={channelDataForReg.image} width={40} height={40} style={{ borderRadius: '50%' }} alt="" />
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

      {/* 保存状況・完了モーダル */}
      {saveStatus !== 'idle' && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            if (saveStatus === 'success' || saveStatus === 'error') {
              setSaveStatus('idle');
            }
          }}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
              {saveStatus === 'saving' && (
                <>
                  <div className="modal-icon" style={{ border: 'none', background: 'transparent' }}>
                    <Loader2 size={48} className="text-[var(--accent)] animate-spin" />
                  </div>
                  <h3 className="modal-title" style={{ marginTop: '16px' }}>{T('newSong.saving')}</h3>
                  <p className="modal-text">
                    {T('newSong.saving')}...
                  </p>
                </>
              )}
              {saveStatus === 'success' && (
                <>
                  <div className="modal-icon modal-icon--info">
                    <Save size={32} />
                  </div>
                  <h3 className="modal-title">{T('newSong.saveComplete')}</h3>
                  <p className="modal-text">
                    {T('newSong.saveCompleteMessage')}
                  </p>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <div className="modal-icon modal-icon--danger">
                    <AlertCircle size={32} />
                  </div>
                  <h3 className="modal-title">{T('newSong.saveError')}</h3>
                  <p className="modal-text text-sm text-[var(--text-secondary)] mt-2" style={{ wordBreak: 'break-word' }}>
                    {saveErrorMsg}
                  </p>
                </>
              )}
            </div>
            {saveStatus === 'success' && (
              <div className="modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
                {metadata && (
                  <Link
                    href={`/videos/${metadata.videoId}`}
                    className="btn btn--primary btn--full text-center"
                    style={{ justifyContent: 'center' }}
                  >
                    {T('newSong.checkOnArchive')}
                  </Link>
                )}
                <button
                  className="btn btn--secondary btn--full"
                  onClick={() => setSaveStatus('idle')}
                >
                  {T('common.close')}
                </button>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
                <button
                  className="btn btn--primary btn--full"
                  onClick={performSave}
                >
                  {T('newSong.retry')}
                </button>
                <button
                  className="btn btn--secondary btn--full"
                  onClick={() => setSaveStatus('idle')}
                >
                  {T('common.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
