'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  MoreVertical, 
  Play, 
  ListPlus, 
  Plus, 
  Share2, 
  ExternalLink
} from 'lucide-react';
import { usePlayer } from '@/components/player/PlayerContext';
import type { PlayerSong } from '@/types';
import PlaylistAddModal from '@/components/playlist/PlaylistAddModal';
import ShareModal from './ShareModal';
import { useLocale } from '@/components/LocaleProvider';

interface SongMenuProps {
  song: PlayerSong;
  trigger?: React.ReactNode;
}

export default function SongMenu({ song, trigger }: SongMenuProps) {
  const { addSongNext, addSongLast } = usePlayer();
  const { t, T } = useLocale();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleAddNext = (e: Event) => {
    e.stopPropagation();
    addSongNext(song);
  };

  const handleAddLast = (e: Event) => {
    e.stopPropagation();
    addSongLast(song);
  };

  const handleOpenPlaylistModal = (e: Event) => {
    e.stopPropagation();
    setShowPlaylistModal(true);
  };

  const handleOpenShareModal = (e: Event) => {
    e.stopPropagation();
    setShowShareModal(true);
  };

  const openYouTube = (e: Event) => {
    e.stopPropagation();
    window.open(`https://youtu.be/${song.videoId}?t=${song.startSec}`, '_blank');
  };

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          {trigger || (
            <button 
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[var(--text-tertiary)] hover:text-[var(--accent)] flex items-center justify-center outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content 
            className="z-[500] min-w-[200px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
            sideOffset={5}
            align="end"
            collisionPadding={80}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu.Item 
              onSelect={handleAddNext}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-colors outline-none cursor-pointer group"
            >
              <Play size={16} className="text-[var(--text-tertiary)] group-hover:text(--accent)]" />
              {T('songMenu.playNext')}
            </DropdownMenu.Item>
            
            <DropdownMenu.Item 
              onSelect={handleAddLast}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] transition-colors outline-none cursor-pointer group"
            >
              <ListPlus size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
              {T('songMenu.addToQueue')}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-[var(--border)] my-1" />

            <DropdownMenu.Item 
              onSelect={handleOpenPlaylistModal}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] transition-colors outline-none cursor-pointer group"
            >
              <Plus size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
              {T('songMenu.addToPlaylist')}
            </DropdownMenu.Item>

            <DropdownMenu.Item 
              onSelect={handleOpenShareModal}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] transition-colors outline-none cursor-pointer group"
            >
              <Share2 size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
              {T('songMenu.share')}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-[var(--border)] my-1" />

            <DropdownMenu.Item 
              onSelect={openYouTube}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[var(--bg-hover)] transition-colors outline-none cursor-pointer group"
            >
              <ExternalLink size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
              {T('songMenu.openInYoutube')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {showPlaylistModal && (
        <PlaylistAddModal
          songId={song.id}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          song={song}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}
