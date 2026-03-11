'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';

export default function AuthButton({ user: initialUser }: { user: User | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    console.log('[AuthButton] Initial User from props:', initialUser?.id);
    // マウント時にも明示的に現在のセッションを取りに行く（SSR起因の古いPropsを上書き）
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? initialUser);
      
      console.log('[AuthButton] Client Session User:', session?.user?.id);
      
      // クライアントでセッションがあるのに、サーバーから渡された props が未ログインだった場合はサーバー状態が古いので再フェッチ
      if (session?.user && !initialUser) {
        console.log('[AuthButton] Forcing router.refresh() due to stale props');
        router.refresh();
      }
    };
    checkSession();
  }, [initialUser, supabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthButton] Auth State Changed:', event, session?.user?.id);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh(); // セッション状態をサーバーコンポーネントに反映
  };

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {user.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
            />
          )}
          <span>{user.user_metadata?.full_name || 'User'}</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      style={{
        background: 'var(--text-primary)',
        color: 'var(--bg-primary)',
        border: 'none',
        borderRadius: 'var(--radius-full)',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'var(--transition)',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'var(--text-primary)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <LogIn size={18} />
      Google でログイン
    </button>
  );
}
