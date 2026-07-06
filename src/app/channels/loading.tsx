'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full flex flex-col min-h-screen animate-loading-in">
      {/* チャンネル一覧の Hero スケルトン */}
      <div className="relative py-20 bg-gradient-to-b from-[var(--bg-secondary)]/50 to-transparent border-b border-[var(--border)]/30">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl shadow-xl shrink-0 opacity-80">
              <Skeleton variant="circle" className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
            <div className="space-y-3">
              <Skeleton variant="text" className="w-48 h-10 sm:w-64 sm:h-12" />
              <Skeleton variant="text" className="w-32 h-5 sm:w-40 sm:h-6 opacity-60" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl space-y-10">
        {/* 検索・ソートバーのスケルトン */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          <Skeleton variant="rect" className="w-full md:w-96 h-14 rounded-2xl" />
          <div className="flex gap-4 w-full md:w-auto shrink-0">
            <Skeleton variant="rect" className="w-32 h-14 rounded-2xl" />
            <Skeleton variant="rect" className="w-32 h-14 rounded-2xl" />
          </div>
        </div>

        {/* チャンネルグリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="group relative flex flex-col items-center text-center p-6 bg-[var(--bg-secondary)]/30 border border-[var(--border)]/70 hover:border-[var(--accent)] rounded-[32px] transition-all duration-300">
              <Skeleton variant="circle" className="w-20 h-20 sm:w-24 sm:h-24 shadow-md ring-2 ring-[var(--border)]/50 mb-4 opacity-80" />
              <Skeleton variant="text" className="w-20 h-5 mb-2" />
              <Skeleton variant="text" className="w-14 h-3 opacity-60 mb-5" />
              <Skeleton variant="rect" className="w-full h-10 rounded-2xl opacity-80" />
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
