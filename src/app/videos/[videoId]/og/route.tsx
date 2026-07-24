/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Song, MasterSong } from '@/types';

export const runtime = 'nodejs';

const size = {
  width: 1200,
  height: 630,
};

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track');
  const trackNum = track ? parseInt(track) : null;
  
  // アプリアイコンの読み込み
  let iconData;
  try {
    const iconPath = join(process.cwd(), 'src/app/icon.svg');
    const buffer = await readFile(iconPath);
    iconData = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load icon:', e);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  // 動画情報の取得（チャンネルアイコン用の情報 image も channels から取得）
  const { data: videoRecord, error: videoError } = await supabase
    .from('videos')
    .select('*, video_channels(is_original, channel:channels(*))')
    .eq('video_id', videoId)
    .single();

  if (videoError || !videoRecord) {
    return new Response('Video Not Found', { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origVc = (videoRecord.video_channels as any[])?.find((vc: any) => vc.is_original);
  const video = {
    ...videoRecord,
    channel: origVc?.channel || null,
  };

  // 登録曲リストを取得（動画IDに紐づくすべての有効な曲）
  let songInfo = null;
  let songsList: (Song & { master_song: MasterSong | null })[] = [];
  let totalSongsCount = 0;

  const { data: songs } = await supabase
    .from('songs')
    .select('*, master_song:master_songs(*)')
    .eq('video_id', video.id)
    .eq('is_active', true)
    .order('start_sec', { ascending: true });

  if (songs) {
    songsList = songs;
    totalSongsCount = songs.length;
    // 特定トラック指定時の情報をマッピング
    if (trackNum && songs[trackNum - 1]) {
      songInfo = songs[trackNum - 1];
    }
  }

  const title = songInfo ? (songInfo.master_song?.title || "Unknown Song") : video.title;
  const channelName = video.channel?.name || "Unknown VTuber";
  const channelImage = video.channel?.image || ""; // チャンネルアイコン画像
  const youtubeThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const artworkUrl = songInfo?.master_song?.artwork_url || youtubeThumbnail;

  // 配信日のフォーマット (YYYY/MM/DD)
  let publishDateStr = '';
  if (video.published_at) {
    try {
      const d = new Date(video.published_at);
      publishDateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    } catch (e) {
      console.error('Failed to format date:', e);
    }
  }

  // 曲指定時の「曲名2行表示」用の安全弁文字数カット
  let displayTitle = title;
  if (songInfo && title.length > 42) {
    displayTitle = title.slice(0, 41) + '...';
  }

  // 曲名は少し小さめの最大44pxに調整（2行に綺麗に収めるため）
  let titleFontSize = songInfo ? '44px' : '40px';
  if (songInfo) {
    if (title.length > 20) {
      titleFontSize = '32px';
    } else if (title.length > 12) {
      titleFontSize = '38px';
    }
  } else {
    if (title.length > 30) {
      titleFontSize = '32px';
    } else if (title.length > 18) {
      titleFontSize = '36px';
    }
  }

  const rawArtist = songInfo ? (songInfo.master_song?.artist || channelName) : channelName;
  const displayArtist = rawArtist; // アーティスト名のJSカットを全廃し、CSS Ellipsisに完全委任
  
  // アーティスト名のフォントサイズを大きく調整
  let artistFontSize = '34px'; // 28px -> 34px
  if (rawArtist.length > 20) {
    artistFontSize = '26px'; // 22px -> 26px
  } else if (rawArtist.length > 12) {
    artistFontSize = '30px'; // 26px -> 30px
  }

  // 動画タイトルの長さ調整（曲表示 of OGP フッター用）
  let displayVideoTitle = video.title;
  if (video.title.length > 32) {
    displayVideoTitle = video.title.slice(0, 31) + '...';
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
          background: '#070709',
          overflow: 'hidden',
          fontFamily: 'Noto Sans JP, sans-serif',
          color: '#ffffff',
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* 背景のYouTubeサムネイル薄いオーバーレイ */}
        <img
          src={youtubeThumbnail}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.12,
            filter: 'blur(30px)',
          }}
        />

        {/* 背景ネオングロー */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            left: '-60px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%)',
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
            background: 'radial-gradient(circle, rgba(255, 78, 142, 0.12) 0%, transparent 70%)',
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
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {songInfo ? (
          /* =========================================================================
             パターンA: 曲指定時（左右2分割レイアウト・総幅1080px厳守・左右余白対称）
             ========================================================================= */
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '32px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* 左カラム: アートワーク / サムネイル (幅 400px、境界線仕切り) */}
            <div
              style={{
                display: 'flex',
                width: '400px',
                height: '100%',
                position: 'relative',
                backgroundColor: '#000000',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                borderTopLeftRadius: '31px', // 突き抜けバグ防止
                borderBottomLeftRadius: '31px',
                overflow: 'hidden',
              }}
            >
              {/* 背面ぼかし画像 */}
              <img
                src={artworkUrl}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.4,
                  filter: 'blur(16px)',
                  borderTopLeftRadius: '31px',
                  borderBottomLeftRadius: '31px',
                }}
              />
              {/* 前面アスペクト比維持画像 */}
              <img
                src={artworkUrl}
                alt=""
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 2,
                }}
              />
            </div>

            {/* 右カラム: 曲情報領域 (幅 680px 厳守、パディングによるbox-sizing突き抜けを防止) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '680px',
                height: '100%',
                paddingTop: '48px',
                paddingBottom: '48px',
                justifyContent: 'space-between',
                zIndex: 10,
              }}
            >
              {/* 右カラム最上部: NOW PLAYING SONG バッジ ＋ ブランドロゴ（左右余白 48px のため幅584px指定） */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '584px',
                  marginLeft: '48px',
                  marginRight: '48px',
                }}
              >
                {/* バッジ */}
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255, 78, 142, 0.15)',
                    border: '1px solid rgba(255, 78, 142, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 14px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#ff4e8e',
                      letterSpacing: '1px',
                    }}
                  >
                    NOW PLAYING SONG
                  </span>
                </div>

                {/* V-uta ロゴ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {iconData ? (
                    <img
                      src={iconData}
                      alt="V-uta"
                      width={30}
                      height={30}
                      style={{
                        borderRadius: '6px',
                        boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #00f0ff 0%, #7c3aed 100%)',
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                      }}
                    >
                      V-uta
                    </span>
                    <span
                      style={{
                        fontSize: '8px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontWeight: 500,
                        marginTop: '2px',
                      }}
                    >
                      v-uta.app
                    </span>
                  </div>
                </div>
              </div>

              {/* 右カラム中〜下部: 曲詳細コンテナ（左右余白 48px、幅584px） */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '584px',
                  marginLeft: '48px',
                  marginRight: '48px',
                  marginTop: '28px',
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                {/* 歌い手 VTuber ヘッダー（アイコン: 44x44, フォント: 26px） */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    width: '100%',
                  }}
                >
                  {channelImage ? (
                    <img
                      src={channelImage}
                      alt=""
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: '1.5px solid rgba(255, 255, 255, 0.2)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1.5px solid rgba(255, 255, 255, 0.2)',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '26px',
                      fontWeight: 700,
                      color: '#00f0ff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '520px',
                    }}
                  >
                    {channelName}
                  </span>
                </div>

                {/* 曲名 (2行表示, titleFontSize: 最大44px, 幅は親コンテナ100%に従う) */}
                <div
                  style={{
                    display: 'block',
                    fontSize: titleFontSize,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.3,
                    letterSpacing: '-1px',
                    marginBottom: '12px',
                    width: '100%',
                    maxHeight: '120px',
                    overflow: 'hidden',
                    whiteSpace: 'normal',
                  }}
                >
                  {displayTitle}
                </div>

                {/* 原曲アーティスト名 (artistFontSize: 34px/30px/26px, 幅は親コンテナ100%に従う) */}
                <div
                  style={{
                    display: 'block',
                    fontSize: artistFontSize,
                    fontWeight: 700,
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: 1.2,
                    marginBottom: '24px',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayArtist}
                </div>

                {/* 元の歌枠タイトル (20px, 幅は親コンテナ100%に従う) */}
                <div
                  style={{
                    display: 'block',
                    fontSize: '20px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontWeight: 500,
                    lineHeight: 1.4,
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`from: ${displayVideoTitle}`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             パターンB: 動画のみ（上下段＋下段左右スプリット・6曲リスト表示）
             ========================================================================= */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '32px',
              overflow: 'hidden',
              position: 'relative',
              paddingTop: '38px',
              paddingBottom: '38px',
              paddingLeft: '44px',
              paddingRight: '44px',
              justifyContent: 'space-between',
            }}
          >
            {/* 上部: カテゴリバッジ ＋ ブランドロゴの横並び */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                zIndex: 10,
              }}
            >
              {/* バッジ */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '4px 14px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#00f0ff',
                    letterSpacing: '1px',
                  }}
                >
                  KARAOKE ARCHIVE
                </span>
              </div>

              {/* V-uta ロゴ (右上) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {iconData ? (
                  <img
                    src={iconData}
                    alt="V-uta"
                    width={30}
                    height={30}
                    style={{
                      borderRadius: '6px',
                      boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #00f0ff 0%, #7c3aed 100%)',
                    }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '-0.5px',
                      lineHeight: 1,
                    }}
                  >
                    V-uta
                  </span>
                  <span
                    style={{
                      fontSize: '8px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontWeight: 500,
                      marginTop: '2px',
                    }}
                  >
                    v-uta.app
                  </span>
                </div>
              </div>
            </div>

            {/* 中部・下部: メイン構成エリア */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                marginTop: '14px',
                width: '100%',
                zIndex: 10,
              }}
            >
              {/* 上段: タイトルとアーティスト名＋配信日（全幅横いっぱい） */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    display: 'block',
                    fontSize: titleFontSize,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.3,
                    letterSpacing: '-1px',
                    marginBottom: '8px',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: '16px',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      maxWidth: publishDateStr ? '780px' : '990px',
                      fontSize: artistFontSize,
                      fontWeight: 700,
                      color: '#00f0ff',
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rawArtist}
                  </span>
                  {publishDateStr && (
                    <span
                      style={{
                        fontSize: '20px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontWeight: 500,
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`• ${publishDateStr}`}
                    </span>
                  )}
                </div>
              </div>

              {/* 下段: セトリ（左）とサムネイル（右）のスプリット */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  flex: 1,
                }}
              >
                {/* Left: Registered Songs (width: 620px) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '620px',
                  }}
                >
                  {songsList.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          fontSize: '13px',
                          color: 'rgba(255, 255, 255, 0.4)',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                          marginBottom: '2px',
                        }}
                      >
                        {`REGISTERED SONGS (${totalSongsCount})`}
                      </div>
                      {/* 表示数を最大6曲に拡大 */}
                      {songsList.slice(0, 6).map((song, index) => {
                        const songTitle = song.master_song?.title || "Unknown Song";
                        const songArtist = song.master_song?.artist || "";
                        const fullSongText = `${songTitle}${songArtist ? ` / ${songArtist}` : ''}`;
                        
                        return (
                          <div
                            key={song.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '26px', // 26pxを維持
                              color: 'rgba(255, 255, 255, 0.95)',
                              fontWeight: 700,
                              lineHeight: 1.2,
                              width: '100%',
                            }}
                          >
                            <span style={{ display: 'flex', color: '#ff4e8e', fontWeight: 900, width: '28px' }}>
                              {index + 1}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                width: '580px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fullSongText}
                            </span>
                          </div>
                        );
                      })}
                      {totalSongsCount > 6 && (
                        <div
                          style={{
                            display: 'flex',
                            fontSize: '16px',
                            color: '#ff4e8e',
                            fontWeight: 700,
                            marginTop: '2px',
                          }}
                        >
                          {`and ${totalSongsCount - 6} more songs...`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Youtube thumbnail (width: 320px) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    width: '320px',
                  }}
                >
                  <img
                    src={artworkUrl}
                    alt=""
                    style={{
                      width: '320px',
                      height: '180px',
                      objectFit: 'cover',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
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
