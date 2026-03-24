import { getPlayHistory } from './actions';
import HistoryClient from './HistoryClient';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.history.title} | ${t.common.siteTitle}`,
    description: t.history.description,
  };
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const result = await getPlayHistory(50, 0);

  return <HistoryClient initialHistory={result.success ? result.data || [] : []} />;
}
