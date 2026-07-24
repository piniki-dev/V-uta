/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export const alt = 'V-uta | VTuber Karaoke Player';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

// フォントのローカルキャッシュ読み込み/ダウンロード関数
async function loadFont() {
  const cacheDir = join(process.cwd(), '.next/cache');
  const fontPath = join(cacheDir, 'NotoSansJP-Medium.ttf');

  try {
    return await readFile(fontPath);
  } catch {
    try {
      console.log('Downloading Noto Sans JP for OGP caching...');
      const res = await fetch(
        new URL('https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansJP/NotoSansJP-Medium.ttf')
      );
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);
        await mkdir(cacheDir, { recursive: true });
        await writeFile(fontPath, nodeBuffer);
        return nodeBuffer;
      }
    } catch (fetchErr) {
      console.error('Failed to download font:', fetchErr);
    }
  }
  return undefined;
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const decodedId = safeDecode(id).trim();

  let channelName = 'VTuber Channel';
  let channelImage = '';
  let videoCount = 0;
  let songCount = 0;

  // アプリアイコンの読み込み
  let iconData: string | undefined;
  try {
    const iconPath = join(process.cwd(), 'src/app/icon.svg');
    const buffer = await readFile(iconPath);
    iconData = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load icon:', e);
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    // チャンネル情報を取得
    let activeChannel = null;
    const isNumeric = /^\d+$/.test(decodedId);

    let query = supabase.from('channels').select('*');
    if (isNumeric) {
      query = query.eq('id', Number(decodedId));
    } else {
      const handleWithAt = decodedId.startsWith('@') ? decodedId : `@${decodedId}`;
      query = query.ilike('handle', handleWithAt);
    }

    const { data: channel, error } = await query.single();
    activeChannel = channel;

    if ((error || !channel) && !isNumeric) {
      const altHandle = decodedId.startsWith('@') ? decodedId.substring(1) : decodedId;
      const { data: retryChannel } = await supabase
        .from('channels')
        .select('*')
        .ilike('handle', altHandle)
        .single();
      activeChannel = retryChannel;
    }

    if (activeChannel) {
      channelName = activeChannel.name;
      channelImage = activeChannel.image || '';

      // このチャンネルに紐付くVideoのIDを video_channels から取得
      const { data: videoChanRows } = await supabase
        .from('video_channels')
        .select('video_id')
        .eq('channel_id', activeChannel.id);

      if (videoChanRows && videoChanRows.length > 0) {
        const videoIds = videoChanRows.map((v: { video_id: number }) => v.video_id);

        // 曲が登録されている songs を video_id ごとに取得
        const { data: songRows } = await supabase
          .from('songs')
          .select('video_id')
          .in('video_id', videoIds)
          .eq('is_active', true);

        if (songRows) {
          // 曲が1曲以上ある歌枠数（video_id の重複除去）
          const videosWithSongs = new Set(songRows.map((s: { video_id: number }) => s.video_id));
          videoCount = videosWithSongs.size;
          songCount = songRows.length;
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch channel metadata for OGP:', e);
  }

  // チャンネル名の長さ調整とフォントサイズ決定（スマホでの視認性重視）
  let displayName = channelName;
  let nameFontSize = '34px';
  if (channelName.length > 22) {
    displayName = channelName.slice(0, 21) + '...';
    nameFontSize = '28px';
  } else if (channelName.length > 14) {
    nameFontSize = '28px';
  } else if (channelName.length > 8) {
    nameFontSize = '30px';
  }

  const fontData = await loadFont();

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
          gap: '40px',
          background: '#070709',
          overflow: 'hidden',
          fontFamily: 'Noto Sans JP, sans-serif',
          color: '#ffffff',
        }}
      >
        {/* 背景グロー */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '-60px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-157px',
            right: '-60px',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 78, 142, 0.16) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '63px',
            left: '360px',
            width: '650px',
            height: '650px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.14) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* 左カラム */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '500px',
            height: '100%',
            padding: '72px 0px',
          }}
        >
          {/* チャンネルアイコン + 名前 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {channelImage ? (
              <img
                src={channelImage}
                alt="Channel Icon"
                width={80}
                height={80}
                style={{
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 0 24px rgba(0, 240, 255, 0.25)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #7c3aed 100%)',
                }}
              />
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                width: '380px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: nameFontSize,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-1px',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '12px',
                  color: '#00f0ff',
                  fontWeight: 700,
                  marginTop: '6px',
                  letterSpacing: '2px',
                }}
              >
                VTuber CHANNEL
              </div>
            </div>
          </div>

          {/* 統計バッジ（歌枠数・登録曲数） */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
            {/* 歌枠数 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 240, 255, 0.06)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '14px',
                padding: '14px 28px',
                minWidth: '110px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#00f0ff',
                  lineHeight: 1,
                }}
              >
                {videoCount}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '6px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                歌枠
              </div>
            </div>
            {/* 登録曲数 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 78, 142, 0.06)',
                border: '1px solid rgba(255, 78, 142, 0.2)',
                borderRadius: '14px',
                padding: '14px 28px',
                minWidth: '110px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#ff4e8e',
                  lineHeight: 1,
                }}
              >
                {songCount}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '6px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                }}
              >
                登録曲
              </div>
            </div>
          </div>

          {/* キャッチコピー */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.4,
                letterSpacing: '-0.5px',
              }}
            >
              歌枠から、歌だけ連続再生。
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.4)',
                fontWeight: 500,
                lineHeight: 1.5,
                marginTop: '10px',
              }}
            >
              聴きたい曲をすぐ再生。お気に入りをプレイリストにまとめよう。
            </div>
          </div>

          {/* V-uta アイコン ＆ アプリ名 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {iconData ? (
              <img
                src={iconData}
                alt="V-uta"
                width={48}
                height={48}
                style={{
                  borderRadius: '10px',
                  boxShadow: '0 0 16px rgba(0, 240, 255, 0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #7c3aed 100%)',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '28px',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}
              >
                V-uta
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontWeight: 500,
                  marginTop: '3px',
                  letterSpacing: '0.5px',
                }}
              >
                v-uta.app
              </div>
            </div>
          </div>
        </div>

        {/* 右カラム: プレイヤーUIデモ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '420px',
            height: '100%',
            padding: '60px 0px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '380px',
              height: '460px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '28px',
              padding: '28px',
            }}
          >
            {/* アルバムアート */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '170px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ff4e8e 100%)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 1024 1024" fill="none">
                  <path
                    d="M318.5 547.5L168.4 194.2H336.8L426.9 414.8L511.2 633.8L519.7 624.1L630.3 336.6L683.9 197.7H854.2L857.4 194.2L582.5 832.1H444L318.5 547.5Z"
                    fill="#00f0ff"
                  />
                </svg>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: '#ff4e8e',
                  borderRadius: '6px',
                  padding: '3px 8px',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px' }}>
                  NOW PLAYING
                </span>
              </div>
            </div>

            {/* 楽曲タイトル */}
            <div style={{ display: 'flex', fontSize: '22px', fontWeight: 700, color: '#ffffff', marginTop: '20px', lineHeight: 1.3 }}>
              Singing Stream
            </div>
            {/* チャンネル名 */}
            <div style={{ display: 'flex', fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px', fontWeight: 500 }}>
              {displayName}
            </div>

            {/* イコライザー */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '24px',
                width: '100%',
                marginTop: '24px',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', width: '4px', height: '8px', backgroundColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '14px', backgroundColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '20px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '12px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '18px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '6px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '14px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '22px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '12px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              <div style={{ display: 'flex', width: '4px', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
            </div>

            {/* シークバー */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: '53%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #00f0ff, #7c3aed)',
                  borderRadius: '2px',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  position: 'absolute',
                  left: '52%',
                  top: '-4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                }}
              />
            </div>

            {/* 時間表示 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                fontWeight: 500,
              }}
            >
              <span>02:15</span>
              <span>04:12</span>
            </div>

            {/* コントロールボタン */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '24px',
                marginTop: '16px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6V18M18 6L11 12L18 18V6Z" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M8 5V19L19 12L8 5Z" fill="#070709" />
                </svg>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6V18M6 6L13 12L6 18V6Z" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'Noto Sans JP', data: fontData, style: 'normal', weight: 500 }]
        : undefined,
    }
  );
}
