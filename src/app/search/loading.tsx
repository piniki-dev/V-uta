'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full min-h-screen py-12 container mx-auto px-6 max-w-7xl animate-loading-in space-y-12">
      
      {/* 検索入力欄スケルトン */}
      <div className="max-w-3xl mx-auto w-full">
        <Skeleton variant="rect" className="w-full h-14 rounded-2xl" />
      </div>

      {/* タブ切り替えプレースホルダー */}
      <div className="flex justify-center border-b border-[var(--border)] pb-px gap-2">
        <Skeleton variant="rect" className="w-28 h-12 rounded-t-xl" />
        <Skeleton variant="rect" className="w-28 h-12 rounded-t-xl opacity-60" />
        <Skeleton variant="rect" className="w-28 h-12 rounded-t-xl opacity-60" />
      </div>

      {/* 検索結果（デフォルト: 楽曲リスト）のプレースホルダー */}
      <div className="space-y-6 max-w-5xl mx-auto w-full">
        {/* セクションタイトル風 */}
        <Skeleton variant="text" className="w-32 h-6" />

        {/* 楽曲リストスケルトン */}
        <div className="bg-[var(--bg-secondary)]/30 border border-[var(--border)] rounded-3xl p-6 md:p-8 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)]/50 last:border-0">
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
              {/* 再生時間・追加ボタン */}
              <Skeleton variant="text" className="w-16 h-4 opacity-50 shrink-0" />
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
