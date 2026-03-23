'use client';

import React, { useTransition } from 'react';
import { Heart } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { useFavorites } from '@/components/FavoritesProvider';

interface FavoriteButtonProps {
  songId: number;
  initialIsFavorited?: boolean; // Keep for compatibility but use context
  size?: number;
  className?: string;
  onToggle?: (isFavorited: boolean) => void;
}

export default function FavoriteButton({ 
  songId, 
  size = 20,
  className = '',
  onToggle
}: FavoriteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { T } = useLocale();
  const { isFavorited: getIsFavorited, toggleFavorite } = useFavorites();
  
  const isFavorited = getIsFavorited(songId);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) return;

    startTransition(async () => {
      await toggleFavorite(songId);
      if (onToggle) onToggle(!isFavorited);
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`relative group/fav p-2 rounded-full transition-all duration-300 ${
        isFavorited 
          ? 'text-[var(--accent)] hover:bg-[var(--accent)]/5' 
          : 'text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'
      } ${className}`}
      title={isFavorited ? T('songMenu.removeFromFavorites') : T('songMenu.addToFavorites')}
    >
      <div className="relative flex items-center justify-center">
        {/* Glow effect when favorited */}
        {isFavorited && (
          <div className="absolute inset-0 bg-[var(--accent)]/20 blur-md rounded-full -z-10 animate-pulse" />
        )}
        <Heart 
          size={size} 
          fill={isFavorited ? 'currentColor' : 'none'} 
          className={`transition-all duration-500 ease-out ${
            isPending 
              ? 'scale-90 opacity-50' 
              : isFavorited 
                ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,78,142,0.4)]' 
                : 'group-hover/fav:scale-120 group-hover/fav:text-[var(--accent)] active:scale-90'
          }`}
        />
      </div>
      
    </button>
  );
}
