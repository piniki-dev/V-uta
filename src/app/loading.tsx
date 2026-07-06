'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full flex flex-col space-y-24 px-6 py-12 pb-48 container mx-auto animate-loading-in">
      
      {/* 1. 楽曲ランキングセクションスケルトン */}
      <section className="space-y-6">
        {/* セクションタイトル */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full opacity-50" />
          <Skeleton variant="text" className="w-48 h-8" />
        </div>

        {/* ランキングリスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4 bg-[var(--bg-secondary)]/30 border border-[var(--border)] rounded-3xl p-6 md:p-8">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)]/50 last:border-0">
              {/* 順位 */}
              <Skeleton variant="circle" className="w-8 h-8 shrink-0 opacity-40" />
              {/* アートワーク */}
              <Skeleton variant="rect" className="w-12 h-12 rounded-lg shrink-0 opacity-70" />
              {/* 曲情報 */}
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-1/2 h-4" />
                <Skeleton variant="text" className="w-1/3 h-3 opacity-60" />
              </div>
              {/* 再生回数・操作 */}
              <Skeleton variant="text" className="w-16 h-4 opacity-50" />
            </div>
          ))}
        </div>
      </section>

      {/* 2. 人気のチャンネルセクションスケルトン */}
      <section className="space-y-6">
        {/* セクションタイトル */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full opacity-50" />
          <Skeleton variant="text" className="w-48 h-8" />
        </div>

        {/* チャンネル並び */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <Skeleton variant="circle" className="w-16 h-16 sm:w-20 sm:h-20 shadow-md ring-2 ring-[var(--border)] opacity-80" />
              <Skeleton variant="text" className="w-14 h-3 opacity-60" />
            </div>
          ))}
        </div>
      </section>

      {/* 3. 最近追加されたアーカイブセクションスケルトン */}
      <section className="space-y-6">
        {/* セクションタイトル */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full opacity-50" />
          <Skeleton variant="text" className="w-48 h-8" />
        </div>

        {/* 動画グリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-3xl overflow-hidden flex flex-col h-full">
              {/* サムネイル */}
              <div className="relative aspect-video w-full">
                <Skeleton variant="rect" className="w-full h-full rounded-none" />
              </div>

              {/* メタデータ */}
              <div className="p-5 flex flex-col flex-1 space-y-4">
                <div className="space-y-2">
                  <Skeleton variant="text" className="w-full h-4" />
                  <Skeleton variant="text" className="w-3/4 h-4" />
                </div>
                <div className="flex justify-between items-center pt-4 mt-auto">
                  <Skeleton variant="text" className="w-20 h-3 opacity-60" />
                  <Skeleton variant="text" className="w-16 h-3 opacity-60" />
                </div>
                <Skeleton variant="rect" className="w-full h-10 rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      </section>

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
