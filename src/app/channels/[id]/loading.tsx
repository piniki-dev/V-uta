'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="w-full min-h-screen pb-48 animate-loading-in">
      {/* ヒーローセクション風スケルトン */}
      <section className="relative overflow-hidden border-b border-[var(--border)] py-12 md:py-16 bg-[var(--bg-secondary)]/10">
        <div className="container relative z-10 w-full px-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-10 text-center md:text-left">
            {/* チャンネル画像プレースホルダー */}
            <div className="relative shrink-0">
              <Skeleton variant="circle" className="w-32 h-32 md:w-44 md:h-44 ring-4 ring-[var(--border)] shadow-2xl" />
            </div>

            {/* テキスト情報プレースホルダー */}
            <div className="flex-1 flex flex-col items-center md:items-start w-full space-y-4">
              {/* ハンドルバッジ */}
              <Skeleton variant="text" className="w-32 h-6 rounded-full opacity-60" />
              
              {/* チャンネル名 */}
              <Skeleton variant="text" className="w-64 md:w-96 h-10 md:h-12" />

              {/* VTuber情報や所属事務所 */}
              <div className="flex items-center gap-3 mt-2">
                <Skeleton variant="text" className="w-24 h-5 opacity-80" />
                <Skeleton variant="text" className="w-20 h-6 rounded-full opacity-50" />
              </div>

              {/* アクションボタン */}
              <div className="flex flex-wrap gap-4 justify-center md:justify-start items-center pt-4 w-full">
                <Skeleton variant="rect" className="w-32 h-11 rounded-2xl opacity-80" />
                <Skeleton variant="rect" className="w-32 h-11 rounded-2xl opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* アーカイブ一覧セクションスケルトン */}
      <section className="py-20">
        <div className="container px-6">
          {/* セクションタイトル */}
          <div className="flex items-center gap-4 mb-14">
            <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full opacity-50" />
            <Skeleton variant="text" className="w-48 h-8" />
            <Skeleton variant="text" className="w-24 h-6 rounded-full opacity-60" />
          </div>

          {/* 動画グリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl md:rounded-3xl overflow-hidden flex flex-col h-full p-0">
                {/* サムネイル部分 */}
                <div className="relative aspect-video w-full">
                  <Skeleton variant="rect" className="w-full h-full rounded-none" />
                </div>

                {/* 情報部分 */}
                <div className="p-5 flex flex-col flex-1 space-y-4">
                  {/* 動画タイトル (2行想定) */}
                  <div className="space-y-2">
                    <Skeleton variant="text" className="w-full h-4" />
                    <Skeleton variant="text" className="w-5/6 h-4" />
                  </div>

                  {/* 日付と曲数 */}
                  <div className="flex justify-between items-center pt-4 mt-auto">
                    <Skeleton variant="text" className="w-20 h-3 opacity-60" />
                    <Skeleton variant="text" className="w-16 h-3 opacity-60" />
                  </div>

                  {/* 曲リスト表示ボタン */}
                  <Skeleton variant="rect" className="w-full h-10 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
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
