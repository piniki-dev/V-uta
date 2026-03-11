import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      revalidatePath('/', 'layout');
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    } else {
      console.error('Exchange error:', error);
      return NextResponse.redirect(`${requestUrl.origin}/?error=${encodeURIComponent(error.message)}`);
    }
  }

  // エラー時、またはコードが無い場合はトップページかエラー用ページにリダイレクト
  return NextResponse.redirect(`${requestUrl.origin}/`);
}
