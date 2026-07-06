'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full flex flex-col min-h-screen animate-loading-in">
      {/* プレイリスト詳細の Hero スケルトン */}
      <div className="relative py-20 bg-gradient-to-b from-[var(--bg-secondary)]/50 to-transparent border-b border-[var(--border)]/30">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-xl shrink-0 opacity-80">
              <Skeleton variant="rect" className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl" />
            </div>
            <div className="space-y-3 flex-1">
              <Skeleton variant="text" className="w-48 h-10 sm:w-64 sm:h-12" />
              <Skeleton variant="text" className="w-40 h-5 sm:w-60 sm:h-6 opacity-60" />
            </div>
          </div>
          {/* 再生ボタン等 */}
          <div className="flex gap-4 shrink-0 w-full md:w-auto">
            <Skeleton variant="rect" className="w-36 h-14 rounded-2xl" />
            <Skeleton variant="rect" className="w-28 h-14 rounded-2xl opacity-60" />
          </div>
        </div>
      </div>

      {/* 楽曲リスト部分スケルトン */}
      <div className="container mx-auto px-6 py-16 max-w-7xl">
        <div className="bg-[var(--bg-secondary)]/30 border border-[var(--border)] rounded-[32px] p-6 md:p-8 space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)]/50 last:border-0">
              {/* 曲順 */}
              <Skeleton variant="text" className="w-6 h-4 opacity-40 shrink-0" />
              {/* アートワーク */}
              <Skeleton variant="rect" className="w-12 h-12 rounded-lg shrink-0 opacity-70" />
              {/* 曲名・アーティスト */}
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-1/3 h-4" />
                <Skeleton variant="text" className="w-1/4 h-3 opacity-60" />
              </div>
              {/* YouTube動画タイトルとチャンネル */}
              <div className="hidden md:flex flex-col flex-1 space-y-1.5 opacity-55">
                <Skeleton variant="text" className="w-2/3 h-3.5" />
                <Skeleton variant="text" className="w-1/2 h-3" />
              </div>
              {/* 再生時間 */}
              <Skeleton variant="text" className="w-12 h-4 opacity-50 shrink-0" />
              {/* 操作用 */}
              <Skeleton variant="circle" className="w-8 h-8 opacity-40 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animate-loading-in {
          animation: fadeInLoading 0.5s ease-out both;
        }
        @keyframes fadeInLoading {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
