'use client';

import { useState } from 'react';
import { Wrench, RefreshCw, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

export function MaintenanceClient() {
  const { T } = useLocale();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 relative overflow-hidden font-sans">
      {/* 背景のオーロラグラデーション */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[400px] bg-gradient-to-tr from-indigo-600/25 via-purple-600/20 to-pink-500/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-sky-500/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* メインカードコンテナ */}
      <div className="max-w-2xl md:max-w-3xl w-full z-10 p-6 sm:p-8 md:p-10 rounded-2xl md:rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-2xl shadow-indigo-950/40 space-y-8">
        
        {/* 上部ヘッダー（ロゴ＆ステータスバッジ） */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <span className="font-extrabold text-white text-xl tracking-tight">V</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">V-uta</h2>
              <p className="text-xs text-slate-400">VTuber Song Archive & Player</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            {T('maintenance.statusBadge')}
          </div>
        </div>

        {/* メインコンテンツ（2カラム） */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* ビジュアルカード */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
            <div className="w-20 h-20 rounded-2xl bg-indigo-900/60 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 backdrop-blur-md">
              <Wrench className="w-10 h-10 text-indigo-400 animate-pulse" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">{T('maintenance.visualTitle')}</h3>
            <p className="text-xs text-slate-400 mt-1">{T('maintenance.visualDescription')}</p>
          </div>

          {/* 説明・インフォメーション */}
          <div className="md:col-span-7 space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              {T('maintenance.mainTitle')}
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {T('maintenance.mainDescription')}
            </p>

            {/* 詳細ステータスグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{T('maintenance.workDetailTitle')}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{T('maintenance.workDetailDesc')}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{T('maintenance.resumeTitle')}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{T('maintenance.resumeDesc')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 下部アクションボタン */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? T('maintenance.refreshingButton') : T('maintenance.refreshButton')}
          </button>
        </div>

        {/* コピーライト / セキュリティ */}
        <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>{T('maintenance.securityFooter')}</span>
        </div>

      </div>
    </div>
  );
}
