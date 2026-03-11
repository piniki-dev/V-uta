import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import NewSongClient from './NewSongClient';

export const metadata = {
  title: '歌を登録 | V-uta',
};

export default async function NewSongPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // 未ログイン時はトップページへリダイレクト
    redirect('/');
  }

  return <NewSongClient />;
}
