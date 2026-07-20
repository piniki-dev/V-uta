'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

export default function BetaNoticeBanner() {
  const { T } = useLocale();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 backdrop-blur-sm shadow-sm transition-all duration-200 hover:border-amber-500/40">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            <span>{T('home.betaNoticeTitle')}</span>
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              Beta
            </span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300">
            {T('home.betaNoticeMessage')}
          </p>
        </div>
      </div>
    </div>
  );
}
