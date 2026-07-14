import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('playlists')
    .select('*')
    .order('is_favorites', { ascending: false })
    .order('created_at', { ascending: false });

  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`);
  } else {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data || []);
}
