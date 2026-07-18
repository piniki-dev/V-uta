import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('created_by', user.id)
    .order('is_favorites', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data || []);
}
