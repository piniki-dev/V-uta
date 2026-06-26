'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="page-container animate-loading-in">
      {/* 動画情報ヘッダーのスケルトン */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-5 md:p-8 mb-12 flex flex-col md:flex-row gap-6 md:gap-10 relative overflow-hidden shadow-2xl">
        {/* 動画サムネイルプレースホルダー */}
        <div className="w-full md:w-80 aspect-video rounded-2xl overflow-hidden shrink-0">
          <Skeleton variant="rect" className="w-full h-full" />
        </div>

        {/* メタデータテキスト領域プレースホルダー */}
        <div className="flex-1 flex flex-col justify-center min-w-0 space-y-4">
          {/* カテゴリ / 曲数バッジ */}
          <div className="flex items-center gap-3">
            <Skeleton variant="text" className="w-20 h-6 rounded-full opacity-70" />
            <Skeleton variant="text" className="w-24 h-6 rounded-full opacity-50" />
          </div>

          {/* 動画タイトル */}
          <Skeleton variant="text" className="w-full md:w-4/5 h-8 md:h-10" />

          {/* チャンネル情報 */}
          <div className="flex items-center gap-3 py-1">
            <Skeleton variant="circle" className="w-8 h-8 opacity-70" />
            <Skeleton variant="text" className="w-32 h-5 opacity-60" />
          </div>

          {/* アクションボタン */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 pt-2">
            <Skeleton variant="rect" className="w-full md:w-40 h-10 rounded-xl opacity-80" />
            <Skeleton variant="rect" className="w-full md:w-40 h-10 rounded-xl opacity-80" />
          </div>
        </div>
      </div>

      {/* 収録曲リストのスケルトン */}
      <div className="space-y-4">
        {/* セクションタイトルプレースホルダー */}
        <Skeleton variant="text" className="w-32 h-6 mb-6 opacity-60" />

        {/* 曲目リスト行プレースホルダー */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 px-5 bg-[var(--bg-secondary)]/30 border border-[var(--border)]/50 rounded-2xl">
            {/* 再生マーク / 番号プレースホルダー */}
            <Skeleton variant="circle" className="w-8 h-8 opacity-60" />

            {/* アートワークプレースホルダー */}
            <Skeleton variant="rect" className="w-10 h-10 rounded-lg opacity-70" />

            {/* 曲名 / アーティスト名プレースホルダー */}
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="w-2/3 md:w-1/3 h-4" />
              <Skeleton variant="text" className="w-1/3 md:w-1/4 h-3 opacity-60" />
            </div>

            {/* 時間情報プレースホルダー */}
            <Skeleton variant="text" className="w-16 h-4 opacity-50" />
          </div>
        ))}
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
