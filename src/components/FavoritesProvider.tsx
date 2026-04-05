'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFavoriteSongIds, toggleFavorite as toggleFavoriteAction } from '@/app/favorites/actions';
import { createClient } from '@/utils/supabase/client';

interface FavoritesContextType {
  favoriteIds: Set<number>;
  isFavorited: (songId: number) => boolean;
  toggleFavorite: (songId: number) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const initFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      
      if (user) {
        const ids = await getFavoriteSongIds();
        if (mounted) {
          setFavoriteIds(new Set(ids));
          setIsLoading(false);
        }
      } else {
        if (mounted) {
          setFavoriteIds(new Set());
          setIsLoading(false);
        }
      }
    };

    initFavorites();

    // 認証状態の変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      initFavorites();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const toggleFavorite = async (songId: number) => {
    const result = await toggleFavoriteAction(songId);
    if (result.success) {
      const newState = result.data?.isFavorited;
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (newState) {
          next.add(songId);
        } else {
          next.delete(songId);
        }
        return next;
      });
    } else {
      alert(result.error);
    }
  };

  const isFavorited = (songId: number) => favoriteIds.has(songId);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorited, toggleFavorite, isLoading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
