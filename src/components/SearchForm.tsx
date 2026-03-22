'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form className="flex-1 max-w-[520px] mx-4 max-sm:hidden" onSubmit={handleSubmit}>
      <div 
        className={`
          flex items-center bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 transition-all
          ${isFocused ? 'bg-[var(--bg-tertiary)] border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] hover:border-[var(--border-light)]'}
        `}
      >
        <Search className="text-[var(--text-tertiary)] mr-4 shrink-0" size={20} strokeWidth={1.5} />
        <input
          type="text"
          className="flex-1 bg-transparent border-none text-[var(--text-primary)] text-[15px] outline-none p-0 placeholder-[var(--text-tertiary)] font-normal"
          placeholder="楽曲、チャンネルを検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>
    </form>
  );
}
