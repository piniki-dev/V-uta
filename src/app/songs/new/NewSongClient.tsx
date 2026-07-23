"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchVideoPreview, registerVideo, searchSongAction, registerFullArchive, getProductions, registerVtuberAndChannel, searchVtubers, checkDuplicateVtuber, fetchChannelMetadataAction, type CollaboratorChannelPreview } from './actions';
import type { ITunesSearchResult, VtuberWithChannels } from './actions';
import type { YouTubeVideoMetadata, Video, Song, Production, MasterSong, YouTubeChannelData } from '@/types';
import { formatTime, parseTime, calculateAutoEndTimeSec } from '@/lib/utils';
import Link from 'next/link';
import { 
  Search, X, Music, Info, Pencil, Save, Trash2, 
  AlertCircle, UserPlus, Building2, FileUp, Loader2, RotateCcw,
  Check, AlertTriangle
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from '@/components/LocaleProvider';
import Image from 'next/image';
import Hero from '@/components/Hero';
import CollabAddModal from './CollabAddModal';
import CollaboratorList from './CollaboratorList';
import SongMemberSelector from './SongMemberSelector';

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
  channelIds?: number[]; // 曲に紐づくチャンネルIDリスト
  // 編集中の下書きステート
  draftStartTime?: string;
  draftEndTime?: string;
  draftChannelIds?: number[];
  draftSong?: Partial<Song> & { master_song?: Partial<MasterSong> };
}

interface NewSongDraft {
  url: string;
  metadata: YouTubeVideoMetadata | null;
  video: Video | null;
  collaborators?: CollaboratorChannelPreview[];
  allSongs: EditableSong[];
  isCoverVideo: boolean;
  step: 1 | 2;
  updatedAt: number;
}

export default function NewSongClient() {
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get('url');
  const hasAutoFetched = useRef(false);

  // Step 1: URL 入力
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorChannelPreview[]>([]);
  const [isCollabAddModalOpen, setIsCollabAddModalOpen] = useState(false);

  const handleAddCollaborators = useCallback((newCollabs: CollaboratorChannelPreview[]) => {
    setCollaborators(prev => {
      const existingIds = new Set(prev.map(c => c.ytChannelId));
      const uniqueNew = newCollabs.filter(c => !existingIds.has(c.ytChannelId));
      return [...prev, ...uniqueNew];
    });
  }, []);

  const handleRemoveCollaborator = useCallback((ytChannelId: string) => {
    setCollaborators(prev => prev.filter(c => c.ytChannelId !== ytChannelId));
  }, []);

  const handleOpenVtuberModalForCollab = useCallback((collab: CollaboratorChannelPreview) => {
    getProductions().then((res) => {
      if (res.success && res.data) setProductions(res.data);
    });

    setChannelDataForReg({
      ytChannelId: collab.ytChannelId,
      name: collab.name,
      handle: collab.handle || '',
      description: collab.description || '',
      image: collab.avatarUrl || '',
    });

    if (!collab.avatarUrl) {
      fetchChannelMetadataAction(collab.ytChannelId).then((res) => {
        if (res.success && res.data?.image) {
          setChannelDataForReg((prev) => (prev ? { ...prev, image: res.data.image || '' } : prev));
        }
      });
    }

    setVtuberForm({
      name: collab.name,
      gender: '不明',
      link: '',
      productionId: '',
      newProductionName: '',
    });

    setVtuberRegMode('new');
    setSelectedExistingVtuber(null);
    setIsPrimaryChannel(true);

    checkDuplicateVtuber(collab.name).then((res) => {
      if (res.success) setDuplicateWarning(res.data);
    });

    setIsVtuberModalOpen(true);
  }, []);

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
  const [addFormChannelIds, setAddFormChannelIds] = useState<number[]>([]);

  // 統合された曲リスト（既存 + 新規）
  const [allSongs, setAllSongs] = useState<EditableSong[]>([]);

  // UI 状態
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    song?: string;
    startTime?: string;
    endTime?: string;
  }>({});
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
  const [vtuberRegMode, setVtuberRegMode] = useState<'new' | 'link'>('new');
  const [vtuberSearchQuery, setVtuberSearchQuery] = useState('');
  const [vtuberSearchResults, setVtuberSearchResults] = useState<VtuberWithChannels[]>([]);
  const [isSearchingVtubers, setIsSearchingVtubers] = useState(false);
  const [selectedExistingVtuber, setSelectedExistingVtuber] = useState<VtuberWithChannels | null>(null);
  const [isPrimaryChannel, setIsPrimaryChannel] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    exactMatch: VtuberWithChannels | null;
    similarMatches: VtuberWithChannels[];
  }>({ exactMatch: null, similarMatches: [] });

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
  const [pendingDraft, setPendingDraft] = useState<NewSongDraft | null>(null);

  // 初回マウント時の下書き検出
  useEffect(() => {
    if (initialUrl) return; // URLクエリがある場合は初期読み込みが優先
    try {
      const raw = localStorage.getItem('vuta_draft_song_new');
      if (raw) {
        const parsed: NewSongDraft = JSON.parse(raw);
        const isValidTime = parsed.updatedAt && (Date.now() - parsed.updatedAt < 7 * 24 * 60 * 60 * 1000);
        const hasContent = !!parsed.url || (Array.isArray(parsed.allSongs) && parsed.allSongs.length > 0) || !!parsed.metadata;
        if (isValidTime && hasContent) {
          setPendingDraft(parsed);
        } else {
          localStorage.removeItem('vuta_draft_song_new');
        }
      }
    } catch {
      localStorage.removeItem('vuta_draft_song_new');
    }
  }, [initialUrl]);

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    if (saveStatus === 'success' || saveStatus === 'error') return false;
    // 1. リスト内に未保存、削除予定、または編集中のものがある場合
    const hasUnsavedInList = allSongs.some(s => !s.isPersisted || s.isDeleted || s.isEditing);
    // 2. 現在新規追加フォームに入力中のものがある場合
    const hasActiveInput = !!selectedSong || !!startTime.trim() || !!endTime.trim() || !!searchQuery.trim();

    return hasUnsavedInList || hasActiveInput;
  }, [allSongs, selectedSong, startTime, endTime, searchQuery, saveStatus]);

  const hasUnregisteredCollabs = useMemo(() => {
    return collaborators.some(c => !c.isOriginalUploader && !c.isRegistered);
  }, [collaborators]);

  const [isCoverVideo, setIsCoverVideo] = useState(false);

  // 変更時に自動下書き保存
  useEffect(() => {
    if (saveStatus === 'success') {
      try {
        localStorage.removeItem('vuta_draft_song_new');
      } catch {}
      return;
    }

    if (url || metadata || allSongs.length > 0) {
      try {
        const draftObj: NewSongDraft = {
          url,
          metadata,
          video,
          collaborators,
          allSongs,
          isCoverVideo,
          step,
          updatedAt: Date.now(),
        };
        localStorage.setItem('vuta_draft_song_new', JSON.stringify(draftObj));
      } catch {}
    }
  }, [url, metadata, video, collaborators, allSongs, isCoverVideo, step, saveStatus]);

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    setUrl(pendingDraft.url || '');
    setMetadata(pendingDraft.metadata || null);
    setVideo(pendingDraft.video || null);
    setCollaborators(pendingDraft.collaborators || []);
    setAllSongs(pendingDraft.allSongs || []);
    setIsCoverVideo(!!pendingDraft.isCoverVideo);
    setStep(pendingDraft.step || 1);
    setPendingDraft(null);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem('vuta_draft_song_new');
    } catch {}
    setPendingDraft(null);
  };

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

      // 埋め込み禁止チェック
      if (result.data.metadata.embeddable === false) {
        setMetadata(null);
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
        setIsModalOpen(true);
        return;
      }

      setMetadata(result.data.metadata);
      setCollaborators(result.data.collaboratorChannels || []);
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
        channelIds: (song as Song & { channelIds?: number[] }).channelIds,
      }));

      setAllSongs(convertedSongs);

      if (result.data.existingSongs.length > 0) {
        setSuccess(T('newSong.fetchExisting'));
      }

      // チャンネル未登録の場合はモーダルを表示
      if (!result.data.isChannelRegistered && result.data.channelData) {
        const channelData = result.data.channelData as unknown as YouTubeChannelData;
        setChannelDataForReg(channelData);

        const rawChannelName = channelData.name || '';
        const isTopic = /(?:[-–—\s]\s*|\s+)(Topic|トピック)\s*$/i.test(rawChannelName);
        const cleanName = rawChannelName.replace(/(?:[-–—\s]\s*|\s+)(Topic|トピック)\s*$/i, '').trim();

        setVtuberForm(prev => ({
          ...prev,
          name: cleanName || rawChannelName,
          link: channelData.officialLink || ''
        }));

        setIsPrimaryChannel(!isTopic);
        setSelectedExistingVtuber(null);
        setDuplicateWarning({ exactMatch: null, similarMatches: [] });

        // 事務所一覧を取得
        const prods = await getProductions();
        if (prods.success) {
          setProductions(prods.data);
        }

        // トピックチャンネル判定時の自動選択提案
        if (isTopic && cleanName) {
          const vtSearch = await searchVtubers(cleanName);
          if (vtSearch.success && vtSearch.data.length > 0) {
            setVtuberRegMode('link');
            setVtuberSearchQuery(cleanName);
            setVtuberSearchResults(vtSearch.data);

            const normClean = cleanName.toLowerCase().replace(/[\s\-_・/@]/g, '');
            const match = vtSearch.data.find(v => {
              const normVtName = v.name.toLowerCase().replace(/[\s\-_・/@]/g, '');
              return normVtName.includes(normClean) || normClean.includes(normVtName);
            }) || vtSearch.data[0];

            if (match) {
              setSelectedExistingVtuber(match);
            }
          } else {
            setVtuberRegMode('new');
          }
        } else {
          setVtuberRegMode('new');
          if (cleanName) {
            const dupCheck = await checkDuplicateVtuber(cleanName);
            if (dupCheck.success) {
              setDuplicateWarning(dupCheck.data);
            }
          }
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

    const isLinkMode = vtuberRegMode === 'link';
    if (isLinkMode && !selectedExistingVtuber) {
      setError('紐づけるVTuberを選択してください');
      return;
    }

    startTransition(async () => {
      const regVtuberName = isLinkMode ? selectedExistingVtuber!.name : vtuberForm.name;
      const result = await registerVtuberAndChannel({
        existingVtuberId: isLinkMode ? selectedExistingVtuber!.id : undefined,
        isPrimary: isPrimaryChannel,
        vtuberName: regVtuberName,
        gender: vtuberForm.gender,
        vtuberLink: vtuberForm.link,
        productionId: (!isLinkMode && vtuberForm.productionId && vtuberForm.productionId !== 'new') ? Number(vtuberForm.productionId) : undefined,
        newProductionName: (!isLinkMode && vtuberForm.productionId === 'new') ? vtuberForm.newProductionName : undefined,
        channelData: channelDataForReg,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setIsVtuberModalOpen(false);
      setSuccess(T('vtuber.registerSuccess', { name: regVtuberName }));

      if (channelDataForReg) {
        setCollaborators(prev => prev.map(c => 
          c.ytChannelId === channelDataForReg.ytChannelId 
            ? { ...c, isRegistered: true, channelRecordId: result.data.channelId }
            : c
        ));
      }

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
    setFieldErrors(prev => ({ ...prev, song: undefined }));
    setSearchResults([]);
    setSearchQuery('');
    setIsManualInput(false);

    // 終了時間が未入力であり、開始時間と曲の長さがある場合は終了時間を自動計算（動画再生時間を超えないよう補正）
    if (!endTime && startTime && track.durationSec > 0) {
      const startSec = parseTime(startTime);
      if (startSec !== null) {
        const maxDuration = video?.duration || metadata?.duration || 0;
        const endSec = calculateAutoEndTimeSec(startSec, track.durationSec, maxDuration);
        setEndTime(formatTime(endSec));
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
    setFieldErrors(prev => ({ ...prev, song: undefined }));
    setIsManualInput(false);
    setSearchResults([]);
    setManualTitle('');
    setManualArtist('');
  };

  const handleClearSelection = () => {
    setSelectedSong(null);
    setFieldErrors(prev => ({ ...prev, song: undefined }));
  };

  const validateStartTime = useCallback((startVal: string, endVal: string) => {
    let startErr = '';
    
    const startSec = startVal.trim() ? parseTime(startVal) : null;
    const endSec = endVal.trim() ? parseTime(endVal) : null;

    if (!startVal.trim()) {
      startErr = T('newSong.startTimeRequired');
    } else if (startSec === null) {
      startErr = T('newSong.timeFormatError');
    } else if (endVal.trim() && endSec !== null && startSec >= endSec) {
      startErr = T('newSong.timeRangeError');
    }

    setFieldErrors(prev => ({
      ...prev,
      startTime: startErr || undefined,
      endTime: (prev.endTime === T('newSong.timeRangeError') && startSec !== null && endSec !== null && startSec < endSec)
        ? undefined
        : prev.endTime
    }));

    return !startErr;
  }, [T]);

  const validateEndTime = useCallback((startVal: string, endVal: string) => {
    let endErr = '';
    
    const startSec = startVal.trim() ? parseTime(startVal) : null;
    const endSec = endVal.trim() ? parseTime(endVal) : null;
    const maxDuration = video?.duration || metadata?.duration || 0;

    if (!endVal.trim()) {
      endErr = T('newSong.endTimeRequired');
    } else if (endSec === null) {
      endErr = T('newSong.timeFormatError');
    } else if (startVal.trim() && startSec !== null && startSec >= endSec) {
      endErr = T('newSong.timeRangeError');
    } else if (maxDuration > 0 && endSec !== null && endSec > maxDuration) {
      endErr = T('newSong.endTimeExceedsDuration');
    }

    setFieldErrors(prev => ({
      ...prev,
      endTime: endErr || undefined,
      startTime: (prev.startTime === T('newSong.timeRangeError') && startSec !== null && endSec !== null && startSec < endSec)
        ? undefined
        : prev.startTime
    }));

    return !endErr;
  }, [T, video, metadata]);

  const validateSong = useCallback((song: ITunesSearchResult | null, isSubmitting = false) => {
    let err = '';
    if (isSubmitting && !song) {
      err = T('newSong.songRequired');
    }
    setFieldErrors(prev => ({ ...prev, song: err || undefined }));
    return !err;
  }, [T]);

  const handleRegisterSong = () => {
    setError('');
    
    // 一括バリデーション
    const isSongValid = validateSong(selectedSong, true);
    const isStartValid = validateStartTime(startTime, endTime);
    const isEndValid = validateEndTime(startTime, endTime);
    
    if (!isSongValid || !isStartValid || !isEndValid || !selectedSong) {
      return;
    }

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

    const maxDuration = video?.duration || metadata?.duration || 0;
    if (maxDuration > 0 && endSec > maxDuration) {
      setError(T('newSong.endTimeExceedsDuration'));
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

    const selectedCids = addFormChannelIds.length > 0
      ? addFormChannelIds
      : (isCoverVideo
          ? collaborators.filter((c) => c.isRegistered && c.channelRecordId).map((c) => c.channelRecordId!)
          : collaborators.filter((c) => c.isOriginalUploader && c.channelRecordId).map((c) => c.channelRecordId!));

    if (selectedCids.length > 0) {
      newSong.channelIds = selectedCids;
    }

    setAllSongs((prev) => [...prev, newSong]);
    setSuccess(T('newSong.addToListSuccess'));

    setSelectedSong(null);
    setSearchQuery('');
    setStartTime('');
    setEndTime('');
    setManualTitle('');
    setManualArtist('');
  };

  // コラボレーターまたは歌ってみた状態が更新されたらフォームの歌唱メンバー選択初期値を設定
  useEffect(() => {
    const defaultCids = isCoverVideo
      ? collaborators.filter((c) => c.isRegistered && c.channelRecordId).map((c) => c.channelRecordId!)
      : collaborators.filter((c) => c.isOriginalUploader && c.channelRecordId).map((c) => c.channelRecordId!);
    setAddFormChannelIds(defaultCids);
  }, [collaborators, isCoverVideo]);

  const performSave = useCallback(async () => {
    if (!metadata) return;
    setError('');
    setSuccess('');
    setSaveStatus('saving');
    setSaveErrorMsg('');

    // 未登録のコラボチャンネルが存在する場合は保存をブロック
    const unregisteredCollabs = collaborators.filter(c => !c.isOriginalUploader && !c.isRegistered);
    if (unregisteredCollabs.length > 0) {
      const msg = T('newSong.unregisteredCollabsError', { count: unregisteredCollabs.length });
      setError(msg);
      setSaveErrorMsg(msg);
      setSaveStatus('error');
      return;
    }

    // 未確定（未検索・未入力）の楽曲があるかチェック
    const unconfirmedCount = allSongs.filter(s => !s.isConfirmed && !s.isDeleted).length;

    startTransition(async () => {
      try {
        const collabIds = collaborators
          .filter(c => c.isRegistered && c.channelRecordId)
          .map(c => c.channelRecordId!);

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
            channelIds: isCoverVideo
              ? collabIds
              : (item.channelIds && item.channelIds.length > 0 ? item.channelIds : undefined),
          }));

        const maxDuration = video?.duration || metadata?.duration || 0;
        if (maxDuration > 0) {
          const invalidSong = songsToRegister.find(s => !s.isDeleted && s.endSec > maxDuration);
          if (invalidSong) {
            const msg = T('newSong.endTimeExceedsDuration');
            setError(msg);
            setSaveErrorMsg(msg);
            setSaveStatus('error');
            return;
          }
        }

        const result = await registerFullArchive({
          videoMetadata: metadata,
          songs: songsToRegister,
          collaboratorChannelIds: collabIds,
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
  }, [allSongs, metadata, video, collaborators, locale, T, isCoverVideo]);

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
      prev.map((item, i) => {
        if (i === index) {
          const willEdit = !item.isEditing;
          const defaultCids = collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)?.channelRecordId
            ? [collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)!.channelRecordId!]
            : [];
          return {
            ...item,
            isEditing: willEdit,
            isChangingSong: false,
            searchQuery: '',
            searchResults: [],
            // 編集開始時に現在の値をドラフト（下書き）としてコピー
            draftStartTime: willEdit ? item.startTime : undefined,
            draftEndTime: willEdit ? item.endTime : undefined,
            draftChannelIds: willEdit ? [...(item.channelIds ?? defaultCids)] : undefined,
            draftSong: willEdit ? item.song : undefined,
          };
        }
        return item;
      })
    );
  };

  const updateSongField = <K extends keyof EditableSong>(index: number, field: K, value: EditableSong[K]) => {
    setAllSongs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveSongLocal = (index: number) => {
    const item = allSongs[index];
    const targetStartTime = item.draftStartTime ?? item.startTime;
    const targetEndTime = item.draftEndTime ?? item.endTime;

    const s = parseTime(targetStartTime);
    const e = parseTime(targetEndTime);

    if (s === null || e === null || s >= e) {
      setError(T('newSong.timeFormatError'));
      return;
    }

    const maxDuration = video?.duration || metadata?.duration || 0;
    if (maxDuration > 0 && e > maxDuration) {
      setError(T('newSong.endTimeExceedsDuration'));
      return;
    }

    const targetSong = item.draftSong ?? item.song;
    const targetChannelIds = item.draftChannelIds ?? item.channelIds;

    setAllSongs((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              startTime: targetStartTime,
              endTime: targetEndTime,
              channelIds: targetChannelIds,
              song: { ...targetSong, start_sec: s, end_sec: e },
              isEditing: false,
              isPersisted: false,
              draftStartTime: undefined,
              draftEndTime: undefined,
              draftChannelIds: undefined,
              draftSong: undefined,
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
    const maxDuration = video?.duration || metadata?.duration || 0;
    setAllSongs((prev) =>
      prev.map((it, i) => {
        if (i === index) {
          const currentStart = it.draftStartTime ?? it.startTime;
          const currentEnd = it.draftEndTime ?? it.endTime;
          const startSec = parseTime(currentStart);
          const newEndTime = (!currentEnd && startSec !== null && track.durationSec > 0)
            ? formatTime(calculateAutoEndTimeSec(startSec, track.durationSec, maxDuration))
            : currentEnd;

          return {
            ...it,
            draftEndTime: newEndTime,
            draftSong: {
              ...it.song,
              master_song: {
                title: track.title,
                artist: track.artist,
                artwork_url: track.artworkUrl,
                itunes_id: track.trackId === -1 ? null : String(track.trackId),
                duration_sec: track.durationSec,
              } as unknown as Partial<MasterSong>,
            } as unknown as Partial<Song> & { master_song?: Partial<MasterSong> },
            isChangingSong: false,
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
      try {
        localStorage.removeItem('vuta_draft_song_new');
      } catch {}
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

  const hasErrors = Object.values(fieldErrors).some(err => !!err);

  return (
    <>
    <div className="min-h-screen">
      <Hero
        title={T('newSong.pageTitle')}
        description={T('newSong.pageDescription')}
        icon={<Music size={64} />}
      />

      <div className="container py-12 pb-48 px-6 max-w-5xl mx-auto">

        {/* 下書き復元通知バナー */}
        {pendingDraft && (
          <div className="bg-[var(--accent-subtle)] border border-[var(--accent)]/30 rounded-2xl p-4 md:p-5 mb-8 shadow-lg backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
                <Info size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[var(--text-primary)] text-sm md:text-base">
                  {T('newSong.draftFoundTitle')}
                </h4>
                <p className="text-xs md:text-sm text-[var(--text-secondary)]">
                  {T('newSong.draftFoundDesc', {
                    title: pendingDraft.metadata?.title || pendingDraft.url || '入力途中のデータ'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                {T('newSong.discardDraft')}
              </button>
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="px-4 py-2 rounded-xl text-xs md:text-sm font-bold bg-[var(--accent)] text-white hover:opacity-90 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={15} />
                {T('newSong.restoreDraft')}
              </button>
            </div>
          </div>
        )}

        {/* エラー・成功メッセージ */}
        {error && <div className="alert alert--error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ whiteSpace: 'pre-wrap' }}>{success}</div>}

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

                <CollaboratorList
                  collaborators={collaborators}
                  onOpenAddModal={() => setIsCollabAddModalOpen(true)}
                  onRemoveCollaborator={handleRemoveCollaborator}
                  onRegisterVtuber={handleOpenVtuberModalForCollab}
                />
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
                {hasUnregisteredCollabs ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 flex items-start gap-3.5 animate-in fade-in duration-300">
                    <AlertTriangle size={24} className="flex-shrink-0 text-amber-400 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold text-amber-200 text-sm mb-1">{T('newSong.unregisteredCollabsWarning')}</p>
                      <p className="text-[var(--text-secondary)]">{T('newSong.unregisteredCollabsGuide')}</p>
                    </div>
                  </div>
                ) : (
                  <>
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
                          className={`form-input ${fieldErrors.song ? 'form-input--error' : ''}`}
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
                      {fieldErrors.song && (
                        <p className="text-xs text-[var(--error)] mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <AlertCircle size={12} /> {fieldErrors.song}
                        </p>
                      )}
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
                        {fieldErrors.song && (
                          <p className="text-xs text-[var(--error)] mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            <AlertCircle size={12} /> {fieldErrors.song}
                          </p>
                        )}
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
                        if (fieldErrors.startTime || fieldErrors.endTime) {
                          setFieldErrors(prev => ({ ...prev, startTime: undefined, endTime: undefined }));
                        }
                        if (selectedSong && selectedSong.durationSec > 0) {
                          const s = parseTime(val);
                          if (s !== null) {
                            const maxDuration = video?.duration || metadata?.duration || 0;
                            const endSec = calculateAutoEndTimeSec(s, selectedSong.durationSec, maxDuration);
                            setEndTime(formatTime(endSec));
                          }
                        }
                      }}
                      onBlur={() => validateStartTime(startTime, endTime)}
                      placeholder="m:ss or h:mm:ss"
                      className={`form-input ${fieldErrors.startTime ? 'form-input--error' : ''}`}
                      disabled={isPending}
                    />
                    {fieldErrors.startTime && (
                      <p className="text-xs text-[var(--error)] mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertCircle size={12} /> {fieldErrors.startTime}
                      </p>
                    )}
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="end-time" className="form-label">
                      {T('newSong.endTime')} <span className="form-required">*</span>
                    </label>
                    <input
                      id="end-time"
                      type="text"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        if (fieldErrors.startTime || fieldErrors.endTime) {
                          setFieldErrors(prev => ({ ...prev, startTime: undefined, endTime: undefined }));
                        }
                      }}
                      onBlur={() => validateEndTime(startTime, endTime)}
                      placeholder="m:ss or h:mm:ss"
                      className={`form-input ${fieldErrors.endTime ? 'form-input--error' : ''}`}
                      disabled={isPending}
                    />
                    {fieldErrors.endTime && (
                      <p className="text-xs text-[var(--error)] mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertCircle size={12} /> {fieldErrors.endTime}
                      </p>
                    )}
                  </div>
                </div>

                <SongMemberSelector
                  collaborators={collaborators}
                  selectedChannelIds={addFormChannelIds}
                  onChange={setAddFormChannelIds}
                  isCoverVideo={isCoverVideo}
                />

                <button
                  onClick={handleRegisterSong}
                  disabled={isPending || hasErrors}
                  className="btn btn--primary btn--full mt-6 shadow-lg shadow-[var(--accent)]/20"
                >
                  {isPending ? T('newSong.adding') : T('newSong.addToList')}
                </button>
                  </>
                )}
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
                          {((item.isEditing && item.draftSong?.master_song?.artwork_url) || item.song.master_song?.artwork_url) ? (
                            <Image
                              src={(item.isEditing && item.draftSong?.master_song?.artwork_url) || item.song.master_song!.artwork_url!}
                              alt={((item.isEditing && item.draftSong?.master_song?.title) || item.song.master_song?.title) || ''}
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
                              {tl(
                                (item.isEditing && item.draftSong?.master_song?.title) || item.song.master_song?.title || '(不明)',
                                (item.isEditing && (item.draftSong?.master_song?.title_en || item.draftSong?.master_song?.title)) || item.song.master_song?.title_en || item.song.master_song?.title || '(Unknown)'
                              )}
                            </span>
                            <span className="edit-songs__artist" style={{ fontSize: '12px' }}>
                              {tl(
                                (item.isEditing && item.draftSong?.master_song?.artist) || item.song.master_song?.artist || '-',
                                (item.isEditing && (item.draftSong?.master_song?.artist_en || item.draftSong?.master_song?.artist)) || item.song.master_song?.artist_en || item.song.master_song?.artist || '-'
                              )}
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

                            <div className="form-row" style={{ gap: '12px', marginBottom: 0 }}>
                              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '12px' }}>{T('common.start')}</label>
                                <input
                                  type="text"
                                  value={item.draftStartTime ?? item.startTime}
                                  onChange={(e) => updateSongField(index, 'draftStartTime', e.target.value)}
                                  placeholder="m:ss or h:mm:ss"
                                  className="form-input form-input--sm"
                                  disabled={isPending}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label" style={{ fontSize: '12px' }}>{T('common.end')}</label>
                                <input
                                  type="text"
                                  value={item.draftEndTime ?? item.endTime}
                                  onChange={(e) => updateSongField(index, 'draftEndTime', e.target.value)}
                                  placeholder="m:ss or h:mm:ss"
                                  className="form-input form-input--sm"
                                  disabled={isPending}
                                />
                              </div>
                            </div>

                            <SongMemberSelector
                              collaborators={collaborators}
                              selectedChannelIds={
                                item.draftChannelIds ?? item.channelIds ?? (
                                  collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)?.channelRecordId
                                    ? [collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)!.channelRecordId!]
                                    : []
                                )
                              }
                              onChange={(newCids) => updateSongField(index, 'draftChannelIds', newCids)}
                              isCoverVideo={isCoverVideo}
                            />

                            <div className="mt-3 pt-3 border-t border-[var(--border)]/40 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveSongLocal(index)}
                                disabled={isPending}
                                className="btn btn--primary btn--sm px-5 flex items-center gap-1.5 font-bold"
                              >
                                <Check size={14} />
                                {T('common.save')}
                              </button>
                            </div>
                          </div>
                        )}

                        {!item.isEditing && (
                          <div className="edit-songs__time-info flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pl-14">
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {formatTime(item.song.start_sec ?? parseTime(item.startTime) ?? 0)} - {formatTime(item.song.end_sec ?? parseTime(item.endTime) ?? 0)}
                              </span>
                              <span className="edit-songs__duration" style={{ fontSize: '11px' }}>
                                ({formatTime((item.song.end_sec ?? parseTime(item.endTime) ?? 0) - (item.song.start_sec ?? parseTime(item.startTime) ?? 0))})
                              </span>
                            </div>

                            {/* 歌唱メンバーバッジ一覧 */}
                            {!isCoverVideo && collaborators.filter((c) => c.isRegistered && c.channelRecordId).length > 1 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                  item.channelIds ?? (
                                    collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)?.channelRecordId
                                      ? [collaborators.find((c) => c.isOriginalUploader && c.channelRecordId)!.channelRecordId!]
                                      : []
                                  )
                                ).map((cid) => {
                                  const collab = collaborators.find((c) => c.channelRecordId === cid);
                                  if (!collab) return null;
                                  return (
                                    <div
                                      key={collab.ytChannelId}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)]"
                                    >
                                      {collab.avatarUrl ? (
                                        <Image
                                          src={collab.avatarUrl}
                                          alt={collab.name}
                                          width={14}
                                          height={14}
                                          className="rounded-full shrink-0"
                                        />
                                      ) : (
                                        <div className="w-3.5 h-3.5 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[8px] font-bold shrink-0">
                                          {collab.name.substring(0, 1)}
                                        </div>
                                      )}
                                      <span className="truncate max-w-[110px]">{collab.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
          <div className="modal-container" style={{ maxWidth: '540px' }}>
            <div className="modal-body" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
              <div className="modal-icon" style={{ alignSelf: 'center' }}>
                <UserPlus size={32} />
              </div>
              <h3 className="modal-title" style={{ alignSelf: 'center' }}>{T('vtuber.registerTitle')}</h3>
              <p className="modal-text" style={{ alignSelf: 'center', marginBottom: '16px' }}>
                {T('vtuber.description')}
              </p>

              {/* モード切り替えタブ */}
              <div className="flex w-full bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border)] mb-4">
                <button
                  type="button"
                  onClick={() => setVtuberRegMode('new')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${vtuberRegMode === 'new' ? 'bg-[var(--bg-secondary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                >
                  新規VTuberとして登録
                </button>
                <button
                  type="button"
                  onClick={() => setVtuberRegMode('link')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${vtuberRegMode === 'link' ? 'bg-[var(--bg-secondary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                >
                  既存のVTuberに紐づけ
                </button>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {vtuberRegMode === 'link' ? (
                  /* 既存VTuberへの紐づけ */
                  <div className="flex flex-col gap-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">VTuberを検索 <span className="form-required">*</span></label>
                      <div className="relative">
                        <input
                          type="text"
                          value={vtuberSearchQuery}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setVtuberSearchQuery(val);
                            if (val.trim()) {
                              setIsSearchingVtubers(true);
                              const res = await searchVtubers(val);
                              setIsSearchingVtubers(false);
                              if (res.success) setVtuberSearchResults(res.data);
                            } else {
                              setVtuberSearchResults([]);
                            }
                          }}
                          className="form-input"
                          placeholder="VTuber名で検索..."
                        />
                        {isSearchingVtubers && (
                          <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-[var(--text-tertiary)]" />
                        )}
                      </div>
                    </div>

                    {/* 検索結果リスト */}
                    {vtuberSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-[var(--border)] rounded-xl bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
                        {vtuberSearchResults.map((vt) => {
                          const isSelected = selectedExistingVtuber?.id === vt.id;
                          return (
                            <div
                              key={vt.id}
                              onClick={() => setSelectedExistingVtuber(vt)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-[var(--accent-subtle)]/40 border-l-4 border-[var(--accent)]' : 'hover:bg-[var(--bg-hover)]'}`}
                            >
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)]">{vt.name}</p>
                                <p className="text-[11px] text-[var(--text-tertiary)]">
                                  登録済みチャンネル: {vt.channels.map(c => c.name).join(', ') || 'なし'}
                                </p>
                              </div>
                              {isSelected && <Check size={16} className="text-[var(--accent)]" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedExistingVtuber && (
                      <div className="p-3 bg-[var(--accent-subtle)]/30 border border-[var(--accent)]/30 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--accent)]">選択中: {selectedExistingVtuber.name}</span>
                        <button type="button" onClick={() => setSelectedExistingVtuber(null)} className="text-[var(--text-tertiary)] hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 新規VTuber登録 */
                  <>
                    {/* 重複警告バナー */}
                    {duplicateWarning.exactMatch && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-2 text-xs text-amber-300">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle size={16} />
                          <span>「{duplicateWarning.exactMatch.name}」は既に登録されています</span>
                        </div>
                        <p className="text-[11px] opacity-90">
                          新しいVTuberとして別で作成しますか？それとも既存のVTuberに紐づけますか？
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setVtuberRegMode('link');
                            setSelectedExistingVtuber(duplicateWarning.exactMatch);
                          }}
                          className="px-3 py-1.5 bg-amber-500 text-black font-bold rounded-lg w-fit text-[11px]"
                        >
                          既存の「{duplicateWarning.exactMatch.name}」に紐づける
                        </button>
                      </div>
                    )}

                    {!duplicateWarning.exactMatch && duplicateWarning.similarMatches.length > 0 && (
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Info size={14} /> 似た名前のVTuberが見つかりました: {duplicateWarning.similarMatches.map(m => m.name).join(', ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setVtuberRegMode('link')}
                          className="text-[11px] underline font-bold"
                        >
                          確認する
                        </button>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{T('vtuber.name')} <span className="form-required">*</span></label>
                      <input
                        type="text"
                        value={vtuberForm.name}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setVtuberForm(p => ({ ...p, name: val }));
                          if (val.trim()) {
                            const check = await checkDuplicateVtuber(val);
                            if (check.success) setDuplicateWarning(check.data);
                          } else {
                            setDuplicateWarning({ exactMatch: null, similarMatches: [] });
                          }
                        }}
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
                  </>
                )}

                {/* メインチャンネル設定チェックボックス */}
                <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-xl border border-[var(--border)] flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="isPrimaryCheckbox"
                    checked={isPrimaryChannel}
                    onChange={(e) => setIsPrimaryChannel(e.target.checked)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <label htmlFor="isPrimaryCheckbox" className="text-xs cursor-pointer select-none">
                    <span className="font-bold text-[var(--text-primary)] block">このチャンネルをメインチャンネルにする</span>
                    <span className="text-[11px] text-[var(--text-tertiary)] block mt-0.5">
                      チェックを入れると、このチャンネルがVTuberのメインページとして使用されます。
                    </span>
                  </label>
                </div>

                {/* 紐づくチャンネルプレビュー */}
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
              }} disabled={isPending}>{T('common.cancel')}</button>
              <button
                className="btn btn--primary"
                onClick={handleRegisterVtuber}
                disabled={
                  isPending ||
                  (vtuberRegMode === 'link' && !selectedExistingVtuber) ||
                  (vtuberRegMode === 'new' && (!vtuberForm.name.trim() || (vtuberForm.productionId === 'new' && !vtuberForm.newProductionName.trim())))
                }
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
              {modalConfig.cancelText && (
                <button
                  className="btn btn--secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
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
                {metadata && (() => {
                  const archiveUrl = `https://v-uta.app/videos/${metadata.videoId}`;
                  const count = allSongs.filter(s => !s.isDeleted).length;
                  const rawText = T('newSong.xPostText', { videoTitle: metadata.title, count: String(count) });
                  const tweetText = encodeURIComponent(rawText + archiveUrl);
                  const xUrl = `https://x.com/intent/tweet?text=${tweetText}`;
                  return (
                    <>
                      <a
                        href={xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--full text-center"
                        style={{
                          justifyContent: 'center',
                          background: '#000',
                          color: '#fff',
                          border: '1.5px solid #333',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: 600,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        {T('newSong.postToX')}
                      </a>
                      <Link
                        href={`/videos/${metadata.videoId}`}
                        className="btn btn--primary btn--full text-center"
                        style={{ justifyContent: 'center' }}
                      >
                        {T('newSong.checkOnArchive')}
                      </Link>
                    </>
                  );
                })()}
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
      {/* コラボレーター手動追加モーダル */}
      <CollabAddModal
        isOpen={isCollabAddModalOpen}
        onClose={() => setIsCollabAddModalOpen(false)}
        onAdd={handleAddCollaborators}
        description={metadata?.description || ''}
        existingCollaborators={collaborators}
      />
    </div>
    </>
  );
}
