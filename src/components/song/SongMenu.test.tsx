import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import SongMenu from './SongMenu';
import { PlayerProvider } from '@/components/player/PlayerContext';
import { LocaleProvider } from '@/components/LocaleProvider';

// PlayerContext のモック
vi.mock('@/components/player/PlayerContext', async () => {
  const actual = await vi.importActual('@/components/player/PlayerContext');
  return {
    ...actual,
    usePlayer: () => ({
      addSongNext: vi.fn(),
      addSongLast: vi.fn(),
    }),
  };
});

// Radix UI のモック
vi.mock('@radix-ui/react-dropdown-menu', () => {
  return {
    Root: ({ children }: any) => <div data-testid="dropdown-root">{children}</div>,
    Trigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    Portal: ({ children }: any) => <div data-testid="dropdown-portal">{children}</div>,
    Content: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
    Item: ({ children, onSelect }: any) => (
      <div 
        onClick={() => onSelect && onSelect({ stopPropagation: () => {} })} 
        data-testid="dropdown-item"
      >
        {children}
      </div>
    ),
    Separator: () => <hr />,
  };
});

// モーダルのモック（ポータルなどの複雑さを避けるため）
vi.mock('@/app/playlists/PlaylistAddModal', () => ({
  default: () => <div data-testid="playlist-modal">Playlist Modal</div>,
}));

vi.mock('./ShareModal', () => ({
  default: () => <div data-testid="share-modal">Share Modal</div>,
}));

// ResizeObserver のポリフィル（Radix UI用）
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockSong = {
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  title_en: 'Test Song EN',
  artist_en: 'Test Artist EN',
  artworkUrl: 'https://example.com/art.jpg',
  videoId: 'video123',
  startSec: 0,
  endSec: 180,
  channelName: 'Test Channel',
  thumbnailUrl: null,
  videoTitle: 'Test Video',
};

describe('SongMenu', () => {
  it('トリガーボタンが表示されること', () => {
    render(
      <LocaleProvider>
        <SongMenu song={mockSong} />
      </LocaleProvider>
    );
    // aria-label などがないので、ボタンの存在を確認
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('クリックするとメニュー項目が表示されること', async () => {
    render(
      <LocaleProvider>
        <SongMenu song={mockSong} />
      </LocaleProvider>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // ドロップダウン項目が表示されるのを待つ
    // findByText は内部的に waitFor を使うため、非同期な表示に対応できる
    expect(await screen.findByText('次に再生')).toBeInTheDocument();
    expect(await screen.findByText('再生リストの最後に追加')).toBeInTheDocument();
    expect(await screen.findByText('プレイリストに追加')).toBeInTheDocument();
    expect(await screen.findByText('共有')).toBeInTheDocument();
  });
});
