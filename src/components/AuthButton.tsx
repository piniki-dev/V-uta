'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogIn, User as UserIcon, LogOut } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function AuthButton({ user: initialUser }: { user: User | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(initialUser);

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
    router.refresh();
  };

  if (user) {
    return (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden hover:opacity-80 transition-opacity outline-none bg-white/5 border border-white/10">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata?.full_name || 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon size={20} className="text-white/60" />
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content 
            className="z-[500] min-w-[200px] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
            sideOffset={8}
            align="end"
          >
            <div className="px-3 py-2 border-bottom border-white/5 mb-1">
              <p className="text-xs text-[#666] font-medium mb-0.5">ログイン中</p>
              <p className="text-sm font-semibold text-white truncate">
                {user.user_metadata?.full_name || user.email || 'User'}
              </p>
            </div>

            <DropdownMenu.Separator className="h-px bg-white/5 my-1" />

            <DropdownMenu.Item 
              onSelect={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 text-[#ff4e8e] transition-colors outline-none cursor-pointer group"
            >
              <LogOut size={16} />
              ログアウト
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="bg-white text-black border-none rounded-full px-4 py-2 text-sm font-semibold cursor-pointer flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
    >
      <LogIn size={18} />
      Google でログイン
    </button>
  );
}
