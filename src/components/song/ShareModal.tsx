'use client';

import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import type { PlayerSong } from '@/types';

interface Props {
  song: PlayerSong;
  onClose: () => void;
}

export default function ShareModal({ song, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  // YouTubeのタイムスタンプ付きURL
  const youtubeUrl = `https://youtu.be/${song.videoId}?t=${song.startSec}`;
  
  // X (Twitter) 投稿用のテキスト
  const shareText = `${song.title} / ${song.artist || '不明'} - ${song.videoTitle || '動画'} / ${song.channelName || '不明'} #V_uta`;
  const xIntentUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(youtubeUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(youtubeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-lg">共有する</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#666] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 曲情報プレビュー */}
          <div className="flex gap-4 items-center p-3 bg-white/5 rounded-2xl border border-white/5">
            {song.artworkUrl ? (
              <img src={song.artworkUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-2xl">🎵</span>
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{song.title}</div>
              <div className="text-xs text-[#666] truncate">{song.artist}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* X 投稿ボタン */}
            <a
              href={xIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3.5 bg-white text-black font-black rounded-2xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X にポストする
            </a>

            {/* URLコピー */}
            <div className="relative group">
              <div className="flex items-center gap-2 p-1.5 pl-4 bg-white/5 border border-white/10 rounded-2xl focus-within:border-[#ff4e8e]/50 transition-colors">
                <span className="text-xs text-[#666] truncate flex-1 font-mono">{youtubeUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    copied 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      コピー完了
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      コピー
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <a 
              href={youtubeUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-[#666] hover:text-[#ff4e8e] flex items-center gap-1.5 transition-colors"
            >
              YouTube で実際に開く
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
