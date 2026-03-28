'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Menu, X, Home, PlusSquare, ListMusic, ChevronDown, 
  ChevronRight, LogOut, User, Search, Settings, History 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { getPlaylists } from '@/app/playlists/actions';
import type { Playlist } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { useLocale } from './LocaleProvider';

export default function Sidebar() {
  const { isOpen, close, toggle } = useSidebar();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { T } = useLocale();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (user) {
      loadPlaylists();
    }
  }, [user]);

  const loadPlaylists = async () => {
    const res = await getPlaylists();
    if (res.success && res.data) {
      setPlaylists(res.data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // モバイル時にリンククリックで閉じる
  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      close();
    }
  };

  return (
    <>
      {/* モバイル用オーバーレイ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="sidebar-overlay md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar__inner custom-scrollbar">
          {/* ヘッダー (モバイル用) */}
          <div className="sidebar__header md:hidden">
            <div className="sidebar__logo">
              <img src="/logo-icon.png" alt="V-uta" className="header__logo-img" />
              <span className="header__logo-text text-xl">V-uta</span>
            </div>
            <button className="sidebar__close" onClick={close}>
              <X size={24} />
            </button>
          </div>

          {/* ユーザー情報 (モバイル用) */}
          <div className="sidebar__user md:hidden">
            {user ? (
              <div className="sidebar__user-info">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="sidebar__avatar" />
                ) : (
                  <div className="sidebar__avatar-placeholder"><User size={20} /></div>
                )}
                <div className="truncate">
                  <div className="sidebar__username truncate">{user.user_metadata?.full_name || T('auth.guest')}</div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <button className="sidebar__login-btn" onClick={handleLogin}>
                {T('auth.signInWithGoogle')}
              </button>
            )}
          </div>

          <nav className="sidebar__nav">
            <Link href="/" className="sidebar__link" onClick={handleLinkClick}>
              <div className="sidebar__icon-box"><Home size={22} /></div>
              <span>{T('sidebar.home')}</span>
            </Link>

            <Link href="/songs/new" className="sidebar__link" onClick={handleLinkClick}>
              <div className="sidebar__icon-box"><PlusSquare size={22} /></div>
              <span>{T('sidebar.addSong')}</span>
            </Link>

            <Link href="/history" className="sidebar__link" onClick={handleLinkClick}>
              <div className="sidebar__icon-box"><History size={22} /></div>
              <span>{T('sidebar.history')}</span>
            </Link>

            <Link href="/channels" className="sidebar__link" onClick={handleLinkClick}>
              <div className="sidebar__icon-box"><User size={22} /></div>
              <span>{T('sidebar.channels')}</span>
            </Link>

            <div className="sidebar__divider" />

            {/* プレイリストセクション */}
            <div className="sidebar__section">
              <button 
                className="sidebar__link w-full"
                onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
              >
                <div className="sidebar__icon-box"><ListMusic size={22} /></div>
                <span className="flex-1 text-left">{T('sidebar.playlists')}</span>
                {isPlaylistOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              
              <AnimatePresence>
                {isPlaylistOpen && (
                  <motion.div 
                    className="sidebar__subnav"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <div className="sidebar__sublink-container">
                      <Link href="/playlists" className="sidebar__sublink font-bold text-[var(--accent)]" onClick={handleLinkClick}>
                        {T('sidebar.allPlaylists')}
                      </Link>
                    </div>
                    {playlists.map(playlist => (
                      <div key={playlist.id} className="sidebar__sublink-container">
                        <Link 
                          href={playlist.is_favorites ? '/playlists/favorite' : `/playlists/${playlist.slug}`}
                          className="sidebar__sublink"
                          onClick={handleLinkClick}
                        >
                          {playlist.is_favorites ? T('playlist.favorites') : playlist.name}
                        </Link>
                      </div>
                    ))}
                    {user && playlists.length === 0 && (
                      <div className="sidebar__empty">{T('sidebar.noPlaylists')}</div>
                    )}
                    {!user && (
                      <div className="sidebar__empty">{T('sidebar.signInToView')}</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="sidebar__divider" />

            <div className="sidebar__section">
              <div className="sidebar__link opacity-40 cursor-not-allowed">
                <div className="sidebar__icon-box"><Search size={22} /></div>
                <span>{T('sidebar.search')}</span>
              </div>
              <div className="sidebar__link opacity-40 cursor-not-allowed">
                <div className="sidebar__icon-box"><Settings size={22} /></div>
                <span>{T('sidebar.settings')}</span>
              </div>
            </div>
          </nav>

          {user && (
            <div className="sidebar__footer md:hidden mt-auto pt-4">
              <button className="sidebar__logout" onClick={handleLogout}>
                <LogOut size={20} />
                <span>{T('auth.signOut')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
