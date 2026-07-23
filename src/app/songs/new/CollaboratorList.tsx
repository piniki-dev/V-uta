'use client';

import Image from 'next/image';
import { Users, Plus, Check, AlertTriangle, UserPlus, Trash2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import type { CollaboratorChannelPreview } from './actions';

interface CollaboratorListProps {
  collaborators: CollaboratorChannelPreview[];
  onOpenAddModal: () => void;
  onRemoveCollaborator: (ytChannelId: string) => void;
  onRegisterVtuber: (collab: CollaboratorChannelPreview) => void;
}

export default function CollaboratorList({
  collaborators,
  onOpenAddModal,
  onRemoveCollaborator,
  onRegisterVtuber,
}: CollaboratorListProps) {
  const { T } = useLocale();

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-3 text-xs font-bold text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[var(--accent)]" />
          <span>
            {T('newSong.detectedCollaborators')} ({collaborators.length})
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="btn btn--secondary text-[11px] py-1 px-2.5 h-auto rounded-lg flex items-center gap-1 cursor-pointer hover:border-[var(--accent)] transition-colors"
        >
          <Plus size={12} />
          <span>{T('newSong.addCollabChannel')}</span>
        </button>
      </div>

      {collaborators.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {collaborators.map((collab) => (
            <div
              key={collab.ytChannelId}
              className="flex items-center justify-between p-2.5 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border)] text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {collab.avatarUrl ? (
                  <Image
                    src={collab.avatarUrl}
                    alt={collab.name}
                    width={28}
                    height={28}
                    className="rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                    {collab.name.substring(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate text-[var(--text-primary)]">{collab.name}</p>
                  {collab.handle && (
                    <p className="text-[10px] text-[var(--text-tertiary)] truncate">{collab.handle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {collab.isOriginalUploader ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-alpha-10)] text-[var(--accent)] border border-[var(--accent-alpha-20)]">
                    {T('newSong.originalUploader')}
                  </span>
                ) : collab.isRegistered ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Check size={10} /> {T('newSong.registered')}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                      <AlertTriangle size={10} /> {T('newSong.unregistered')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRegisterVtuber(collab)}
                      className="btn btn--primary text-[10px] py-1 px-2 h-auto rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={10} /> {T('newSong.register')}
                    </button>
                  </div>
                )}

                {!collab.isOriginalUploader && (
                  <button
                    type="button"
                    onClick={() => onRemoveCollaborator(collab.ytChannelId)}
                    className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5 cursor-pointer"
                    title={T('common.clear')}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
