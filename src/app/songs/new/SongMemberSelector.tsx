'use client';

import Image from 'next/image';
import { Users, Check } from 'lucide-react';
import type { CollaboratorChannelPreview } from './actions';

interface SongMemberSelectorProps {
  collaborators: CollaboratorChannelPreview[];
  selectedChannelIds: number[];
  onChange: (newChannelIds: number[]) => void;
  isCoverVideo?: boolean;
}

export default function SongMemberSelector({
  collaborators,
  selectedChannelIds,
  onChange,
  isCoverVideo = false,
}: SongMemberSelectorProps) {
  // 歌ってみた動画の場合は個別選択不要
  if (isCoverVideo) {
    return null;
  }

  // 登録済みのチャンネルのみ対象（channelRecordId があるもの）
  const validCollaborators = collaborators.filter((c) => c.isRegistered && c.channelRecordId != null);

  // コラボチャンネルが投稿者以外に1つも無ければ、選択の余地がないため非表示
  if (validCollaborators.length <= 1) {
    return null;
  }

  const toggleChannel = (channelRecordId: number) => {
    const isSelected = selectedChannelIds.includes(channelRecordId);
    let updated: number[];
    if (isSelected) {
      // 最低1人は選択されている状態を保持したいため、すべて外れるのを防ぐか、そのまま除外
      updated = selectedChannelIds.filter((id) => id !== channelRecordId);
      if (updated.length === 0) {
        return; // 全解除防止
      }
    } else {
      updated = [...selectedChannelIds, channelRecordId];
    }
    onChange(updated);
  };

  const handleSelectAll = () => {
    const allCids = validCollaborators.map((c) => c.channelRecordId!);
    onChange(allCids);
  };

  const handleSelectSolo = () => {
    const original = validCollaborators.find((c) => c.isOriginalUploader);
    if (original?.channelRecordId) {
      onChange([original.channelRecordId]);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]/60">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <Users size={13} className="text-[var(--accent)]" />
          <span>歌唱メンバー（曲の参加チャンネル）</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={handleSelectSolo}
            className="text-[var(--text-tertiary)] hover:text-[var(--accent)] font-semibold transition-colors cursor-pointer"
          >
            ソロ
          </button>
          <span className="text-[var(--border)]">|</span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[var(--text-tertiary)] hover:text-[var(--accent)] font-semibold transition-colors cursor-pointer"
          >
            全員
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {validCollaborators.map((collab) => {
          const cid = collab.channelRecordId!;
          const isSelected = selectedChannelIds.includes(cid);
          return (
            <button
              key={collab.ytChannelId}
              type="button"
              onClick={() => toggleChannel(cid)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
              }`}
            >
              {collab.avatarUrl ? (
                <Image
                  src={collab.avatarUrl}
                  alt={collab.name}
                  width={18}
                  height={18}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[9px] font-bold shrink-0">
                  {collab.name.substring(0, 1)}
                </div>
              )}
              <span className="truncate max-w-[120px]">{collab.name}</span>
              {isSelected && <Check size={12} className="shrink-0 text-[var(--accent)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
