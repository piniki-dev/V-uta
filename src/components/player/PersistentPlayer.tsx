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

    if (!state.isFullPlayerOpen) {
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

    // ポータルターゲット(モバイル・デスクトップ別)の座標にvideo-windowを重ねる
    const syncPosition = () => {
      let portalTarget: Element | null = null;
      
      // ブレイクポイント(md=768px未満)で同期先を切り替え
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        portalTarget = document.getElementById('mobile-video-portal');
      } else {
        portalTarget = document.querySelector('.full-player__video-placeholder');
      }

      if (portalTarget && videoWindow) {
        const rect = portalTarget.getBoundingClientRect();
        
        // 座標が取得できている場合のみ適用
        if (rect.width > 0 && rect.height > 0) {
          videoWindow.style.position = 'fixed';
          videoWindow.style.top = `${rect.top}px`;
          videoWindow.style.left = `${rect.left}px`;
          videoWindow.style.width = `${rect.width}px`;
          videoWindow.style.height = `${rect.height}px`;
          videoWindow.style.right = 'auto';
          videoWindow.style.bottom = 'auto';
          videoWindow.style.zIndex = '3000';
          videoWindow.style.borderRadius = '32px';
          videoWindow.style.overflow = 'hidden';
        }
      }

      // 次のフレームでも同期を続ける（アニメーションやリサイズ追従のため）
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
      data-video-ratio={state.videoRatio}
      data-video-ratio-mode={state.videoRatioMode}
    >

      <div className="video-window__inner">
        <YouTubePlayer />
      </div>
    </div>
  );
}

