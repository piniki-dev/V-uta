'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerContext';
import YouTubePlayer from './YouTubePlayer';
import { useSidebar } from '@/components/SidebarContext';

export default function PersistentPlayer() {
  const { state } = usePlayer();
  const { isOpen: isSidebarOpen } = useSidebar();
  const videoWindowRef = useRef<HTMLDivElement>(null);

  // モバイル + フルプレイヤー時: ポータルターゲットの座標を取得してvideo-windowを重ねる
  // DOM移動しないのでiframeの再読み込みが発生しない
  useEffect(() => {
    const videoWindow = videoWindowRef.current;
    if (!videoWindow) return;

    let animationFrameId: number;
    let syncEndTime = Date.now() + 1000; // 初期ロード/切り替え時から1秒間同期する

    // ポータルターゲット(モバイル・デスクトップ別)の座標にvideo-windowを重ねる
    const syncPosition = () => {
      let portalTarget: Element | null = null;
      
      // ブレイクポイント(md=768px未満)で同期先を切り替え
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        portalTarget = document.getElementById('mobile-video-portal');
      } else {
        portalTarget = document.getElementById('desktop-video-portal');
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
          
          // ポータル要素の現在の角丸スタイルを同期
          const style = window.getComputedStyle(portalTarget);
          videoWindow.style.borderRadius = style.borderRadius;
          videoWindow.style.overflow = 'hidden';
        }
      }

      // 指定時間内であれば次のフレームでも同期を続ける（開閉アニメーションなどの追従のため）
      if (Date.now() < syncEndTime) {
        animationFrameId = requestAnimationFrame(syncPosition);
      }
    };

    // 同期ループ開始
    syncPosition();

    // リサイズや画面向き変更時に一定時間同期を再開して追従させる
    const handleResize = () => {
      syncEndTime = Date.now() + 500; // 0.5秒間同期を回す
      syncPosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [state.isFullPlayerOpen]);

  const isHidden = !state.currentSong;

  return (
    <div 
      ref={videoWindowRef}
      className={`video-window ${state.isFullPlayerOpen ? 'video-window--full' : 'video-window--pip'} ${isSidebarOpen ? 'sidebar-open' : ''} ${isHidden ? 'video-window--hidden' : ''}`}
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

