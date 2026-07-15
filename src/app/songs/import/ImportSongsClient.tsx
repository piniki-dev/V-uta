"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchVideoPreview, registerVideo, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel, fetchSpreadsheetCsvAction } from '../new/actions';
import type { ITunesSearchResult } from '../new/actions';
import type { YouTubeVideoMetadata, Video, Song, Production, MasterSong, YouTubeChannelData } from '@/types';
import { formatTime, parseTime, formatTimeFull } from '@/lib/utils';
import { 
  Search, X, Music, Info, Save, Trash2, AlertCircle, 
  UserPlus, Building2, FileUp, Table, ChevronRight,
  CheckCircle2, PlayCircle, Loader2, ExternalLink, RotateCcw,
  Youtube
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseCsv, processImportedData, type BatchArchive } from '@/utils/batch-parser';
import { useLocale } from '@/components/LocaleProvider';
import Image from 'next/image';
import Hero from '@/components/Hero';

interface EditableSong {
  id?: number;
  song: Omit<Partial<Song>, 'master_song'> & { master_song?: Partial<MasterSong> };
  startTime: string;
  endTime: string;
  isEditing: boolean;
  isChangingSong: boolean;
  searchQuery: string;
  searchResults: ITunesSearchResult[];
  isSearching: boolean;
  isPersisted: boolean;
  isDeleted?: boolean;
  isConfirmed: boolean;
  searchLocale?: 'ja' | 'en';
  // インポート元のデータ（左側に表示）
  importedTitle?: string;
  importedArtist?: string;
  importedStartTime?: string;
  importedEndTime?: string;
  validationError?: string;
}

interface BatchProgress {
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'loading';
  videoTitle?: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  duration?: number;
  publishedAt?: string;
  isSkipped?: boolean;
  isNotEmbeddable?: boolean;
}

export default function ImportSongsClient() {
  const { locale, t: tl, T } = useLocale();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // --- States ---
  const [batchArchives, setBatchArchives] = useState<BatchArchive[]>([]);
  const [progress, setProgress] = useState<Record<string, BatchProgress>>({});
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [gsUrl, setGsUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // Current Video States (similar to NewSongClient)
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [video, setVideo] = useState<Video | null>(null);
  const [allSongs, setAllSongs] = useState<EditableSong[]>([]);
  const [isAutoNext, setIsAutoNext] = useState(true);
  const [coverVideos, setCoverVideos] = useState<Record<string, boolean>>({});

  // VTuber登録モーダル等（NewSongClientから流用）
  const [isVtuberModalOpen, setIsVtuberModalOpen] = useState(false);
  const [isRegisteringVtuber, setIsRegisteringVtuber] = useState(false);
  const [productions, setProductions] = useState<Production[]>([]);
  const [vtuberForm, setVtuberForm] = useState<{
    name: string;
    gender: '男性' | '女性' | 'その他' | '不明';
    link: string;
    productionId: string;
    newProductionName: string;
  }>({
    name: '', gender: '不明', link: '', productionId: '', newProductionName: ''
  });
  const [channelDataForReg, setChannelDataForReg] = useState<YouTubeChannelData | null>(null);
  
  // Song Edit Modal States
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [editingSongIndex, setEditingSongIndex] = useState(-1);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSearchResults, setModalSearchResults] = useState<ITunesSearchResult[]>([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  const [isModalManualInput, setIsModalManualInput] = useState(false);
  const [modalManualTitle, setModalManualTitle] = useState('');
  const [modalManualArtist, setModalManualArtist] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // --- Refs (to keep latest values in callbacks without recreating dependencies) ---
  const allSongsRef = useRef(allSongs);
  const progressRef = useRef(progress);
  const currentBatchIndexRef = useRef(currentBatchIndex);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoNextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarContainerRef = useRef<HTMLDivElement>(null);

  const handleCloseModal = useCallback(() => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    setSaveStatus('idle');
  }, []);

  useEffect(() => {
    allSongsRef.current = allSongs;
  }, [allSongs]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    currentBatchIndexRef.current = currentBatchIndex;
  }, [currentBatchIndex]);

  // アクティブなバッチアイテムをスクロール領域の一番上にスクロール
  useEffect(() => {
    if (currentBatchIndex !== -1 && sidebarContainerRef.current) {
      const activeEl = document.getElementById(`batch-item-${currentBatchIndex}`);
      const container = sidebarContainerRef.current;
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        // ページ全体のスクロールを誘発させないように、コンテナの絶対スクロール位置を調整して上部に合わせる
        const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: relativeTop - 8, // 余白考慮
          behavior: 'smooth'
        });
      }
    }
  }, [currentBatchIndex]);

  useEffect(() => {
    const fetchProds = async () => {
      const prods = await getProductions();
      if (prods.success) setProductions(prods.data);
    };
    fetchProds();
  }, []);

  // 共通確認モーダル用のState
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);
  const [onCancelAction, setOnCancelAction] = useState<(() => void) | null>(null);
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

  // 変更があるかどうか（離脱警告の対象）
  const hasChanges = useMemo(() => {
    if (saveStatus === 'success' || saveStatus === 'error') return false;
    // 一括処理のバッチがあり、未完了の動画が1つでもある場合に警告を出す
    return batchArchives.length > 0 && Object.values(progress).some(p => p.status !== 'completed');
  }, [batchArchives, progress, saveStatus]);

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
          setOnCancelAction(null);
          setIsModalOpen(true);
        }
      }
    };

    // キャプチャフェーズでイベントを捕捉して、Next.js の Link コンポーネントの挙動より先に割り込む
    window.addEventListener('click', handleAnchorClick, true);
    return () => window.removeEventListener('click', handleAnchorClick, true);
  }, [hasChanges, router, T]);

  // --- Handlers ---



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
        
        // 初期進行状況のセット
        const initialProgress: Record<string, BatchProgress> = {};
        processed.forEach(item => {
          initialProgress[item.url] = { url: item.url, status: 'pending' };
        });
        setProgress(initialProgress);
        
        // バックグラウンド取得開始（最初の有効動画のロードも自動的に行う）
        prefetchBatchMetadata(processed);
      } catch (err) {
        setError(err instanceof Error ? err.message : T('newSong.csvLoadError'));
      }
    };
    reader.readAsText(file);
  };

  const handleGsImport = async () => {
    if (!gsUrl.trim()) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await fetchSpreadsheetCsvAction(gsUrl);
      if (!result.success) throw new Error(result.error);
      const text = result.data;
      const csvData = parseCsv(text);
      const processed = processImportedData(csvData);
      if (processed.length === 0) {
        setError(T('newSong.error'));
        return;
      }
      setBatchArchives(processed);
      
      const initialProgress: Record<string, BatchProgress> = {};
      processed.forEach(item => {
        initialProgress[item.url] = { url: item.url, status: 'pending' };
      });
      setProgress(initialProgress);
      
      // バックグラウンド取得開始（最初の有効動画のロードも自動的に行う）
      prefetchBatchMetadata(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : T('newSong.gsLoadError'));
    } finally {
      setIsLoading(false);
    }
  };


  const startProcessingItem = useCallback((index: number, archives = batchArchives, isManualClick = false) => {
    if (index < 0 || index >= archives.length) return;

    // 実際の読み込み＆処理開始ロジックを切り出し
    const proceedToItem = async () => {
      const item = archives[index];
      setError('');
      setSuccess('');
      
      // ヒーローセクションの下（メインコンテンツ開始位置）へスクロール
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // ステータス更新（すでに完了している場合は完了のままにする）
      setProgress(prev => {
        const currentStatus = prev[item.url]?.status;
        return {
          ...prev,
          [item.url]: { 
            ...prev[item.url], 
            status: currentStatus === 'completed' ? 'completed' : 'processing' 
          }
        };
      });

      setIsLoading(true);
      try {
        const info = progressRef.current[item.url];
        let result;
        
        // すでにバックグラウンドで取得済みならそれを使う
        if (info && info.videoTitle && info.thumbnailUrl) {
          result = await fetchVideoPreview(item.url);
        } else {
          result = await fetchVideoPreview(item.url);
        }

        if (!result.success) {
          setError(result.error);
          return;
        }

        // 埋め込み禁止チェック
        if (result.data.metadata.embeddable === false) {
          setProgress(prev => ({
            ...prev,
            [item.url]: { 
              ...prev[item.url], 
              status: 'completed',
              isSkipped: true,
              isNotEmbeddable: true,
              videoTitle: result.data.metadata.title,
              thumbnailUrl: result.data.metadata.thumbnailUrl,
              channelTitle: result.data.metadata.channelName,
              duration: result.data.metadata.duration,
              publishedAt: result.data.metadata.publishedAt
            }
          }));

          setMetadata(null);

          if (isManualClick) {
            setCurrentBatchIndex(index);
            setError('');
            setModalConfig({
              title: T('common.error') || 'Error',
              message: T('newSong.notEmbeddableError'),
              confirmText: T('common.confirm') || 'OK',
              cancelText: '',
              type: 'danger',
            });
            setOnConfirmAction(() => () => {
              setIsModalOpen(false);
            });
            setOnCancelAction(null);
            setIsModalOpen(true);
          } else {
            const nextIndex = index + 1;
            if (nextIndex < archives.length) {
              startProcessingItem(nextIndex, archives, false);
            } else {
              setSuccess(T('newSong.saveSuccess'));
            }
          }
          return;
        }
        
        setMetadata(result.data.metadata);
        setProgress(prev => ({
          ...prev,
          [item.url]: { 
            ...prev[item.url], 
            videoTitle: result.data.metadata.title,
            thumbnailUrl: result.data.metadata.thumbnailUrl,
            channelTitle: result.data.metadata.channelName,
            duration: result.data.metadata.duration,
            publishedAt: result.data.metadata.publishedAt
          }
        }));

        // チャンネル登録チェック（最優先）
        if (!result.data.isChannelRegistered && result.data.channelData) {
          setCurrentBatchIndex(index);
          const channelData = result.data.channelData as unknown as YouTubeChannelData;
          setChannelDataForReg(channelData);
          setVtuberForm(prev => ({
            ...prev,
            name: channelData.name,
            link: channelData.officialLink || ''
          }));
          setIsVtuberModalOpen(true);
        } else {
          const videoResult = await registerVideo(result.data.metadata);
          if (videoResult.success) setVideo(videoResult.data);
        }

        // 既存の曲
        const existingSongs: EditableSong[] = result.data.existingSongs.map(song => ({
          id: song.id,
          song,
          startTime: formatTimeFull(song.start_sec),
          endTime: formatTimeFull(song.end_sec),
          isEditing: false,
          isChangingSong: false,
          searchQuery: '',
          searchResults: [],
          isSearching: false,
          isPersisted: true,
          isConfirmed: true,
        }));

        // インポートされた曲を変換 & 自動マッチング
        const existingStartTimes = result.data.existingSongs.map(s => s.start_sec);
        const newImportSongs = item.songs.filter(s => {
          const startSec = parseTime(s.startTime);
          if (startSec === null) return true;
          return !existingStartTimes.some(existingSec => Math.abs(existingSec - startSec) <= 15);
        });

        const isSkipped = result.data.existingSongs.length > 0 && newImportSongs.length === 0;

        if (isSkipped) {
          setProgress(prev => ({
            ...prev,
            [item.url]: { 
              ...prev[item.url], 
              status: 'completed',
              isSkipped: true
            }
          }));

          setSuccess(T('newSong.skippedNoNewSongs', { title: result.data.metadata.title }));

          if (isManualClick) {
            setCurrentBatchIndex(index);
          } else {
            const nextIndex = index + 1;
            if (nextIndex < archives.length) {
              startProcessingItem(nextIndex, archives, false);
            } else {
              setSuccess(T('newSong.saveSuccess'));
            }
            return;
          }
        }

        // 正常に編集可能な状態が確定した時点で、初めてUIの選択インデックスを切り替える
        setCurrentBatchIndex(index);

        const convertedSongs: EditableSong[] = newImportSongs.map(s => ({
          song: {
            master_song: { title: s.title, artist: s.artist },
            start_sec: parseTime(s.startTime) || 0,
            end_sec: s.endTime ? parseTime(s.endTime) || 0 : 0
          },
          isEditing: false,
          isChangingSong: false,
          searchQuery: `${s.title} ${s.artist || ''}`.trim(),
          searchResults: [],
          isSearching: true,
          isPersisted: false,
          isConfirmed: false,
          importedTitle: s.title,
          importedArtist: s.artist,
          importedStartTime: s.startTime,
          importedEndTime: s.endTime || '',
          startTime: formatTimeFull(parseTime(s.startTime) || 0),
          endTime: s.endTime ? formatTimeFull(parseTime(s.endTime) || 0) : '',
        }));

        // カバー自動判定（配信ではない動画で、かつ全曲数が1曲以下の場合）
        const isActuallyCover = !result.data.metadata.isStream;
        const totalSongsCount = existingSongs.length + convertedSongs.length;
        const shouldCover = isActuallyCover && totalSongsCount <= 1;

        setCoverVideos(prev => ({
          ...prev,
          [item.url]: shouldCover
        }));

        let finalSongs = [...existingSongs, ...convertedSongs];
        if (shouldCover) {
          finalSongs = finalSongs.map(s => ({
            ...s,
            startTime: formatTimeFull(0),
            endTime: formatTimeFull(result.data.metadata.duration),
            song: {
              ...s.song,
              start_sec: 0,
              end_sec: result.data.metadata.duration
            }
          }));
        }

        setAllSongs(finalSongs);

        // 自動マッチング実行
        const matchPromises = convertedSongs.map(async (es, i) => {
          const country = locale === 'en' ? 'us' : 'jp';
          const lang = locale === 'en' ? 'en_us' : 'ja_jp';
          const searchResult = await searchSongAction(es.searchQuery, country, lang);
          
          if (searchResult.success && searchResult.data.length > 0) {
            const topResult = searchResult.data[0];
            return { index: existingSongs.length + i, track: topResult };
          }
          return { index: existingSongs.length + i, track: null };
        });

        const matchedResults = await Promise.all(matchPromises);
        
        setAllSongs(prev => prev.map((song, idx) => {
          const match = matchedResults.find(m => m.index === idx);
          if (match && match.track) {
            const track = match.track;
            const startSec = parseTime(song.startTime) || 0;
            let endSec = parseTime(song.endTime) || 0;
            
            // 終了時間が未入力(0)なら、iTunesの曲の長さから計算する
            if (endSec === 0 || endSec === startSec) {
              endSec = startSec + track.durationSec;
            }

            return {
              ...song,
              isSearching: false,
              isConfirmed: true,
              endTime: formatTimeFull(endSec),
              startTime: formatTimeFull(startSec),
              song: {
                ...song.song,
                end_sec: endSec,
                master_song: {
                  title: track.title,
                  artist: track.artist,
                  artwork_url: track.artworkUrl,
                  itunes_id: String(track.trackId),
                  duration_sec: track.durationSec,
                } as Partial<MasterSong>
              }
            };
          }
          return { ...song, isSearching: false };
        }));

        // 後続のマッチング処理等の終了のため、ここは何も行わない（チェックは上部に移動済み）
      } catch (err) {
        setError(err instanceof Error ? err.message : T('common.errorOccurred'));
      } finally {
        setIsLoading(false);
      }
    };

    // 現在処理中のアイテムがあり、それが別の動画への遷移であり、かつ未保存の場合に確認する
    const activeIndex = currentBatchIndexRef.current;
    if (activeIndex !== -1 && activeIndex !== index && archives[activeIndex]) {
      const currentUrl = archives[activeIndex].url;
      const currentProgress = progressRef.current[currentUrl];

      // 現在の動画の処理ステータスが「完了（completed）」になっていない場合、未保存とみなして一律で警告を出す
      if (currentProgress && currentProgress.status !== 'completed') {
        setModalConfig({
          title: T('newSong.confirmDiscard'),
          message: T('newSong.discardMessage'),
          confirmText: T('newSong.move'),
          cancelText: T('common.cancel'),
          type: 'warning',
        });
        setOnConfirmAction(() => proceedToItem);
        setOnCancelAction(null);
        setIsModalOpen(true);
        return;
      }
    }
    
    proceedToItem();
  }, [batchArchives, locale, T]);

  const prefetchBatchMetadata = useCallback((archives: BatchArchive[]) => {
    // 並列実行数を5に増やして、より高速化する
    const CONCURRENCY = 5;
    let index = 0;
    let hasStartedFirstValid = false;

    const runNext = async () => {
      if (index >= archives.length) return;
      
      const currentIndex = index++;
      const item = archives[currentIndex];

      // すでに処理済みか読み込み中ならスキップ
      if (progress[item.url]?.status === 'completed' || progress[item.url]?.status === 'loading' || progress[item.url]?.status === 'processing') {
        runNext();
        return;
      }

      setProgress(prev => ({
        ...prev,
        [item.url]: { ...prev[item.url], status: 'loading' }
      }));

      try {
        const result = await fetchVideoPreview(item.url);
        if (result.success) {
          const isNotEmbeddable = result.data.metadata.embeddable === false;
          const existingSongs = result.data.existingSongs || [];
          const existingStartTimes = existingSongs.map(s => s.start_sec);
          const newImportSongs = item.songs.filter(s => {
            const startSec = parseTime(s.startTime);
            if (startSec === null) return true;
            return !existingStartTimes.some(existingSec => Math.abs(existingSec - startSec) <= 15);
          });

          const isSkipped = (existingSongs.length > 0 && newImportSongs.length === 0) || isNotEmbeddable;

          setProgress(prev => ({
            ...prev,
            [item.url]: { 
              ...prev[item.url], 
              status: isSkipped ? 'completed' : 'pending',
              isSkipped: isSkipped,
              isNotEmbeddable: isNotEmbeddable,
              videoTitle: result.data.metadata.title,
              thumbnailUrl: result.data.metadata.thumbnailUrl,
              channelTitle: result.data.metadata.channelName,
              duration: result.data.metadata.duration,
              publishedAt: result.data.metadata.publishedAt
            }
          }));

          // 最初の有効な（スキップされない）動画が見つかり、まだ何もアクティブになっていない場合
          if (!isSkipped && !hasStartedFirstValid && currentBatchIndexRef.current === -1) {
            hasStartedFirstValid = true;
            startProcessingItem(currentIndex, archives, false);
          }
        } else {
          setProgress(prev => ({
            ...prev,
            [item.url]: { ...prev[item.url], status: 'completed', isSkipped: true }
          }));
        }
      } catch {
        setProgress(prev => ({
            ...prev,
            [item.url]: { ...prev[item.url], status: 'completed', isSkipped: true }
          }));
      }

      runNext();
    };

    for (let i = 0; i < Math.min(CONCURRENCY, archives.length); i++) {
      runNext();
    }
  }, [progress, startProcessingItem]);

  const goToNextItem = useCallback(() => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    setSaveStatus('idle');
    const nextIndex = currentBatchIndex + 1;
    if (nextIndex < batchArchives.length) {
      startProcessingItem(nextIndex);
    }
  }, [currentBatchIndex, batchArchives, startProcessingItem]);

  const performSave = useCallback(async () => {
    if (!metadata || currentBatchIndex === -1) return;
    setError('');
    setSuccess('');
    setSaveErrorMsg('');

    const currentUrl = batchArchives[currentBatchIndex].url;
    const isCurrentCover = coverVideos[currentUrl] || false;

    // 歌ってみた動画バリデーション
    const activeSongs = allSongs.filter(s => (s.isConfirmed || s.id) && !s.isDeleted);
    if (isCurrentCover && activeSongs.length > 1) {
      setError(T('newSong.isCoverError'));
      return;
    }

    // 一括バリデーションチェック
    let firstErrorIndex = -1;
    const validatedSongs = allSongs.map((item, index) => {
      const isTarget = (item.isConfirmed || item.id) && !item.isDeleted;
      if (!isTarget) {
        return { ...item, validationError: undefined };
      }

      const startSec = parseTime(item.startTime);
      const endSec = parseTime(item.endTime);
      let validationError: string | undefined = undefined;

      if (!item.song.master_song?.title?.trim()) {
        validationError = T('newSong.validationTitleRequired');
      } else if (startSec === null) {
        validationError = T('newSong.validationStartTimeError');
      } else if (endSec === null) {
        validationError = T('newSong.validationEndTimeError');
      } else if (startSec >= endSec) {
        validationError = T('newSong.validationTimeRangeError');
      } else if (endSec - startSec < 10) {
        validationError = T('newSong.validationDurationError');
      }

      if (validationError && firstErrorIndex === -1) {
        firstErrorIndex = index;
      }

      return { ...item, validationError };
    });

    if (firstErrorIndex !== -1) {
      setAllSongs(validatedSongs);
      setSaveStatus('idle');
      
      // 最初のエラー項目へスクロール
      setTimeout(() => {
        const targetElement = document.getElementById(`song-card-${firstErrorIndex}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    // エラーがなかった場合はエラーをクリアし、保存中ステータスにする
    setAllSongs(prev => prev.map(s => ({ ...s, validationError: undefined })));
    setSaveStatus('saving');

    // 保存対象
    const songsToRegister = allSongs
      .filter(s => s.isConfirmed || s.id)
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
        searchLocale: item.searchLocale || (locale as 'ja' | 'en'),
      }));

    setIsLoading(true);
    try {
      const result = await registerFullArchive({
        videoMetadata: {
          ...metadata,
          isStream: isCurrentCover ? false : metadata.isStream,
        },
        songs: songsToRegister,
      });

      if (!result.success) {
        setError(result.error);
        setSaveErrorMsg(result.error);
        setSaveStatus('error');
        return;
      }

      setSuccess(T('newSong.saveSuccess'));
      
      // 進捗を完了にする
      const currentUrl = batchArchives[currentBatchIndex].url;
      setProgress(prev => ({
        ...prev,
        [currentUrl]: { ...prev[currentUrl], status: 'completed' }
      }));

      setSaveStatus('success');

      // 自動遷移
      if (isAutoNext) {
        let nextIndex = currentBatchIndex + 1;
        // すでにバックグラウンド取得で completed (スキップ) になっているものは一気にスキップ
        while (nextIndex < batchArchives.length) {
          const nextUrl = batchArchives[nextIndex].url;
          const nextProgress = progressRef.current[nextUrl];
          if (nextProgress && nextProgress.status === 'completed') {
            nextIndex++;
          } else {
            break;
          }
        }

        if (nextIndex < batchArchives.length) {
          if (autoNextTimeoutRef.current) {
            clearTimeout(autoNextTimeoutRef.current);
          }
          autoNextTimeoutRef.current = setTimeout(() => {
            setSaveStatus('idle');
            startProcessingItem(nextIndex);
          }, 2000);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : T('common.errorOccurred');
      setError(msg);
      setSaveErrorMsg(msg);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [metadata, allSongs, locale, T, batchArchives, currentBatchIndex, isAutoNext, startProcessingItem, coverVideos]);

  const handleSaveBatch = () => {
    performSave();
  };

  const handleRegisterVtuber = async () => {
    if (!channelDataForReg) return;
    setIsRegisteringVtuber(true);
    setError('');
    try {
      const result = await registerVtuberAndChannel({
        vtuberName: vtuberForm.name,
        gender: vtuberForm.gender,
        vtuberLink: vtuberForm.link,
        productionId: (vtuberForm.productionId && vtuberForm.productionId !== 'new') ? Number(vtuberForm.productionId) : undefined,
        newProductionName: vtuberForm.productionId === 'new' ? vtuberForm.newProductionName : undefined,
        channelData: channelDataForReg,
      });
      if (result.success) {
        setIsVtuberModalOpen(false);
        if (metadata) {
          const videoResult = await registerVideo(metadata);
          if (videoResult.success) setVideo(videoResult.data);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : T('common.errorOccurred'));
    } finally {
      setIsRegisteringVtuber(false);
    }
  };

  const resetImportState = () => {
    setBatchArchives([]);
    setProgress({});
    setCurrentBatchIndex(-1);
    setGsUrl('');
    setMetadata(null);
    setVideo(null);
    setAllSongs([]);
    setError('');
    setSuccess('');
  };

  const handleCancelVtuberRegister = () => {
    setIsVtuberModalOpen(false);
    setModalConfig({
      title: T('vtuber.cancelConfirmTitle'),
      message: T('vtuber.cancelConfirmMessage'),
      confirmText: T('vtuber.cancelConfirmButton'),
      cancelText: T('vtuber.cancelBackButton'),
      type: 'danger',
    });
    setOnConfirmAction(() => () => {
      resetImportState();
    });
    setOnCancelAction(() => () => {
      setIsVtuberModalOpen(true);
    });
    setIsModalOpen(true);
  };

  const handleToggleCoverVideo = (checked: boolean) => {
    if (!metadata || currentBatchIndex === -1) return;
    const currentUrl = batchArchives[currentBatchIndex].url;

    if (checked) {
      const activeSongs = allSongs.filter(s => (s.isConfirmed || s.id) && !s.isDeleted);
      if (activeSongs.length > 1) {
        setModalConfig({
          title: T('newSong.isCoverError') || '歌ってみた動画に登録できるのは1曲のみです',
          message: '現在2曲以上の楽曲が登録されています。歌ってみた動画として登録するには、不要な楽曲を削除してください。',
          confirmText: T('common.confirm') || '了解',
          cancelText: '',
          type: 'warning',
        });
        setOnConfirmAction(() => () => {});
        setOnCancelAction(null);
        setIsModalOpen(true);
        return;
      }

      setCoverVideos(prev => ({
        ...prev,
        [currentUrl]: true
      }));

      setAllSongs(prev => prev.map(s => {
        if ((s.isConfirmed || s.id) && !s.isDeleted) {
          return {
            ...s,
            startTime: formatTimeFull(0),
            endTime: formatTimeFull(metadata.duration),
            song: {
              ...s.song,
              start_sec: 0,
              end_sec: metadata.duration
            }
          };
        }
        return s;
      }));
    } else {
      setCoverVideos(prev => ({
        ...prev,
        [currentUrl]: false
      }));
    }
  };

  // --- Inline Helpers ---
  const updateSongField = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setAllSongs(prev => prev.map((s, i) => i === index ? { ...s, [field]: value, validationError: undefined } : s));
  };
  const handleDeleteSong = (index: number) => {
    setAllSongs((prev) =>
      prev.map((it, i) => (i === index ? { ...it, isDeleted: !it.isDeleted } : it))
    );
  };
  const openSongEditModal = (index: number) => {
    const item = allSongs[index];
    setEditingSongIndex(index);
    // RAW DATA（インポート元のデータ）を優先して検索の初期値にする
    const defaultSearchQuery = item.importedTitle 
      ? `${item.importedTitle} ${item.importedArtist || ''}`.trim() 
      : (item.song.master_song?.title || '');

    setModalSearchQuery(defaultSearchQuery);
    setModalManualTitle(item.importedTitle || '');
    setModalManualArtist(item.importedArtist || '');
    setModalSearchResults([]);
    setIsModalManualInput(false); // 自動検索を行うため一旦手動入力はオフにする
    setHasSearched(false); // 検索実行フラグをリセット
    setIsSongModalOpen(true);

    // モーダルを開いた瞬間に自動で検索を実行する
    if (defaultSearchQuery.trim()) {
      handleModalSearch(defaultSearchQuery);
    }
  };

  const handleModalSearch = async (overrideQuery?: string) => {
    const query = (typeof overrideQuery === 'string' ? overrideQuery : modalSearchQuery).trim();
    if (!query) return;
    setIsModalSearching(true);
    setIsModalManualInput(false);
    setHasSearched(true); // 検索実行済みフラグをオンにする
    const country = locale === 'en' ? 'us' : 'jp';
    const lang = locale === 'en' ? 'en_us' : 'ja_jp';
    const result = await searchSongAction(query, country, lang);
    setIsModalSearching(false);
    if (result.success) {
      setModalSearchResults(result.data);
      if (result.data.length === 0) setIsModalManualInput(true);
    }
  };

  const handleSelectSongFromModal = (track: ITunesSearchResult) => {
    if (editingSongIndex === -1) return;
    handleSelectSongInPlace(editingSongIndex, track);
    setIsSongModalOpen(false);
  };

  const handleConfirmManualInput = () => {
    if (editingSongIndex === -1) return;
    const manualTrack: ITunesSearchResult = {
      trackId: -1,
      title: modalManualTitle || 'Unknown Title',
      artist: modalManualArtist || 'Unknown Artist',
      artworkUrl: '',
      durationSec: 0,
      albumName: 'Manual Entry'
    };
    handleSelectSongInPlace(editingSongIndex, manualTrack);
    setIsSongModalOpen(false);
  };

  const handleSelectSongInPlace = (index: number, track: ITunesSearchResult) => {
    setAllSongs(prev => prev.map((s, i) => {
      if (i === index) {
        let updatedEndTime = s.endTime;
        let updatedEndSec = s.song.end_sec || 0;

        // 元々のインポートデータに終了時間がなかった場合のみ、終了時間を計算またはクリア
        if (!s.importedEndTime || s.importedEndTime === '' || s.importedEndTime === '0:00' || s.importedEndTime === '0') {
          const startSec = parseTime(s.startTime) || 0;
          if (track.trackId === -1) {
            // 手動入力の場合、終了時間をクリアする
            updatedEndSec = 0;
            updatedEndTime = '';
          } else {
            updatedEndSec = track.durationSec > 0 ? startSec + track.durationSec : updatedEndSec;
            updatedEndTime = formatTimeFull(updatedEndSec);
          }
          // 開始時間も整形
          s.startTime = formatTimeFull(startSec);
        }

        return {
          ...s,
          isConfirmed: true,
          isChangingSong: false,
          searchResults: [],
          validationError: undefined,
          endTime: updatedEndTime,
          song: {
            ...s.song,
            end_sec: updatedEndSec,
            master_song: {
              title: track.title,
              artist: track.artist,
              artwork_url: track.artworkUrl || '',
              itunes_id: track.trackId === -1 ? null : String(track.trackId),
              duration_sec: track.durationSec
            } as Partial<MasterSong>
          }
        };
      }
      return s;
    }));
  };

  // --- Render ---

  return (
    <div className="min-h-screen">
      <Hero 
        title={T('newSong.importTitle')} 
        description={T('newSong.importDescription')} 
        icon={<FileUp size={64} />} 
      />

      <div ref={contentRef} style={{ scrollMarginTop: '80px' }} className="container py-8 px-6 max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar: Progress Monitor */}
        {batchArchives.length > 0 && (
          <div className="md:w-80 flex-shrink-0">
            <div className="card sticky top-24">
              <div className="card__header p-4 border-b border-[var(--border)]">
                <h3 className="font-bold flex items-center gap-2">
                  <Table size={18} />
                  {T('newSong.importSummary')}
                </h3>
              </div>
              <div ref={sidebarContainerRef} className="card__body p-2 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1">
                  {batchArchives.map((item, idx) => {
                    const info = progress[item.url];
                    const isCurrent = currentBatchIndex === idx;
                    return (
                      <button
                        key={idx}
                        id={`batch-item-${idx}`}
                        onClick={() => startProcessingItem(idx, batchArchives, true)}
                        disabled={isLoading}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all border-2 mb-1 group ${
                          isCurrent 
                            ? 'bg-[var(--accent)]/10 border-[var(--accent)]' 
                            : 'bg-transparent border-transparent hover:bg-[var(--bg-tertiary)]'
                        } ${info?.status === 'completed' ? 'opacity-60 grayscale-[0.3]' : ''}`}
                      >
                        {/* Thumbnail or Icon */}
                        <div className="relative w-20 h-12 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden flex-shrink-0 border border-[var(--border)] shadow-sm">
                          {info?.thumbnailUrl ? (
                            <Image src={info.thumbnailUrl} alt="" fill className="object-cover transition-transform group-hover:scale-110" />
                          ) : (
                            <div className="inset-0 flex items-center justify-center text-[var(--text-tertiary)] opacity-30">
                              {info?.status === 'loading' ? <Loader2 className="animate-spin" size={20} /> : <PlayCircle size={20} />}
                            </div>
                          )}
                          {info?.status === 'completed' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                              {info.isNotEmbeddable ? (
                                <div className="px-2 py-0.5 rounded bg-red-950 text-[10px] text-red-300 border border-red-800 font-bold shadow-lg animate-in zoom-in-50 duration-200">
                                  {T('newSong.skipped')}
                                </div>
                              ) : info.isSkipped ? (
                                <div className="px-2 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300 border border-gray-600 font-bold shadow-lg animate-in zoom-in-50 duration-200">
                                  {T('newSong.skipped')}
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg border-2 border-emerald-500 animate-in zoom-in-50 duration-200">
                                  <CheckCircle2 size={20} className="text-emerald-500 fill-emerald-500/10" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold truncate leading-tight mb-1 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                            {info?.videoTitle || (info?.status === 'loading' ? 'Loading metadata...' : `Video ${idx + 1}`)}
                          </p>
                          {info?.isNotEmbeddable ? (
                            <p className="text-[10px] font-bold text-[var(--error)] truncate mt-0.5 animate-pulse">
                              ⚠️ {T('newSong.skippedCount') === 'skipped' ? 'Embedding disabled' : '埋め込み禁止動画'}
                            </p>
                          ) : info?.channelTitle && (
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate uppercase tracking-tight">{info.channelTitle}</p>
                              {info?.publishedAt && (
                                <>
                                  <span className="text-[9px] text-[var(--text-tertiary)] opacity-40">•</span>
                                  <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
                                    {new Date(info.publishedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>


                        {isCurrent && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]" />
                        )}
                      </button>

                    );
                  })}
                </div>
              </div>
              <div className="card__footer p-4 border-t border-[var(--border)] bg-[var(--bg-tertiary)]/50">
                <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                  <span>
                    {Object.values(progress).filter(p => p.status === 'completed').length} / {batchArchives.length} {T('newSong.processed')}
                    {Object.values(progress).filter(p => p.status === 'completed' && p.isSkipped).length > 0 && (
                      <span className="text-[var(--text-tertiary)] font-normal text-[10px] ml-1">
                        ({Object.values(progress).filter(p => p.status === 'completed' && p.isSkipped).length} {T('newSong.skippedCount')})
                      </span>
                    )}
                  </span>
                  <span>{Math.round((Object.values(progress).filter(p => p.status === 'completed').length / batchArchives.length) * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--accent)] transition-all duration-500" 
                    style={{ width: `${(Object.values(progress).filter(p => p.status === 'completed').length / batchArchives.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {error && <div className="alert alert--error mb-6" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
          {success && <div className="alert alert--success mb-6" style={{ whiteSpace: 'pre-wrap' }}>{success}</div>}

          {batchArchives.length === 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-8 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-[var(--accent-subtle)] text-[var(--accent)] rounded-2xl flex items-center justify-center shadow-inner border border-[var(--accent)]/10">
                    <FileUp size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{T('newSong.fromCsv')}</h3>
                    <p className="text-[var(--text-secondary)] text-sm">{T('newSong.csvDescription')}</p>
                  </div>
                  <label className="btn btn--primary w-full cursor-pointer">
                    {T('newSong.selectFile')}
                    <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                  </label>
                 </div>

                <div className="card p-8 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner border border-emerald-500/10">
                    <Table size={32} />
                  </div>
                  <div className="w-full">
                    <h3 className="text-xl font-bold mb-2">{T('newSong.fromGoogleSheet')}</h3>
                    <input 
                      type="text" 
                      className="form-input w-full mb-4" 
                      placeholder={T('newSong.enterGsUrl')}
                      value={gsUrl}
                      onChange={(e) => setGsUrl(e.target.value)}
                    />
                  </div>
                  <button className="btn btn--secondary w-full" onClick={handleGsImport} disabled={isLoading || !gsUrl.trim()}>
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={16} />
                        {T('newSong.fetching')}
                      </span>
                    ) : (
                      T('newSong.fetch')
                    )}
                  </button>
                </div>
              </div>

              {/* インポートフォーマット解説カード */}
              <div className="card p-6 md:p-8 space-y-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border)] pb-5">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                      <Info className="text-[var(--accent)]" size={22} />
                      {T('newSong.importGuideTitle')}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-xs mt-1">
                      {T('newSong.importGuideSubtitle')}
                    </p>
                  </div>
                  <a
                    href={locale === 'en' ? '/template_import_en.csv' : '/template_import.csv'}
                    download
                    className="btn btn--secondary btn--sm flex items-center gap-2 whitespace-nowrap text-xs font-bold"
                  >
                    <FileUp size={14} className="rotate-180" />
                    {T('newSong.csvTemplateDownload')}
                  </a>
                </div>

                {/* テーブル仕様説明 */}
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="py-3 px-4 font-black">{T('newSong.columnName')}</th>
                        <th className="py-3 px-4 font-black w-24">{T('newSong.columnRequired')}</th>
                        <th className="py-3 px-4 font-black w-24">{T('newSong.columnType')}</th>
                        <th className="py-3 px-4 font-black">{T('newSong.columnDescription')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/50 text-[var(--text-primary)]">
                      <tr>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          {locale === 'en' ? 'url' : '動画URL / url'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-red-500/10 text-red-500 px-2.5 py-1 rounded font-bold text-[10px] tracking-wide">
                            {T('newSong.requiredLabel')}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">URL</td>
                        <td className="py-4 px-4 text-[var(--text-secondary)] leading-relaxed">
                          {T('newSong.formatUrlDesc')}
                          <div className="mt-1 font-mono text-[10px] opacity-75">
                            ex) https://www.youtube.com/watch?v=j_vHt_7PbUg
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          {locale === 'en' ? 'title' : '曲名 / title'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-red-500/10 text-red-500 px-2.5 py-1 rounded font-bold text-[10px] tracking-wide">
                            {T('newSong.requiredLabel')}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">String</td>
                        <td className="py-4 px-4 text-[var(--text-secondary)] leading-relaxed">
                          {T('newSong.formatTitleDesc')}
                          <div className="mt-1 font-mono text-[10px] opacity-75">
                            {locale === 'en' ? 'ex) Suki no Oto' : 'ex) スキノオト'}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          {locale === 'en' ? 'artist' : '歌手 / artist'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded font-bold text-[10px] tracking-wide">
                            {T('newSong.optionalLabel')}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">String</td>
                        <td className="py-4 px-4 text-[var(--text-secondary)] leading-relaxed">
                          {T('newSong.formatArtistDesc')}
                          <div className="mt-1 font-mono text-[10px] opacity-75">
                            {locale === 'en' ? 'ex) Nekoma Shiroa' : 'ex) 猫魔しろあ'}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          {locale === 'en' ? 'start' : '開始時間 / start'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-red-500/10 text-red-500 px-2.5 py-1 rounded font-bold text-[10px] tracking-wide">
                            {T('newSong.requiredLabel')}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">Time</td>
                        <td className="py-4 px-4 text-[var(--text-secondary)] leading-relaxed">
                          {T('newSong.formatStartDesc')}
                          <div className="mt-1 font-mono text-[10px] opacity-75">
                            ex) 0:47:47 / 2867
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          {locale === 'en' ? 'end' : '終了時間 / end'}
                        </td>
                        <td className="py-4 px-4">
                          <span className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded font-bold text-[10px] tracking-wide">
                            {T('newSong.optionalLabel')}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">Time</td>
                        <td className="py-4 px-4 text-[var(--text-secondary)] leading-relaxed">
                          {T('newSong.formatEndDesc')}
                          <div className="mt-1 font-mono text-[10px] opacity-75">
                            ex) 0:51:08 / 3068
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Googleスプレッドシートガイド手順 */}
                <div className="border-t border-[var(--border)] pt-6">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Table size={16} className="text-emerald-500" />
                    {T('newSong.googleSheetGuideTitle')}
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed pl-1">
                    <li>{T('newSong.googleSheetStep1')}</li>
                    <li>{T('newSong.googleSheetStep2')}</li>
                    <li>{T('newSong.googleSheetStep3')}</li>
                    <li>{T('newSong.googleSheetStep4')}</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-6 animate-pulse">
                  {/* Active Item Metadata Skeleton */}
                  <div className="card bg-[var(--bg-secondary)] overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-64 aspect-video bg-[var(--bg-tertiary)]" />
                      <div className="p-6 flex-1 space-y-4">
                        <div className="h-6 bg-[var(--bg-tertiary)] rounded-lg w-2/3" />
                        <div className="space-y-2">
                          <div className="h-4 bg-[var(--bg-tertiary)] rounded-lg w-full" />
                          <div className="h-4 bg-[var(--bg-tertiary)] rounded-lg w-5/6" />
                        </div>
                        <div className="h-8 bg-[var(--bg-tertiary)] rounded-xl w-32" />
                      </div>
                    </div>
                  </div>

                  {/* Header Skeleton */}
                  <div className="flex justify-between items-center pb-4 border-b border-[var(--border)]">
                    <div className="h-6 bg-[var(--bg-secondary)] rounded-lg w-40" />
                    <div className="h-9 bg-[var(--bg-secondary)] rounded-xl w-24" />
                  </div>

                  {/* Song List Skeleton */}
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="card p-6 bg-[var(--bg-secondary)] border border-[var(--border)]/50 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="h-5 bg-[var(--bg-tertiary)] rounded-lg w-1/3" />
                          <div className="h-4 bg-[var(--bg-tertiary)] rounded-lg w-1/4" />
                        </div>
                        <div className="w-48 h-12 bg-[var(--bg-tertiary)] rounded-xl" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Item Metadata */}
                  {metadata && (
                <div className="card bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-64 aspect-video relative">
                      <Image src={metadata.thumbnailUrl} alt="" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <a href={`https://youtube.com/watch?v=${metadata.videoId}`} target="_blank" className="text-white p-2 bg-black/60 rounded-full">
                          <ExternalLink size={20} />
                        </a>
                      </div>
                    </div>
                    <div className="p-6 flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <h2 className="text-xl font-bold truncate text-[var(--accent)]">{metadata.title}</h2>
                        <span className="text-xs font-mono bg-[var(--bg-tertiary)] px-2 py-1 rounded border border-[var(--border)]">
                          {formatTime(metadata.duration)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">{metadata.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-6">
                        {/* 歌ってみた動画トグル */}
                        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={batchArchives[currentBatchIndex] ? (coverVideos[batchArchives[currentBatchIndex].url] || false) : false}
                                onChange={(e) => {
                                  handleToggleCoverVideo(e.target.checked);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-10 h-5 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                            </div>
                            <span className="text-[13px] font-bold text-[var(--text-primary)]">{T('newSong.isCover')}</span>
                          </label>
                          <div className="group relative">
                            <Info size={14} className="text-[var(--text-tertiary)] animate-pulse" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-[11px] text-[#999] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl leading-relaxed">
                              {T('newSong.coverTooltip')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="auto-next" 
                            checked={isAutoNext} 
                            onChange={(e) => setIsAutoNext(e.target.checked)}
                            className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] bg-[var(--bg-tertiary)]"
                          />
                          <label htmlFor="auto-next" className="text-sm font-medium text-[var(--text-secondary)]">
                            {T('newSong.autoNextEnabled')}
                          </label>
                        </div>
                        <button 
                          className="btn btn--primary btn--sm ml-auto flex items-center gap-2"
                          onClick={handleSaveBatch}
                          disabled={isLoading || allSongs.filter(s => !s.isDeleted).length === 0}
                        >
                          {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                          {T('newSong.saveAll')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison List */}
              <div className="space-y-4">
                {allSongs.map((item, index) => (
                  <div 
                    key={index} 
                    id={`song-card-${index}`}
                    className={`card overflow-hidden transition-all ${
                      item.isDeleted 
                        ? 'opacity-40 grayscale scale-[0.98]' 
                        : item.validationError 
                          ? 'border-red-500 bg-red-500/5 shadow-sm shadow-red-500/5' 
                          : 'hover:border-[var(--accent)]/40 shadow-sm'
                    }`}
                  >
                    {/* Top Section: Raw Imported Data */}
                    <div className="bg-[var(--bg-tertiary)]/50 px-4 py-3 border-b border-[var(--border)] flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-widest whitespace-nowrap">
                        <FileUp size={14} />
                        RAW DATA
                      </div>
                      <div className="flex-1 min-w-[200px] flex items-center gap-3 overflow-hidden">
                        <p className="text-sm font-bold text-[var(--text-secondary)] truncate" title={item.importedTitle}>{item.importedTitle || '-'}</p>
                        <span className="text-[var(--border)]">|</span>
                        <p className="text-sm text-[var(--text-tertiary)] truncate" title={item.importedArtist}>{item.importedArtist || '-'}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px] font-sans font-black">START:</span> {item.importedStartTime || '-'}</span>
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px] font-sans font-black">END:</span> {item.importedEndTime || '-'}</span>
                      </div>
                    </div>

                    {/* Divider Icon */}
                    <div className="flex justify-center -mt-[11px] mb-[-11px] relative z-10">
                      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-full p-0.5 text-[var(--text-tertiary)] shadow-sm">
                        <ChevronRight size={14} className="rotate-90" />
                      </div>
                    </div>

                    {/* Bottom Section: Matched & Editable Result */}
                    <div className="p-4 flex flex-col md:flex-row items-center gap-6">
                      <div className="relative w-24 h-24 bg-[var(--bg-tertiary)] rounded-2xl overflow-hidden border border-[var(--border)] shadow-inner flex-shrink-0">
                        {item.song.master_song?.artwork_url ? (
                          <Image src={item.song.master_song.artwork_url} alt="" fill className="object-cover" />
                        ) : (
                          <div className="inset-0 flex items-center justify-center text-[var(--text-tertiary)]">
                            <Music size={32} />
                          </div>
                        )}
                        {item.isSearching && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                            <Loader2 className="animate-spin text-white" size={24} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 text-[10px] font-black text-[var(--accent)] uppercase tracking-widest">
                            <Save size={12} />
                            Registration Data
                          </div>
                          {item.isConfirmed ? (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                              <CheckCircle2 size={10} /> ITUNES MATCHED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                              <AlertCircle size={10} /> UNMATCHED (IMPORT DATA)
                            </span>
                          )}
                        </div>
                        
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
                            {/* 曲名・アーティスト名の領域を最大化 */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-lg font-bold truncate ${item.isConfirmed ? 'text-[var(--text-primary)]' : 'text-red-500 italic'}`}>
                                {item.song.master_song?.title || '⚠️ No Match Found'}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] font-medium truncate mb-3">
                                {item.song.master_song?.artist || 'Click to search manually'}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <button onClick={() => openSongEditModal(index)} className="btn btn--sm btn--secondary flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider h-8">
                                  <Search size={12} /> {T('newSong.changeSong')}
                                </button>
                        {item.validationError && (
                                  <div className="text-red-500 text-xs font-bold flex items-center gap-1.5 bg-red-500/10 p-1.5 px-3 rounded-lg border border-red-500/20 shadow-sm">
                                    <AlertCircle size={14} className="flex-shrink-0" />
                                    <span>{item.validationError}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 時間入力エリアをコンパクトに右側に配置 */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-[var(--bg-tertiary)]/50 p-2 px-3 rounded-xl border border-[var(--border)]/40 relative">
                              {metadata && (
                                <a 
                                  href={`https://www.youtube.com/watch?v=${metadata.videoId}&t=${parseTime(item.startTime) || 0}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn--sm btn--secondary flex items-center gap-1.5 text-[9px] font-bold py-1 px-2 h-auto w-full justify-center text-[var(--text-secondary)] hover:text-white"
                                  title={T('newSong.playFromStart')}
                                >
                                  <Youtube size={12} className="text-red-500 flex-shrink-0" />
                                  <span>{T('newSong.playFromStart')}</span>
                                </a>
                              )}
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-black text-[var(--text-tertiary)] mb-0.5">START</span>
                                  <input 
                                    type="text" 
                                    className="input input--sm w-20 font-mono text-center bg-transparent border-none focus:ring-0 text-sm font-bold p-0 h-auto" 
                                    value={item.startTime}
                                    onChange={(e) => updateSongField(index, 'startTime', e.target.value)}
                                  />
                                </div>
                                <div className="text-[var(--text-tertiary)] font-light mt-1">→</div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-black text-[var(--text-tertiary)] mb-0.5">END</span>
                                  <input 
                                    type="text" 
                                    className={`input input--sm w-20 font-mono text-center bg-transparent border-none focus:ring-0 text-sm font-bold p-0 h-auto ${(!item.endTime || item.endTime === '0:00') ? 'text-red-500' : ''}`} 
                                    value={item.endTime}
                                    onChange={(e) => updateSongField(index, 'endTime', e.target.value)}
                                    placeholder="Required"
                                  />
                                </div>
                              </div>

                              {(!item.endTime || item.endTime === '0:00') && (
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-red-500 font-bold text-[8px] tracking-tight animate-pulse whitespace-nowrap bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-red-500/10 shadow-sm z-10">
                                  <AlertCircle size={10} className="flex-shrink-0" />
                                  <span>{T('newSong.missingEndTime')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          onClick={() => handleDeleteSong(index)} 
                          className={`btn btn--sm p-3 rounded-xl transition-colors ${
                            item.isDeleted 
                              ? 'btn--primary text-white !bg-emerald-500 hover:!bg-emerald-600 border-none' 
                              : 'btn--secondary text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10'
                          }`}
                          title={item.isDeleted ? 'Restore' : 'Delete'}
                        >
                          {item.isDeleted ? <RotateCcw size={18} /> : <Trash2 size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                ))}
              </div>

              {/* 下部保存ボタン */}
              <div className="flex justify-end pt-4">
                <button 
                  className="btn btn--primary btn--lg flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20"
                  onClick={handleSaveBatch}
                  disabled={isLoading || allSongs.filter(s => !s.isDeleted).length === 0}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {T('newSong.saveAll')}
                </button>
              </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Song Edit Modal --- */}
      {isSongModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSongModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Music className="text-[var(--accent)]" size={20} />
                {T('newSong.changeSong')}
              </h3>
              <button 
                onClick={() => setIsSongModalOpen(false)}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Search Section */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest mb-2 block">
                  Search iTunes
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl px-4 focus-within:border-[var(--accent)] transition-all h-12">
                    <Search className="text-[var(--text-tertiary)] !flex-shrink-0" size={20} />
                    <input 
                      type="text" 
                      className="bg-transparent border-none focus:outline-none w-full h-full text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                      placeholder="Title or Artist..."
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleModalSearch()}
                    />
                  </div>
                  <button 
                    onClick={() => handleModalSearch()}
                    disabled={isModalSearching}
                    className="btn btn--primary aspect-square p-0 w-12 h-12 flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 rounded-xl"
                  >
                    {isModalSearching ? (
                      <Loader2 className="animate-spin !flex-shrink-0" size={20} />
                    ) : (
                      <Search className="!flex-shrink-0" size={20} />
                    )}
                  </button>
                </div>

              </div>

              {/* Search Results */}
              {!isModalManualInput && modalSearchResults.length > 0 && (
                <div className="space-y-2 mb-6 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-widest mb-1 block">
                    Select a Result
                  </label>
                  {modalSearchResults.map(track => (
                    <button
                      key={track.trackId}
                      onClick={() => handleSelectSongFromModal(track)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 border border-transparent rounded-2xl transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] overflow-hidden flex-shrink-0 border border-[var(--border)]">
                        {track.artworkUrl ? (
                          <Image src={track.artworkUrl} alt="" width={48} height={48} className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                            <Music size={20} />
                          </div>
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-[var(--accent)]">{track.title}</p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{track.artist}</p>
                      </div>
                      <ChevronRight size={16} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}

              {/* No Results Fallback / Toggle */}
              {!isModalSearching && modalSearchResults.length === 0 && !isModalManualInput && modalSearchQuery && hasSearched && (
                <div className="text-center py-4 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-dashed border-[var(--border)] mb-6">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">No iTunes results found</p>
                  <button 
                    onClick={() => setIsModalManualInput(true)}
                    className="text-[var(--accent)] text-xs font-bold hover:underline"
                  >
                    Switch to Manual Input
                  </button>
                </div>
              )}

              {/* Manual Input Form */}
              {isModalManualInput && (
                <div className="space-y-4 p-4 bg-[var(--accent)]/[0.03] border border-[var(--accent)]/10 rounded-2xl animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest">
                      Manual Input
                    </label>
                    <button 
                      onClick={() => setIsModalManualInput(false)}
                      className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    >
                      Back to search
                    </button>
                  </div>
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Title</label>
                    <input 
                      type="text" 
                      className="form-input w-full" 
                      value={modalManualTitle}
                      onChange={(e) => setModalManualTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Artist</label>
                    <input 
                      type="text" 
                      className="form-input w-full" 
                      value={modalManualArtist}
                      onChange={(e) => setModalManualArtist(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleConfirmManualInput}
                    className="btn btn--primary w-full mt-4 h-12"
                  >
                    Confirm Manual Data
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border)] flex justify-end gap-3">
              {!isModalManualInput && (
                <button
                  onClick={() => setIsModalManualInput(true)}
                  className="btn btn--secondary px-6"
                >
                  {T('newSong.manualInput')}
                </button>
              )}
              <button 
                onClick={() => setIsSongModalOpen(false)}
                className="btn btn--secondary px-6"
              >
                {T('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button className="btn btn--secondary" onClick={handleCancelVtuberRegister} disabled={isRegisteringVtuber}>{T('common.cancel')}</button>
              <button
                className="btn btn--primary"
                onClick={handleRegisterVtuber}
                disabled={isRegisteringVtuber || !vtuberForm.name.trim() || (vtuberForm.productionId === 'new' && !vtuberForm.newProductionName.trim())}
              >
                {isRegisteringVtuber ? T('newSong.adding') : T('vtuber.registerAndProceed')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム確認モーダル */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          if (onCancelAction) onCancelAction();
        }}>
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
              {modalConfig.cancelText && (
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    setIsModalOpen(false);
                    if (onCancelAction) onCancelAction();
                  }}
                  disabled={isLoading}
                >
                  {modalConfig.cancelText}
                </button>
              )}
              <button
                className={`btn ${modalConfig.type === 'warning' ? 'btn--warning' : modalConfig.type === 'danger' ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => {
                  setIsModalOpen(false);
                  if (onConfirmAction) onConfirmAction();
                }}
                disabled={isLoading}
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
              handleCloseModal();
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
                {currentBatchIndex + 1 < batchArchives.length ? (
                  <button
                    className="btn btn--primary btn--full"
                    onClick={goToNextItem}
                  >
                    {T('newSong.nextVideo')}
                  </button>
                ) : null}
                <button
                  className="btn btn--secondary btn--full"
                  onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
                >
                  {T('common.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
