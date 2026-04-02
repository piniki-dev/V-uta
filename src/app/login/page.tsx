import { Metadata } from 'next';
import LoginForm from './LoginForm';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.auth.loginTitle} | ${t.common.siteTitle}`,
    description: t.auth.loginDescription,
  };
}

export default async function LoginPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  const initialTranslations = {
    title: t.auth.loginTitle,
    description: t.auth.loginDescription,
    backToHome: t.auth.backToHome,
  };

  return (
    <div className="w-full min-h-[calc(100vh-var(--header-height)-120px)] flex items-center justify-center p-6 py-12 relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 mesh-bg opacity-40 pointer-events-none" />
      
      {/* Dynamic ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#8e4eff]/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* ログインフォーム (Client Component) */}
      <LoginForm initialTranslations={initialTranslations} />
    </div>
  );
}
