'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerContext';
import YouTubePlayer from './YouTubePlayer';
import { useSidebar } from '@/components/SidebarContext';

export default function PersistentPlayer() {
  const { state } = usePlayer();
  const { isOpen: isSidebarOpen } = useSidebar();
  const videoWindowRef = useRef<HTMLDivElement>(null);
  const originalParentRef = useRef<HTMLElement | null>(null);

  // モバイル + フルプレイヤー時: ポータルターゲットの座標を取得してvideo-windowを重ねる
  // DOM移動しないのでiframeの再読み込みが発生しない
  useEffect(() => {
    const videoWindow = videoWindowRef.current;
    if (!videoWindow) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    if (!(state.isFullPlayerOpen && isMobile)) {
      // フルプレイヤー閉じ時: inline styleをリセット、CSSクラスがPIP表示を制御
      videoWindow.style.position = '';
      videoWindow.style.width = '';
      videoWindow.style.height = '';
      videoWindow.style.top = '';
      videoWindow.style.left = '';
      videoWindow.style.right = '';
      videoWindow.style.bottom = '';
      videoWindow.style.zIndex = '';
      videoWindow.style.borderRadius = '';
      videoWindow.style.overflow = '';
      return;
    }

    let animationFrameId: number;

    // ポータルターゲットの座標にvideo-windowを重ねる
    const syncPosition = () => {
      const portalTarget = document.getElementById('mobile-video-portal');
      if (!portalTarget || !videoWindow) return;
      
      const rect = portalTarget.getBoundingClientRect();
      
      // 座標が取得できている場合のみ適用（0の場合はまだマウントされていない等）
      if (rect.width > 0 && rect.height > 0) {
        videoWindow.style.position = 'fixed';
        videoWindow.style.top = `${rect.top}px`;
        videoWindow.style.left = `${rect.left}px`;
        videoWindow.style.width = `${rect.width}px`;
        videoWindow.style.height = `${rect.height}px`;
        videoWindow.style.right = 'auto';
        videoWindow.style.bottom = 'auto';
        videoWindow.style.zIndex = '1002';
        videoWindow.style.borderRadius = '32px';
        videoWindow.style.overflow = 'hidden';
      }

      // 次のフレームでも同期を続ける（アニメーションやスクロール追従のため）
      animationFrameId = requestAnimationFrame(syncPosition);
    };

    // 同期ループ開始
    syncPosition();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state.isFullPlayerOpen]);

  if (!state.currentSong) return null;

  return (
    <div 
      ref={videoWindowRef}
      className={`video-window ${state.isFullPlayerOpen ? 'video-window--full' : 'video-window--pip'} ${isSidebarOpen ? 'sidebar-open' : ''}`}
      data-full={state.isFullPlayerOpen}
      data-pip-position={state.pipPosition}
      data-zoomed={state.isZoomed}
      data-video-ratio={state.videoRatio}
      data-video-ratio-mode={state.videoRatioMode}
    >
      {/* アンビエントグロー - フルプレイヤー表示時のみ、ビデオと同じ座標に描画 */}
      {state.isFullPlayerOpen && state.currentSong?.thumbnailUrl && (
        <div 
          className="absolute inset-0 opacity-50 blur-[100px] scale-110 pointer-events-none transition-all duration-700 z-0"
          style={{
            backgroundImage: `url(${state.currentSong.thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <div className="video-window__inner">
        <YouTubePlayer />
      </div>
    </div>
  );
}

