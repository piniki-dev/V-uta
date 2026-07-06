'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full flex flex-col min-h-screen animate-loading-in">
      {/* プレイリスト一覧の Hero スケルトン */}
      <div className="relative py-20 bg-gradient-to-b from-[var(--bg-secondary)]/50 to-transparent border-b border-[var(--border)]/30">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-xl shrink-0 opacity-80">
              {/* プレイリスト用アイコン風 */}
              <Skeleton variant="rect" className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Skeleton variant="text" className="w-48 h-10 sm:w-64 sm:h-12" />
              <Skeleton variant="text" className="w-60 h-5 sm:w-80 sm:h-6 opacity-60" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16 max-w-7xl">
        {/* 新規作成ボタンや表示順コントロール風プレースホルダー */}
        <div className="flex justify-between items-center mb-10">
          <Skeleton variant="text" className="w-32 h-6" />
          <Skeleton variant="rect" className="w-40 h-12 rounded-2xl" />
        </div>

        {/* プレイリストカードグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="group bg-[var(--bg-secondary)]/30 border border-[var(--border)] rounded-[32px] overflow-hidden flex flex-col h-full hover:border-[var(--accent)] transition-all duration-300">
              {/* カードカバー */}
              <div className="relative aspect-video w-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <Skeleton variant="rect" className="w-full h-full rounded-none" />
              </div>

              {/* カード詳細 */}
              <div className="p-6 space-y-4 flex flex-col flex-1">
                <div className="space-y-2">
                  <Skeleton variant="text" className="w-3/4 h-5" />
                  <Skeleton variant="text" className="w-1/2 h-3.5 opacity-60" />
                </div>
                <div className="flex justify-between items-center pt-4 mt-auto border-t border-[var(--border)]/40">
                  <Skeleton variant="text" className="w-20 h-4 opacity-50" />
                  <Skeleton variant="circle" className="w-8 h-8 opacity-40" />
                </div>
              </div>
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
