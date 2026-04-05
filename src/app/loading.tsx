'use client';

import Skeleton from '@/components/Skeleton';

export default function Loading() {

  return (
    <div className="w-full flex flex-col p-6 md:p-12 animate-loading-in">
      {/* ヒーローセクション風スケルトン */}
      <div className="mb-12">
        <Skeleton variant="text" className="w-48 h-10 mb-4" />
        <Skeleton variant="text" className="w-96 h-6 opacity-50" />
      </div>

      {/* コンテンツセクションスケルトン */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton variant="circle" className="w-12 h-12" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-3/4 h-5" />
                <Skeleton variant="text" className="w-1/2 h-4 opacity-50" />
              </div>
            </div>
            <Skeleton variant="rect" className="w-full h-40 rounded-2xl" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton variant="text" className="w-24 h-4" />
              <Skeleton variant="circle" className="w-8 h-8" />
            </div>
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
