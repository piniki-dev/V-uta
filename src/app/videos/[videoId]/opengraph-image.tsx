import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export const alt = 'V-uta | VTuber Karaoke Player';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image({
  params,
  searchParams
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { videoId } = await params;
  const sParams = await searchParams;
  const track = typeof sParams?.track === 'string' ? parseInt(sParams.track) : null;

  // アプリアイコンの読み込み
  let iconData;
  try {
    const iconPath = join(process.cwd(), 'src/app/icon.svg');
    const buffer = await readFile(iconPath);
    iconData = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load icon:', e);
  }

  // OGP用にシンプルなクライアントを用意
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  // 動画情報の取得
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .eq('video_id', videoId)
    .single();

  if (videoError || !video) {
    return new ImageResponse(
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: 'white' }}>
        Video Not Found / OGP Error
      </div>,
      size
    );
  }

  // 特定のトラック情報を取得
  let songInfo = null;
  if (track) {
    const { data: songs } = await supabase
      .from('songs')
      .select('*, master_songs(*)')
      .eq('video_id', video.id)
      .eq('is_active', true)
      .order('start_sec', { ascending: true });

    if (songs && songs[track - 1]) {
      songInfo = songs[track - 1];
    }
  }

  const title = songInfo ? (songInfo.master_songs?.title || "Unknown Song") : video.title;
  const artist = songInfo ? (songInfo.master_songs?.artist || video.channels?.name) : video.channels?.name;
  const artwork = songInfo?.master_songs?.artwork_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const blurBg = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0f0f',
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blurBg}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.3,
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '40px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', width: '500px', height: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px', justifyContent: 'center' }}>
            <div style={{ fontSize: '24px', color: '#ff4e8e', marginBottom: '12px', fontWeight: 'bold' }}>
              {songInfo ? 'SONG' : 'VIDEO'}
            </div>
            <div style={{ fontSize: '48px', color: 'white', fontWeight: 'bold', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </div>
            <div style={{ fontSize: '28px', color: '#aaa', marginBottom: 'auto' }}>{artist}</div>

            {/* Platform Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {iconData && <img src={iconData} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />}
              <span style={{ fontSize: '24px', color: 'white', fontWeight: 900 }}>V-uta</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
