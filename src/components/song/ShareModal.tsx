'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import type { PlayerSong } from '@/types';
import { useLocale } from '@/components/LocaleProvider';
import { sendGAEvent } from '@next/third-parties/google';

interface Props {
  song: PlayerSong;
  onClose: () => void;
  trackNumber?: number;
}

export default function ShareModal({ song, onClose, trackNumber }: Props) {
  const { T } = useLocale();
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // アプリ内の共有用URL (クライアントサイドでのみ生成)
  // トラック番号がある場合はそれを優先し、ない場合は songId を使用
  const appUrl = isMounted 
    ? trackNumber
      ? `${window.location.origin}/videos/${song.videoId}?track=${trackNumber}`
      : `${window.location.origin}/videos/${song.videoId}?songId=${song.id}`
    : '';
  
  // YouTubeのタイムスタンプ付きURL (サブ用途)
  const youtubeUrl = `https://youtu.be/${song.videoId}?t=${song.startSec}`;
  
  // X (Twitter) 投稿用のテキスト
  const shareText = `${song.title} / ${song.artist || '不明'} - ${song.videoTitle || '動画'} / ${song.channelName || '不明'} #V_uta`;
  const xIntentUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(appUrl)}`;

  const handleCopy = () => {
    if (!appUrl) return;
    sendGAEvent('event', 'share_song', {
      song_id: song.id,
      song_title: song.title,
      method: 'copy_url',
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isMounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border-light)] flex items-center justify-between">
          <h3 className="font-bold text-lg text-[var(--text-primary)]">{T('share.title')}</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 曲情報プレビュー */}
          <div className="flex gap-4 items-center p-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-light)]">
            {song.artworkUrl ? (
              <img src={song.artworkUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-xl flex items-center justify-center shrink-0">
                <span className="text-2xl">🎵</span>
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate text-[var(--text-primary)]">{song.title}</div>
              <div className="text-xs text-[var(--text-secondary)] truncate">{song.artist}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* X 投稿ボタン */}
            <a
              href={xIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                sendGAEvent('event', 'share_song', {
                  song_id: song.id,
                  song_title: song.title,
                  method: 'x_post',
                });
              }}
              className="flex items-center justify-center gap-3 w-full py-3.5 bg-[var(--text-primary)] text-[var(--bg-primary)] font-black rounded-2xl hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              {T('share.postToX')}
            </a>

            {/* URLコピー */}
            <div className="relative group">
              <div className="flex items-center gap-2 p-1.5 pl-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl focus-within:border-[var(--accent)] transition-colors">
                <span className="text-xs text-[var(--text-tertiary)] truncate flex-1 font-mono">{appUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    copied 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      {T('share.copied')}
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      {T('share.copy')}
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
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] flex items-center gap-1.5 transition-colors"
            >
              {T('share.openOnYoutube')}
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
