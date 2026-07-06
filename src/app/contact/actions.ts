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

  // Discord Webhook 通知の送信
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      let imageFullUrl: string | undefined = undefined;
      if (data.imageUrl) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('contact_attachments')
          .createSignedUrl(data.imageUrl, 60 * 60 * 24 * 7); // 7日間有効
        if (signedUrlError) {
          console.error('Failed to create signed URL:', signedUrlError);
        } else {
          imageFullUrl = signedUrlData?.signedUrl;
        }
      }

      const categoryLabels: Record<string, string> = {
        bug: 'バグ報告 (Bug)',
        feedback: 'フィードバック (Feedback)',
        other: 'その他 (Other)'
      };
      const categoryLabel = categoryLabels[data.category] || data.category;

      interface DiscordEmbed {
        title?: string;
        color?: number;
        fields?: {
          name: string;
          value: string;
          inline?: boolean;
        }[];
        timestamp?: string;
        image?: {
          url: string;
        };
      }

      const embed: DiscordEmbed = {
        title: '📧 お問い合わせを受信しました',
        color: 0x3b82f6, // 青色
        fields: [
          {
            name: '👤 お名前',
            value: data.name || '未入力',
            inline: true
          },
          {
            name: '✉️ メールアドレス',
            value: data.email || '未入力',
            inline: true
          },
          {
            name: '📁 カテゴリ',
            value: categoryLabel,
            inline: true
          },
          {
            name: '💬 メッセージ',
            value: data.message || 'なし',
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      };

      if (user) {
        embed.fields?.push({
          name: '🔑 ユーザーID (ログイン中)',
          value: `\`${user.id}\``,
          inline: false
        });
      }

      if (imageFullUrl) {
        embed.fields?.push({
          name: '🖼️ 添付画像',
          value: `[画像を表示 (7日間有効)](${imageFullUrl})`,
          inline: false
        });
        embed.image = {
          url: imageFullUrl
        };
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: [embed]
        })
      });
    } catch (discordError) {
      console.error('Failed to send Discord webhook:', discordError);
    }
  }

  return { success: true };
}

