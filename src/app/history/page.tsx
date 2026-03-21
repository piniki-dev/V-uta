import { getPlayHistory } from './actions';
import HistoryClient from './HistoryClient';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const metadata = {
  title: '再生履歴 | V-uta',
  description: 'あなたが最近再生した楽曲の履歴です。',
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const result = await getPlayHistory(100);

  return (
    <div className="bg-black text-white min-h-screen">
      <HistoryClient initialHistory={result.success ? result.data || [] : []} />
    </div>
  );
}
