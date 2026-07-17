'use client';

import React from 'react';
import Skeleton from '@/components/Skeleton';
import Hero from '@/components/Hero';
import { Music } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen animate-loading-in">
      {/* ヒーローセクションのスケルトン */}
      <Hero
        title={<Skeleton variant="text" className="w-48 h-10" />}
        description={<Skeleton variant="text" className="w-full max-w-md h-6 opacity-60" />}
        icon={<Music size={64} className="opacity-40" />}
      />

      <div className="container py-12 pb-48 px-6 max-w-5xl mx-auto space-y-8">
        
        {/* Step 1: YouTube URL 入力カードのスケルトン */}
        <div className="card">
          <div className="card__header">
            <span className="card__step opacity-60">1</span>
            <h2 className="card__title">
              <Skeleton variant="text" className="w-32 h-6" />
            </h2>
          </div>

          <div className="card__body space-y-6">
            <div className="form-group">
              <div className="mb-2">
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
              <div className="form-input-group flex gap-2">
                <Skeleton variant="rect" className="w-full h-11 rounded-xl opacity-60" />
                <Skeleton variant="rect" className="w-24 h-11 rounded-xl opacity-80 shrink-0" />
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-[var(--border)] text-center flex flex-col items-center gap-4">
              <div className="w-full space-y-2 flex flex-col items-center">
                <Skeleton variant="text" className="w-3/4 max-w-md h-4 opacity-50" />
                <Skeleton variant="text" className="w-1/2 max-w-xs h-4 opacity-50" />
              </div>
              <Skeleton variant="rect" className="w-44 h-11 rounded-xl opacity-70" />
            </div>
          </div>
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
