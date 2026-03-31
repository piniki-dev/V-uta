'use server';

import { createClient } from '@/utils/supabase/server';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

export type InquiryData = {
  name?: string;
  email?: string;
  category: 'bug' | 'feedback' | 'other';
  message: string;
  imageUrl?: string;
};

export async function sendInquiry(data: InquiryData) {
  const supabase = await createClient();
  const T = await getLocaleT();

  // ユーザーIDの取得（ログイン中の場合）
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('inquiries').insert({
    user_id: user?.id,
    name: data.name,
    email: data.email,
    category: data.category,
    message: data.message,
    image_url: data.imageUrl,
    status: 'open'
  });

  if (error) {
    console.error('sendInquiry error:', error);
    return { success: false, error: T.contact.form.errorMessage };
  }

  return { success: true };
}
