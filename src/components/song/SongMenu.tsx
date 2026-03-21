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
import PlaylistAddModal from '@/app/playlists/PlaylistAddModal';
import ShareModal from './ShareModal';

interface SongMenuProps {
  song: PlayerSong;
  trigger?: React.ReactNode;
}

export default function SongMenu({ song, trigger }: SongMenuProps) {
  const { addSongNext, addSongLast } = usePlayer();
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
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-[#666] hover:text-[#ff4e8e] flex items-center justify-center outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content 
            className="z-[500] min-w-[200px] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
            sideOffset={5}
            align="end"
            collisionPadding={80}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu.Item 
              onSelect={handleAddNext}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-[#ff4e8e]/10 hover:text-[#ff4e8e] transition-colors outline-none cursor-pointer group"
            >
              <Play size={16} className="text-[#666] group-hover:text-[#ff4e8e]" />
              次に再生
            </DropdownMenu.Item>
            
            <DropdownMenu.Item 
              onSelect={handleAddLast}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors outline-none cursor-pointer group"
            >
              <ListPlus size={16} className="text-[#666] group-hover:text-white" />
              再生リストの最後に追加
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-white/5 my-1" />

            <DropdownMenu.Item 
              onSelect={handleOpenPlaylistModal}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors outline-none cursor-pointer group"
            >
              <Plus size={16} className="text-[#666] group-hover:text-white" />
              プレイリストに追加
            </DropdownMenu.Item>

            <DropdownMenu.Item 
              onSelect={handleOpenShareModal}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors outline-none cursor-pointer group"
            >
              <Share2 size={16} className="text-[#666] group-hover:text-white" />
              共有
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-white/5 my-1" />

            <DropdownMenu.Item 
              onSelect={openYouTube}
              className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition-colors outline-none cursor-pointer group"
            >
              <ExternalLink size={16} className="text-[#666] group-hover:text-white" />
              YouTubeで開く
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
