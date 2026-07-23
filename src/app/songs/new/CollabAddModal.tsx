'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Plus, Loader2, Check, AlertCircle, Sparkles, FileText, UserPlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useLocale } from '@/components/LocaleProvider';
import { extractChannelsFromDescription, resolveChannelByInput, type CollaboratorChannelPreview } from './actions';

interface CollabAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (channels: CollaboratorChannelPreview[]) => void;
  description: string;
  existingCollaborators: CollaboratorChannelPreview[];
}

export default function CollabAddModal({
  isOpen,
  onClose,
  onAdd,
  description,
  existingCollaborators,
}: CollabAddModalProps) {
  const { T } = useLocale();

  const [activeTab, setActiveTab] = useState<'description' | 'manual'>('description');
  
  // 概要欄抽出タブ State
  const [extractedChannels, setExtractedChannels] = useState<CollaboratorChannelPreview[]>([]);
  const [selectedExtractedIds, setSelectedExtractedIds] = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [hasExtracted, setHasExtracted] = useState(false);

  // 手動入力タブ State
  const [inputVal, setInputVal] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [previewChannel, setPreviewChannel] = useState<CollaboratorChannelPreview | null>(null);
  const [manualPendingChannels, setManualPendingChannels] = useState<CollaboratorChannelPreview[]>([]);

  const existingIds = useMemo(() => existingCollaborators.map((c) => c.ytChannelId), [existingCollaborators]);

  // 概要欄自動抽出処理
  const handleExtract = useCallback(async () => {
    if (!description.trim()) {
      setExtractedChannels([]);
      setHasExtracted(true);
      return;
    }
    setIsExtracting(true);
    setExtractError('');
    try {
      const res = await extractChannelsFromDescription(description, existingIds);
      if (res.success) {
        setExtractedChannels(res.data);
        // デフォルトで全選択
        setSelectedExtractedIds(new Set(res.data.map((c) => c.ytChannelId)));
      } else {
        setExtractError(res.error);
      }
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : 'Error');
    } finally {
      setIsExtracting(false);
      setHasExtracted(true);
    }
  }, [description, existingIds]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('description');
      setExtractedChannels([]);
      setSelectedExtractedIds(new Set());
      setHasExtracted(false);
      setExtractError('');
      setInputVal('');
      setResolveError('');
      setPreviewChannel(null);
      setManualPendingChannels([]);

      // モーダルオープン時に概要欄抽出を実行
      handleExtract();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    // モーダルの開閉切り替え時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelectExtracted = (id: string) => {
    setSelectedExtractedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 手動解決実行
  const handleResolveInput = async () => {
    if (!inputVal.trim()) return;
    setIsResolving(true);
    setResolveError('');
    setPreviewChannel(null);

    const pendingIds = manualPendingChannels.map((c) => c.ytChannelId);
    const combinedExisting = [...existingIds, ...pendingIds];

    try {
      const res = await resolveChannelByInput(inputVal, combinedExisting);
      if (res.success && res.data) {
        setPreviewChannel(res.data);
      } else if (!res.success) {
        setResolveError(res.error);
      }
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Error');
    } finally {
      setIsResolving(false);
    }
  };

  // プレビューを保留リストに追加
  const handleAddPreviewToPending = () => {
    if (!previewChannel) return;
    setManualPendingChannels((prev) => [...prev, previewChannel]);
    setPreviewChannel(null);
    setInputVal('');
  };

  // 保留リストから削除
  const handleRemovePending = (ytChannelId: string) => {
    setManualPendingChannels((prev) => prev.filter((c) => c.ytChannelId !== ytChannelId));
  };

  // モーダル確定追加
  const handleConfirmAdd = () => {
    if (activeTab === 'description') {
      const toAdd = extractedChannels.filter((c) => selectedExtractedIds.has(c.ytChannelId));
      if (toAdd.length > 0) {
        onAdd(toAdd);
      }
    } else {
      if (manualPendingChannels.length > 0) {
        onAdd(manualPendingChannels);
      }
    }
    onClose();
  };

  const currentTabAddCount = activeTab === 'description'
    ? selectedExtractedIds.size
    : manualPendingChannels.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold">
              <UserPlus size={18} />
            </div>
            <h3 className="font-bold text-base md:text-lg text-[var(--text-primary)]">
              {T('newSong.addCollabModalTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-tertiary)]/20 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'description'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles size={15} />
            {T('newSong.tabFromDescription')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Search size={15} />
            {T('newSong.tabManualInput')}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'description' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-[var(--accent)]" />
                  {T('newSong.extractFromDescription')}
                </span>
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="text-[var(--accent)] font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isExtracting && <Loader2 size={12} className="animate-spin" />}
                  {isExtracting ? T('newSong.extracting') : hasExtracted ? T('newSong.reExtract') : T('newSong.extracting')}
                </button>
              </div>

              {isExtracting ? (
                <div className="py-12 text-center text-xs text-[var(--text-tertiary)] flex flex-col items-center gap-3">
                  <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                  <span>{T('newSong.extracting')}</span>
                </div>
              ) : extractError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{extractError}</span>
                </div>
              ) : hasExtracted && extractedChannels.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]/30 rounded-xl border border-[var(--border)] p-6">
                  <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                  <p>{T('newSong.noChannelsFound')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {extractedChannels.map((collab) => {
                    const isSelected = selectedExtractedIds.has(collab.ytChannelId);
                    return (
                      <div
                        key={collab.ytChannelId}
                        onClick={() => toggleSelectExtracted(collab.ytChannelId)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/50'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border)] hover:border-[var(--border-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 rounded text-[var(--accent)] border-[var(--border)] bg-[var(--bg-secondary)] pointer-events-none"
                          />
                          {collab.avatarUrl ? (
                            <Image
                              src={collab.avatarUrl}
                              alt={collab.name}
                              width={32}
                              height={32}
                              className="rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-bold shrink-0">
                              {collab.name.substring(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-xs md:text-sm truncate text-[var(--text-primary)]">
                              {collab.name}
                            </p>
                            {collab.handle && (
                              <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                                {collab.handle}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          {collab.isRegistered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check size={10} /> {T('newSong.registered')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {T('newSong.unregistered')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 手動入力タブ */
            <div className="space-y-4">
              <div className="form-group mb-0">
                <label className="form-label text-xs font-bold text-[var(--text-secondary)]">
                  {T('newSong.tabManualInput')}
                </label>
                <div className="form-input-group">
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleResolveInput();
                      }
                    }}
                    placeholder={T('newSong.manualInputPlaceholder')}
                    className="form-input text-xs"
                    disabled={isResolving}
                  />
                  <button
                    type="button"
                    onClick={handleResolveInput}
                    disabled={isResolving || !inputVal.trim()}
                    className="btn btn--primary text-xs px-4"
                  >
                    {isResolving ? <Loader2 size={14} className="animate-spin" /> : T('newSong.resolve')}
                  </button>
                </div>
              </div>

              {resolveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* 検索結果プレビュー */}
              {previewChannel && (
                <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--accent)]/40 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    {previewChannel.avatarUrl ? (
                      <Image
                        src={previewChannel.avatarUrl}
                        alt={previewChannel.name}
                        width={36}
                        height={36}
                        className="rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-bold shrink-0">
                        {previewChannel.name.substring(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs md:text-sm text-[var(--text-primary)] truncate">
                        {previewChannel.name}
                      </p>
                      {previewChannel.handle && (
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                          {previewChannel.handle}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPreviewToPending}
                    className="btn btn--primary text-xs py-1.5 px-3 h-auto rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus size={14} />
                    {T('newSong.addToPendingList')}
                  </button>
                </div>
              )}

              {/* 追加予定リスト */}
              {manualPendingChannels.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <p className="text-xs font-bold text-[var(--text-secondary)]">
                    {T('newSong.pendingAdditions')} ({manualPendingChannels.length})
                  </p>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {manualPendingChannels.map((collab) => (
                      <div
                        key={collab.ytChannelId}
                        className="flex items-center justify-between p-2.5 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border)] text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {collab.avatarUrl ? (
                            <Image
                              src={collab.avatarUrl}
                              alt={collab.name}
                              width={24}
                              height={24}
                              className="rounded-full shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                              {collab.name.substring(0, 1)}
                            </div>
                          )}
                          <span className="font-bold truncate text-[var(--text-primary)]">{collab.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePending(collab.ytChannelId)}
                          className="p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-tertiary)]/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            {T('common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={currentTabAddCount === 0}
            className="btn btn--primary text-xs md:text-sm py-2 px-5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus size={16} />
            {T('newSong.addSelected')} ({currentTabAddCount})
          </button>
        </div>
      </div>
    </div>
  );
}
