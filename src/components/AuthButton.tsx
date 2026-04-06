'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogIn, User as UserIcon, LogOut, Sun, Moon, Languages, Search, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTheme } from 'next-themes';
import { useLocale } from './LocaleProvider';
import { useHeader } from './HeaderProvider';
import Image from 'next/image';

export default function AuthButton({ user: initialUser }: { user: User | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(initialUser);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, T, isMounted } = useLocale();
  const { isMobileSearchActive, toggleMobileSearch } = useHeader();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? initialUser);
      
      if (session?.user && !initialUser) {
        router.refresh();
      }
    };
    checkSession();
  }, [initialUser, supabase, router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleLogin = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (user) {
    // ハイドレーション前は、テーマやポータルに依存しないシンプルな構成にする
    if (!isMounted) {
      return (
        <div className="flex items-center gap-2">
          {/* モバイル検索ボタン (SSR一致用) */}
          <div className="sm:hidden p-2 text-[var(--text-secondary)]">
            <Search size={20} />
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)]">
            {user.user_metadata?.avatar_url ? (
               <div className="w-full h-full rounded-full overflow-hidden relative">
                 <Image
                   src={user.user_metadata.avatar_url}
                   alt=""
                   fill
                   sizes="36px"
                   className="object-cover"
                 />
               </div>
            ) : (
              <UserIcon size={20} className="text-[var(--text-tertiary)]" />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMobileSearch}
          className="sm:hidden p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          aria-label={isMobileSearchActive ? T('common.close') : T('header.searchPlaceholder')}
        >
          {isMobileSearchActive ? <X size={20} /> : <Search size={20} />}
        </button>

        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button className={`items-center justify-center w-9 h-9 rounded-full overflow-hidden hover:opacity-80 transition-opacity outline-none bg-[var(--bg-elevated)] border border-[var(--border)] ${isMobileSearchActive ? 'hidden sm:flex' : 'flex'}`}>
              {user.user_metadata?.avatar_url ? (
                <Image
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name || 'User'}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon size={20} className="text-[var(--text-tertiary)]" />
              )}
            </button>
          </DropdownMenu.Trigger>

        {isMounted && (
          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className="z-[500] min-w-[200px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
              sideOffset={8}
              align="end"
            >
              <div className="px-3 py-2 border-bottom border-[var(--border)] mb-1">
                <p className="text-xs text-[var(--text-tertiary)] font-medium mb-0.5">{T('auth.signedInAs')}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {user.user_metadata?.full_name || user.email || 'User'}
                </p>
              </div>

              <DropdownMenu.Separator className="h-px bg-[var(--border)] my-1" />

              <DropdownMenu.Item 
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors outline-none cursor-pointer group"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? T('auth.switchThemeLight') : T('auth.switchThemeDark')}
              </DropdownMenu.Item>

              <DropdownMenu.Item 
                onSelect={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors outline-none cursor-pointer group"
              >
                <Languages size={16} />
                {T('auth.switchLanguage')}
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-[var(--border)] my-1" />

              <DropdownMenu.Item 
                onSelect={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors outline-none cursor-pointer group"
              >
                <LogOut size={16} />
                {T('auth.signOut')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </DropdownMenu.Root>
      </div>
    );
  }

  // 未ログイン状態の表示
  if (!isMounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="sm:hidden p-2 text-[var(--text-secondary)]">
          <Search size={20} />
        </div>
        <div className="p-2 text-[var(--text-secondary)]">
          <Languages size={20} />
        </div>
        <div className="p-2 text-[var(--text-secondary)]">
          <Moon size={20} />
        </div>
        <div className="bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <LogIn size={18} />
          {T('header.login')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleMobileSearch}
        className="sm:hidden p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
        aria-label={isMobileSearchActive ? T('common.close') : T('header.searchPlaceholder')}
      >
        {isMobileSearchActive ? <X size={20} /> : <Search size={20} />}
      </button>

      <button
        onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
        className={`p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors ${isMobileSearchActive ? 'hidden sm:flex' : 'flex'}`}
        title={T('auth.switchLanguage')}
      >
        <Languages size={20} />
      </button>

      <button 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors ${isMobileSearchActive ? 'hidden sm:flex' : 'flex'}`}
        title={theme === 'dark' ? T('auth.switchThemeLight') : T('auth.switchThemeDark')}
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <button
        onClick={handleLogin}
        className={`bg-[var(--text-primary)] text-[var(--bg-primary)] border-none rounded-full px-4 py-2 text-sm font-semibold cursor-pointer items-center gap-2 transition-all hover:scale-105 active:scale-95 ${isMobileSearchActive ? 'hidden sm:flex' : 'flex'}`}
      >
        <LogIn size={18} />
        {T('header.login')}
      </button>
    </div>
  );
}
