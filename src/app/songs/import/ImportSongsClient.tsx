"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchVideoPreview, registerVideo, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel } from '../new/actions';
import type { ITunesSearchResult } from '../new/actions';
import type { YouTubeVideoMetadata, Video, Song, Production, MasterSong, YouTubeChannelData } from '@/types';
import { formatTime, parseTime, formatTimeFull } from '@/lib/utils';
import { 
  Search, X, Music, Info, Save, Trash2, AlertCircle, 
  UserPlus, Building2, FileUp, Table, ChevronRight,
  CheckCircle2, PlayCircle, Loader2, ExternalLink, RotateCcw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { convertGSheetUrlToCsv, parseCsv, processImportedData, type BatchArchive } from '@/utils/batch-parser';
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
}

interface BatchProgress {
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'loading';
  videoTitle?: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  duration?: number;
  publishedAt?: string;
}

export default function ImportSongsClient() {
  const { locale, t: tl, T } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- States ---
  const [batchArchives, setBatchArchives] = useState<BatchArchive[]>([]);
  const [progress, setProgress] = useState<Record<string, BatchProgress>>({});
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [gsUrl, setGsUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Current Video States (similar to NewSongClient)
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [video, setVideo] = useState<Video | null>(null);
  const [allSongs, setAllSongs] = useState<EditableSong[]>([]);
  const [isAutoNext, setIsAutoNext] = useState(true);

  // VTuber登録モーダル等（NewSongClientから流用）
  const [isVtuberModalOpen, setIsVtuberModalOpen] = useState(false);
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

  useEffect(() => {
    allSongsRef.current = allSongs;
  }, [allSongs]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    currentBatchIndexRef.current = currentBatchIndex;
  }, [currentBatchIndex]);

  // 共通確認モーダル用のState
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

  // 変更があるかどうか（離脱警告の対象）
  const hasChanges = useMemo(() => {
    // 一括処理のバッチがあり、未完了の動画が1つでもある場合に警告を出す
    return batchArchives.length > 0 && Object.values(progress).some(p => p.status !== 'completed');
  }, [batchArchives, progress]);

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

  // --- Handlers ---

  const prefetchBatchMetadata = useCallback((archives: BatchArchive[]) => {
    // 3件ずつ並列実行制限をかけながら取得
    const CONCURRENCY = 3;
    let index = 0;

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
          setProgress(prev => ({
            ...prev,
            [item.url]: { 
              ...prev[item.url], 
              status: 'pending', // 準備完了の意味。処理開始待ち
              videoTitle: result.data.metadata.title,
              thumbnailUrl: result.data.metadata.thumbnailUrl,
              channelTitle: result.data.metadata.channelName,
              duration: result.data.metadata.duration,
              publishedAt: result.data.metadata.publishedAt
            }
          }));
        } else {
          setProgress(prev => ({
            ...prev,
            [item.url]: { ...prev[item.url], status: 'pending' }
          }));
        }
      } catch {
        setProgress(prev => ({
            ...prev,
            [item.url]: { ...prev[item.url], status: 'pending' }
          }));
      }

      runNext();
    };

    for (let i = 0; i < Math.min(CONCURRENCY, archives.length); i++) {
      runNext();
    }
  }, [progress]);

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
        
        // 最初のアイテムを開始
        startProcessingItem(0, processed);
        // バックグラウンド取得開始
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
        
        const initialProgress: Record<string, BatchProgress> = {};
        processed.forEach(item => {
          initialProgress[item.url] = { url: item.url, status: 'pending' };
        });
        setProgress(initialProgress);

        startProcessingItem(0, processed);
        // バックグラウンド取得開始
        prefetchBatchMetadata(processed);
      } catch (err) {
        setError(err instanceof Error ? err.message : T('newSong.gsLoadError'));
      }
    });
  };

  const startProcessingItem = useCallback((index: number, archives = batchArchives) => {
    if (index < 0 || index >= archives.length) return;

    // 実際の読み込み＆処理開始ロジックを切り出し
    const proceedToItem = () => {
      const item = archives[index];
      setCurrentBatchIndex(index);
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

      startTransition(async () => {
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
          return !existingStartTimes.some(existingSec => Math.abs(existingSec - startSec) <= 5);
        });

        const convertedSongs: EditableSong[] = newImportSongs.map(s => ({
          song: {
            master_song: { title: s.title, artist: s.artist },
            start_sec: parseTime(s.startTime) || 0,
            end_sec: s.endTime ? parseTime(s.endTime) || 0 : 0
          },
          startTime: s.startTime,
          endTime: s.endTime || '',
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

        const finalSongs = [...existingSongs, ...convertedSongs];

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

        // チャンネル登録チェック
        if (!result.data.isChannelRegistered && result.data.channelData) {
          const channelData = result.data.channelData as unknown as YouTubeChannelData;
          setChannelDataForReg(channelData);
          setVtuberForm(prev => ({
            ...prev,
            name: channelData.name,
            link: channelData.officialLink || ''
          }));
          const prods = await getProductions();
          if (prods.success) setProductions(prods.data);
          setIsVtuberModalOpen(true);
        } else {
          const videoResult = await registerVideo(result.data.metadata);
          if (videoResult.success) setVideo(videoResult.data);
        }
      });
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
        setIsModalOpen(true);
        return;
      }
    }
    
    proceedToItem();
  }, [batchArchives, locale, T]);

  const handleSaveBatch = async () => {
    if (!metadata) return;
    setError('');
    setSuccess('');

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

    startTransition(async () => {
      const result = await registerFullArchive({
        videoMetadata: metadata,
        songs: songsToRegister,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(T('newSong.saveSuccess'));
      
      // 進捗を完了にする
      const currentUrl = batchArchives[currentBatchIndex].url;
      setProgress(prev => ({
        ...prev,
        [currentUrl]: { ...prev[currentUrl], status: 'completed' }
      }));

      // 自動遷移
      if (isAutoNext) {
        const nextIndex = currentBatchIndex + 1;
        if (nextIndex < batchArchives.length) {
          setTimeout(() => startProcessingItem(nextIndex), 1000);
        }
      }
    });
  };

  const handleRegisterVtuber = async () => {
    if (!channelDataForReg) return;
    startTransition(async () => {
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
    });
  };

  // --- Inline Helpers ---
  const updateSongField = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setAllSongs(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
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

        // 元々のインポートデータに終了時間がなかった場合のみ、終了時間を計算
        if (!s.importedEndTime || s.importedEndTime === '' || s.importedEndTime === '0:00' || s.importedEndTime === '0') {
          const startSec = parseTime(s.startTime) || 0;
          updatedEndSec = track.durationSec > 0 ? startSec + track.durationSec : updatedEndSec;
          updatedEndTime = formatTimeFull(updatedEndSec);
          // 開始時間も整形
          s.startTime = formatTimeFull(startSec);
        }

        return {
          ...s,
          isConfirmed: true,
          isChangingSong: false,
          searchResults: [],
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
              <div className="card__body p-2 max-h-[60vh] overflow-y-auto">
                <div className="space-y-1">
                  {batchArchives.map((item, idx) => {
                    const info = progress[item.url];
                    const isCurrent = currentBatchIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => startProcessingItem(idx)}
                        disabled={isPending}
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
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg border-2 border-emerald-500 animate-in zoom-in-50 duration-200">
                                <CheckCircle2 size={20} className="text-emerald-500 fill-emerald-500/10" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold truncate leading-tight mb-1 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                            {info?.videoTitle || (info?.status === 'loading' ? 'Loading metadata...' : `Video ${idx + 1}`)}
                          </p>
                          {info?.channelTitle && (
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
                  <span>{Object.values(progress).filter(p => p.status === 'completed').length} / {batchArchives.length} Completed</span>
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
          {error && <div className="alert alert--error mb-6">{error}</div>}
          {success && <div className="alert alert--success mb-6">{success}</div>}

          {batchArchives.length === 0 ? (
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
                <button className="btn btn--secondary w-full" onClick={handleGsImport} disabled={!gsUrl.trim()}>
                  {T('newSong.fetch')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
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
                      
                      <div className="flex items-center gap-4">
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
                          disabled={isPending || allSongs.filter(s => !s.isDeleted).length === 0}
                        >
                          {isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
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
                  <div key={index} className={`card overflow-hidden transition-all ${item.isDeleted ? 'opacity-40 grayscale scale-[0.98]' : 'hover:border-[var(--accent)]/40 shadow-sm'}`}>
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
                              <button onClick={() => openSongEditModal(index)} className="btn btn--sm btn--secondary flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider h-8">
                                <Search size={12} /> {T('newSong.changeSong')}
                              </button>
                            </div>

                            {/* 時間入力エリアをコンパクトに右側に配置 */}
                            <div className="flex-shrink-0 flex items-center gap-3 bg-[var(--bg-tertiary)]/50 p-2 px-3 rounded-xl border border-[var(--border)]/40 relative">
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
                              <div className="lg:absolute lg:-right-4 lg:top-1/2 lg:-translate-y-1/2 flex items-center gap-1 text-red-500 font-bold text-[10px] animate-pulse">
                                <AlertCircle size={14} />
                                <span>MISSING END TIME</span>
                              </div>
                            )}
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
                  disabled={isPending || allSongs.filter(s => !s.isDeleted).length === 0}
                >
                  {isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {T('newSong.saveAll')}
                </button>
              </div>
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
                    onClick={handleModalSearch}
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
              <button className="btn btn--secondary" onClick={() => setIsVtuberModalOpen(false)} disabled={isPending}>{T('common.cancel')}</button>
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
  );
}
