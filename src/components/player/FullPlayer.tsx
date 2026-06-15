import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from './PlayerContext';
import { formatTime } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import { useSidebar } from '@/components/SidebarContext';
import { useToast } from '../ToastProvider';
import { motion, AnimatePresence, Reorder, useDragControls, useMotionValue, animate } from 'framer-motion';
import { Music, ChevronDown, Play, Pause, SkipForward, SkipBack, Repeat, Repeat1, ListMusic, Shield, Trash2, Volume2 } from 'lucide-react';

import Image from 'next/image';

export default function FullPlayer() {
  const {
    state,
    play,
    seekTo,
    pause,
    resume,
    nextSong,
    prevSong,
    toggleLoop,
    closeFullPlayer,
    togglePrivacyMode,
    removeSong,
    reorderPlaylist,
    clearPlaylist,
  } = usePlayer();
  const { t, T } = useLocale();
  const { showToast } = useToast();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const isDraggingRef = useRef(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const dragControls = useDragControls();
  const SHEET_HEIGHT = 480;
  const COLLAPSED_Y = 0; // top基準では0が「ヘッダーだけ見える」状態
  const EXPANDED_Y = -(SHEET_HEIGHT - 72); // -408px: シート全体を展開
  const sheetY = useMotionValue(COLLAPSED_Y);

  // isQueueOpen 変化時にアニメーション
  useEffect(() => {
    animate(sheetY, isQueueOpen ? EXPANDED_Y : COLLAPSED_Y, {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    });
  }, [isQueueOpen, sheetY, COLLAPSED_Y, EXPANDED_Y]);

  // 再生中の曲への自動スクロール
  useEffect(() => {
    if (state.isFullPlayerOpen) {
      const timer = setTimeout(() => {
        const activeElements = document.querySelectorAll('.active-queue-item');
        activeElements.forEach((el) => {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [state.currentIndex, state.isFullPlayerOpen]);

  // プレイヤーが閉じられたときに確認モーダルをリセットする
  useEffect(() => {
    if (!state.isFullPlayerOpen) {
      const timer = setTimeout(() => {
        setIsConfirmModalOpen(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state.isFullPlayerOpen]);

  if (!state.currentSong) return null;

  const duration = state.currentSong.endSec - state.currentSong.startSec;
  const totalDuration = state.playlist.reduce((acc, song) => acc + (song.endSec - song.startSec), 0);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const seekSec = state.currentSong!.startSec + (value / 100) * duration;
    seekTo(seekSec);
  };

  return (
    <div className={`full-player animate-in fade-in duration-500 ${state.isFullPlayerOpen ? 'open' : 'closed'} ${isSidebarOpen ? 'sidebar-open' : ''} bg-[var(--bg-primary)] overflow-hidden z-[500]`}>
      <div className="absolute inset-0 mesh-bg opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)]/40 pointer-events-none" />

      {/* モバイル版 UI - ライトモード・ダークモード両対応のセマンティックカラーを使用 */}
      <div className="md:hidden flex flex-col h-full relative z-10 p-6 pt-4 safe-top safe-bottom bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-clip">
        {/* ヘッダー */}
        <div className="shrink-0 flex justify-start mb-4 z-20">
          <button 
            onClick={closeFullPlayer}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] active:scale-90 transition-transform shadow-sm"
          >
            <ChevronDown size={24} />
          </button>
        </div>

        {/* メインビジュアル - layoutアニメーションで位置をスムーズに移動 */}
        <motion.div 
          layout
          className={`flex-1 flex justify-center min-h-0 overflow-hidden ${isQueueOpen ? 'items-start mt-2' : 'items-center'}`}
        >
          <motion.div 
            layout
            id="mobile-video-portal"
            className="w-full max-h-full aspect-video rounded-[32px] overflow-hidden relative"
          />
        </motion.div>

        {/* コントロール・曲情報領域 (キューが開いている時は非表示・縮小) */}
        <AnimatePresence>
          {!isQueueOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col shrink-0 overflow-hidden"
            >
              {/* 曲名情報 */}
              <div className="shrink-0 space-y-1 mt-4">
                <h2 className="text-2xl font-black text-[var(--text-primary)] truncate leading-tight">
                  {t(state.currentSong.title, state.currentSong.title_en || state.currentSong.title)}
                </h2>
                <p className="text-lg font-bold text-[var(--text-secondary)] truncate">
                  {t(state.currentSong.artist || '-', state.currentSong.artist_en || state.currentSong.artist || '-')}
                </p>
              </div>

              {/* コントロール・シークバー */}
              <div className="shrink-0 mt-4 mb-12 space-y-8">
                <div className="space-y-3">
                   <div className="relative w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <motion.div 
                        className="absolute top-0 left-0 h-full bg-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]"
                        style={{ width: `${duration > 0 ? (state.currentTime / duration) * 100 : 0}%` }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={duration > 0 ? (state.currentTime / duration) * 100 : 0}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                   </div>
                   <div className="flex justify-between text-[11px] font-bold text-[var(--text-tertiary)] tabular-nums">
                     <span>{formatTime(state.currentTime)}</span>
                     <span>{formatTime(duration)}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between px-2">
                   <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                     <Music size={20} className="opacity-0 pointer-events-none" /> {/* Spacer */}
                   </button>
                   <div className="flex items-center gap-8">
                     <button onClick={prevSong} className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors active:scale-90">
                       <SkipBack size={32} fill="currentColor" />
                     </button>
                     <button 
                      onClick={state.isPlaying ? pause : resume}
                      className="w-20 h-20 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                     >
                       {state.isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
                     </button>
                     <button onClick={nextSong} className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors active:scale-90">
                       <SkipForward size={32} fill="currentColor" />
                     </button>
                   </div>
                   <div className="flex items-center gap-4">
                     <button 
                      onClick={() => {
                        togglePrivacyMode();
                        showToast(!state.isPrivacyMode ? T('player.privacyModeEnabled') : T('player.privacyModeDisabled'), {
                          type: 'privacy'
                        });
                      }}
                      className={`transition-colors active:scale-90 ${state.isPrivacyMode ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                      title={T('player.privacyMode') + ': ' + T('player.privacyModeDescription')}
                     >
                       <Shield size={24} fill={state.isPrivacyMode ? 'currentColor' : 'none'} />
                     </button>
                     <button 
                      onClick={() => {
                        toggleLoop();
                        const nextMode = state.loopMode === 'none' ? 'all' : state.loopMode === 'all' ? 'one' : 'none';
                        showToast(
                          nextMode === 'all'
                            ? T('player.loopAll')
                            : nextMode === 'one'
                            ? T('player.loopOne')
                            : T('player.loopNone'),
                          { type: 'info' }
                        );
                      }}
                      className={`transition-colors active:scale-90 ${state.loopMode !== 'none' ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                      title={
                        state.loopMode === 'all'
                          ? T('player.loopAll')
                          : state.loopMode === 'one'
                          ? T('player.loopOne')
                          : T('player.loopNone')
                      }
                     >
                       {state.loopMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
                     </button>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* モバイルキュー表示 (Bottom Sheet) */}
        <AnimatePresence>
          {isQueueOpen && (
            <motion.div 
              className="absolute inset-0 bg-transparent z-[1010]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQueueOpen(false)}
            />
          )}
        </AnimatePresence>

        <motion.div 
          className="absolute top-[calc(100%-72px)] left-0 right-0 h-[480px] bg-[var(--bg-secondary)] rounded-t-[40px] z-[1020] flex flex-col shadow-2xl border-t border-white/5"
          style={{ y: sheetY }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: EXPANDED_Y, bottom: 0 }}
          dragElastic={0}
          onDragEnd={(e, info) => {
            if (!isQueueOpen) {
              // 閉じた状態：上に引いて閾値を超えたら開く
              if (info.offset.y < -80 || info.velocity.y < -300) {
                setIsQueueOpen(true);
              } else {
                // 閾値未満なら元の位置に戻す
                animate(sheetY, COLLAPSED_Y, { type: 'spring', damping: 25, stiffness: 200 });
              }
            } else {
              // 開いた状態：下に引いて閾値を超えたら閉じる
              if (info.offset.y > 100 || info.velocity.y > 300) {
                setIsQueueOpen(false);
              } else {
                // 閾値未満なら元の位置に戻す
                animate(sheetY, EXPANDED_Y, { type: 'spring', damping: 25, stiffness: 200 });
              }
            }
          }}
        >
          <motion.div 
            className="flex flex-col items-center p-4 cursor-grab active:cursor-grabbing select-none shrink-0 touch-none"
            onPointerDown={(e) => {
              dragControls.start(e);
            }}
            onTap={() => {
              if (!isQueueOpen) {
                setIsQueueOpen(true);
              }
            }}
          >
            <div className="w-12 h-1 bg-[var(--border)] rounded-full mb-6" />
            <div className="flex items-center justify-between w-full px-2 mb-2">
              <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-3">
                 {T('player.queue')}
                 <span className="text-xs font-bold text-[var(--text-tertiary)] px-2 py-0.5 bg-[var(--border)] rounded-full">{state.playlist.length}</span>
              </h3>
              <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                {isQueueOpen && (
                  <button
                    onClick={() => setIsQueueOpen(false)}
                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all rounded-full hover:bg-white/5"
                    title={T('common.close') || 'Close'}
                  >
                    <ChevronDown size={20} />
                  </button>
                )}
                {state.playlist.length > 1 && (
                  <button
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="p-2 text-[var(--text-tertiary)] hover:text-red-500 active:scale-90 active:text-red-500 transition-all rounded-full hover:bg-white/5"
                    title={T('common.clear')}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
            {state.playlist.map((song, index) => (
              <div
                key={`${song.id}-${index}`}
                className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 ${
                  index === state.currentIndex 
                    ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20 shadow-sm active-queue-item' 
                    : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                }`}
              >
                <button
                  onClick={() => {
                    play(song, state.playlist);
                    setIsQueueOpen(false);
                  }}
                  className="flex-1 flex items-center gap-4 text-left min-w-0"
                >
                  <Image 
                    src={song.artworkUrl || ''} 
                    alt="" 
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-cover bg-[var(--border)]" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm truncate ${index === state.currentIndex ? 'text-[var(--accent)] font-black' : 'text-[var(--text-secondary)]'}`}>
                      {t(song.title, song.title_en || song.title)}
                      <span className="text-[11px] font-normal opacity-60 ml-2">
                        {t(song.artist || '-', song.artist_en || song.artist || '-')}
                      </span>
                    </div>
                    {song.channelName && (
                      <div className="text-xs font-bold text-[var(--accent)] truncate mt-1">
                        🎤 {song.channelName}
                      </div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSong(index);
                  }}
                  className="p-2 text-[var(--text-tertiary)] hover:text-red-500 active:scale-90 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* デスクトップ版 UI (既存のものを維持しつつ微調整) */}
      {/* デスクトップ版 UI (既存のものを維持しつつ微調整) */}
      <div className="hidden md:flex full-player__body relative z-10 p-4 md:p-6 lg:p-16 h-full flex-col lg:flex-row gap-4 md:gap-6 lg:gap-12">
        <button 
          onClick={closeFullPlayer}
          className="absolute top-6 left-6 lg:top-8 lg:left-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-[var(--text-primary)] hover:bg-white/10 transition-colors z-20 group shadow-sm"
        >
          <ChevronDown size={28} className="group-hover:translate-y-0.5 transition-transform" />
        </button>

        {/* 左(md時は上): YouTube プレイヤー + 曲情報 */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 min-w-0 min-h-0 w-full">
          <div 
            className="full-player__main relative transition-all duration-500 z-10 flex items-center justify-center"
            style={{
              aspectRatio: state.videoRatio === '9/16' ? '9/16' : '16/9',
              width: state.videoRatio === '9/16' ? 'auto' : '100%',
              height: state.videoRatio === '9/16' ? '100%' : 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <div className="full-player__video-placeholder w-full h-full" />
          </div>


        </div>

        {/* 右(md時は下): 再生リスト (Queue) */}
        <div className="w-full lg:w-[450px] h-1/3 min-h-[200px] lg:h-auto lg:min-h-0 shrink-0 flex flex-col bg-[var(--bg-secondary)]/30 backdrop-blur-2xl border border-[var(--border)] rounded-3xl lg:rounded-[40px] overflow-hidden shadow-2xl">
          <div className="p-4 lg:p-8 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight glow-text-subtle flex items-center gap-3">
              <span className="w-1.5 h-5 lg:h-6 bg-[var(--accent)] rounded-full shadow-[0_0_10px_var(--accent-glow)]" />
              {T('player.queue')}
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-xs font-bold text-[var(--text-tertiary)] hidden sm:block">
                {state.playlist.length} {T('playlist.songCount')} ({formatTime(totalDuration)})
              </div>
              {state.playlist.length > 1 && (
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="p-2 text-[var(--text-tertiary)] hover:text-red-500 transition-colors rounded-full hover:bg-white/5"
                  title={T('common.clear')}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
          
          <Reorder.Group 
            axis="y" 
            values={state.playlist} 
            onReorder={reorderPlaylist}
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-2 scrollbar-hide"
          >
            {state.playlist.map((song, index) => (
              <Reorder.Item
                key={song.id}
                value={song}
                onDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onDragEnd={() => {
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 150);
                }}
                onClick={() => {
                  if (isDraggingRef.current) return;
                  play(song, state.playlist);
                }}
                className="w-full cursor-grab active:cursor-grabbing list-none"
              >
                <motion.div
                  className={`w-full group flex items-center gap-3 p-3 rounded-3xl transition-colors duration-300 ${
                    index === state.currentIndex 
                      ? 'bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)]/10 border border-[var(--accent)]/30 shadow-[0_0_20px_var(--accent-glow)]/10 active-queue-item' 
                      : 'bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={state.isFullPlayerOpen ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: Math.min(index * 0.05 + 0.4, 1.5) }}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black tabular-nums transition-all ${
                    index === state.currentIndex 
                      ? 'bg-[var(--accent)] text-white shadow-lg' 
                      : 'bg-white/5 text-[var(--text-tertiary)] group-hover:bg-white/10 group-hover:text-[var(--text-secondary)]'
                  }`}>
                    {index === state.currentIndex ? (
                      state.isPlaying ? (
                        <Volume2 size={16} className="text-white animate-pulse" />
                      ) : (
                        <Pause size={16} className="text-white" />
                      )
                    ) : (
                      index + 1
                    )}
                  </div>

                  <Image 
                    src={song.artworkUrl || song.thumbnailUrl || ''} 
                    alt="" 
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10" 
                  />
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-bold text-sm truncate leading-tight ${
                      index === state.currentIndex ? 'text-[var(--text-primary)] font-black' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    }`}>
                      {t(song.title, song.title_en || song.title)}
                      <span className="text-xs font-normal opacity-60 ml-2">
                        {t(song.artist || '-', song.artist_en || song.artist || '-')}
                      </span>
                    </div>
                    {song.channelName && (
                      <div className="flex items-center gap-1.5 mt-1.5 truncate">
                        {song.channelThumbnailUrl && (
                          <Image
                            src={song.channelThumbnailUrl}
                            alt=""
                            width={14}
                            height={14}
                            className="w-3.5 h-3.5 rounded-full object-cover inline-block border border-white/10"
                          />
                        )}
                        <span className="text-xs font-bold text-[var(--accent)] tracking-wide">
                          {song.channelName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] font-black tabular-nums text-[var(--text-tertiary)] flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSong(index);
                      }}
                      className="hidden group-hover:flex p-2 text-[var(--text-tertiary)] hover:text-red-500 active:scale-90 transition-colors"
                      title={T('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="group-hover:hidden">
                      {formatTime(song.endSec - song.startSec)}
                    </span>
                  </div>
                </motion.div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </div>

      {/* 再生リストクリア確認モーダル */}
      {typeof window !== 'undefined' && isConfirmModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsConfirmModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body">
              <div className="modal-icon modal-icon--danger">
                <Trash2 size={32} />
              </div>
              <h3 className="modal-title">{T('common.clear')}</h3>
              <p className="modal-text">
                {T('player.clearQueueConfirm')}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn--secondary"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                {T('common.cancel')}
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  clearPlaylist();
                }}
              >
                {T('common.clear')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
