import React from 'react';
import Hero from '@/components/Hero';
import { History } from 'lucide-react';
import HistoryList from '@/components/history/HistoryList';

interface HistoryViewProps {
  initialHistory: any[];
  t: any;
}

export default function HistoryView({ initialHistory, t }: HistoryViewProps) {
  // T相当の翻訳取得関数 (サーバーサイド用)
  const T = (key: string): string => {
    const keys = key.split('.');
    let current: any = t;
    for (const k of keys) {
      if (current[k] !== undefined) current = current[k];
      else return key;
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
