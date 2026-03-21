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
          flex items-center bg-[#121212] border border-[#282828] rounded-lg px-4 py-2.5 transition-all
          ${isFocused ? 'bg-[#242424] border-[#555] ring-1 ring-[#555]' : 'hover:bg-[#1a1a1a] hover:border-[#3e3e3e]'}
        `}
      >
        <Search className="text-[#757575] mr-4 shrink-0" size={20} strokeWidth={1.5} />
        <input
          type="text"
          className="flex-1 bg-transparent border-none text-[var(--text-primary)] text-[15px] outline-none p-0 placeholder-[#757575] font-normal"
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
