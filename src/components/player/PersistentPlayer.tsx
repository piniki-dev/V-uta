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
    let isScrolling = false;
    let scrollTimeoutId: NodeJS.Timeout;

    // スクロール状態の監視（iOS Safari用）
    const handleScroll = () => {
      isScrolling = true;
      clearTimeout(scrollTimeoutId);
      scrollTimeoutId = setTimeout(() => {
        isScrolling = false;
        // スクロールが停止したら最新位置に同期する
        syncPosition();
      }, 150);
    };

    // ポータルターゲット(モバイル・デスクトップ別)の座標にvideo-windowを重ねる
    const syncPosition = () => {
      // ミニプレイヤー表示中でスクロール中の場合は、位置の更新をスキップする
      // これによりiOSでのスクロールに伴う動画のブレ（ガタつき）を完全に防ぐ
      if (!state.isFullPlayerOpen && isScrolling) {
        animationFrameId = requestAnimationFrame(syncPosition);
        return;
      }

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

      // 次のフレームでも同期を続ける
      animationFrameId = requestAnimationFrame(syncPosition);
    };

    // 同期ループ開始
    syncPosition();

    // イベントリスナーの登録
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleResize = () => {
      syncPosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(scrollTimeoutId);
      window.removeEventListener('scroll', handleScroll);
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

