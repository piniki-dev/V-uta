import React from 'react';
import Hero from '@/components/Hero';
import { History } from 'lucide-react';
import HistoryList from '@/components/history/HistoryList';

import type { HistoryItem } from '@/app/history/actions';

interface HistoryViewProps {
  initialHistory: HistoryItem[];
  t: Record<string, unknown>;
}

export default function HistoryView({ initialHistory, t }: HistoryViewProps) {
  // T相当の翻訳取得関数 (サーバーサイド用)
  const T = (key: string): string => {
    const keys = key.split('.');
    let current: Record<string, unknown> | string = t;
    for (const k of keys) {
      if (typeof current === 'object' && current !== null && (current as Record<string, unknown>)[k] !== undefined) {
        current = (current as Record<string, unknown>)[k] as Record<string, unknown> | string;
      } else {
        return key;
      }
    }
    return typeof current === 'string' ? current : key;
  };

  return (
    <div className="min-h-screen">
      <Hero
        title={T('history.pageTitle')}
        description={T('history.pageDescription')}
        icon={<History size={60} />}
      />

      <HistoryList initialHistory={initialHistory} />
    </div>
  );
}
