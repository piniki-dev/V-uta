/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export const alt = 'V-uta | VTuber Karaoke Player';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  // アプリアイコンの読み込み
  let iconData;
  try {
    const iconPath = join(process.cwd(), 'src/app/icon.svg');
    const buffer = await readFile(iconPath);
    iconData = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load icon:', e);
  }

  // フォントの読み込み
  let fontData;
  try {
    const res = await fetch(
      new URL('https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansJP/NotoSansJP-Medium.ttf')
    );
    if (res.ok) {
      fontData = await res.arrayBuffer();
    }
  } catch (e) {
    console.error('Failed to load font:', e);
  }

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
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Noto Sans JP, sans-serif',
          color: '#ffffff',
        }}
      >
        {/* 背景のネオンオーロラグラデーション */}
        {/* 左上のシアン */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        {/* 右下のピンク */}
        <div
          style={{
            position: 'absolute',
            bottom: '-25%',
            right: '-10%',
            width: '700px',
            height: '700px',
            background: 'radial-gradient(circle, rgba(255, 78, 142, 0.16) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        {/* 中央奥 of パープル */}
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '30%',
            width: '650px',
            height: '650px',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.14) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* ドットグリッド背景 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* 左カラム: ブランド・コピー */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '500px',
            height: '100%',
            padding: '80px 0px',
            boxSizing: 'border-box',
            zIndex: 10,
          }}
        >
          {/* 上部: ロゴ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {iconData ? (
              <img
                src={iconData}
                alt="Icon"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '16px',
                  boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #7c3aed 100%)',
                  borderRadius: '16px',
                  boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
                }}
              />
            )}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-2px',
              }}
            >
              V-uta
            </div>
          </div>

          {/* 中部: キャッチコピー */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.4,
                letterSpacing: '-0.5px',
              }}
            >
              だれでも登録、歌だけ連続再生。
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#00f0ff',
                lineHeight: 1.4,
                letterSpacing: '-0.5px',
                marginTop: '4px',
              }}
            >
              VTuberの歌枠専用プレイヤー
            </div>
            <div
              style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.4)',
                fontWeight: 500,
                lineHeight: 1.5,
                marginTop: '16px',
              }}
            >
              YouTubeの歌枠から歌だけを連続再生。お気に入りの歌枠を登録して、プレイリストで楽しもう！
            </div>
          </div>

          {/* 下部: ドメインバッジ */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '99px',
              padding: '6px 18px',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              v-uta.app
            </span>
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
            boxSizing: 'border-box',
            zIndex: 10,
          }}
        >
          {/* ガラスモーフィズムカード */}
          <div
            style={{
              width: '380px',
              height: '460px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '28px',
              padding: '28px',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              boxSizing: 'border-box',
            }}
          >
            {/* アートワークプレースホルダー */}
            <div
              style={{
                width: '100%',
                height: '170px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ff4e8e 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
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
                {/* ミニVロゴ */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 1024 1024"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M318.5 547.5L168.4 194.2H336.8L426.9 414.8L511.2 633.8L519.7 624.1L630.3 336.6L683.9 197.7H854.2L857.4 194.2L582.5 832.1H444L318.5 547.5Z"
                    fill="#00f0ff"
                  />
                </svg>
              </div>
              {/* 右上のLIVEバッジ */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: '#ff4e8e',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px' }}>NOW PLAYING</span>
              </div>
            </div>

            {/* 楽曲タイトル */}
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#ffffff',
                marginTop: '20px',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              VTuber Singing Stream
            </div>
            {/* チャンネル名 */}
            <div
              style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px',
                lineHeight: 1.2,
                fontWeight: 500,
              }}
            >
              Virtual Singer
            </div>

            {/* 再生プログレスバーと波形 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: '24px',
                width: '100%',
              }}
            >
              {/* 波形イコライザー */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  height: '24px',
                  width: '100%',
                  marginBottom: '8px',
                  opacity: 0.8,
                }}
              >
                {/* 15本の細いイコライザーバー */}
                <div style={{ width: '4px', height: '8px', backgroundColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '14px', backgroundColor: 'rgba(0, 240, 255, 0.4)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '20px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '12px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '18px', backgroundColor: '#00f0ff', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '6px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '14px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '22px', backgroundColor: '#7c3aed', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '10px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '12px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
                <div style={{ width: '4px', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '2px' }} />
              </div>

              {/* シークバー */}
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  position: 'relative',
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    width: '53%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #00f0ff, #7c3aed)',
                    borderRadius: '2px',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '52%',
                    top: '-4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 10px rgba(0, 240, 255, 0.8)',
                  }}
                />
              </div>
              
              {/* 時間 */}
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
              {/* 戻るボタン */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6V18M18 6L11 12L18 18V6Z" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {/* 再生ボタン */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '2px' }}>
                  <path d="M8 5V19L19 12L8 5Z" fill="#070709" />
                </svg>
              </div>
              {/* 進むボタン */}
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
      fonts: fontData ? [
        {
          name: 'Noto Sans JP',
          data: fontData,
          style: 'normal',
          weight: 500,
        }
      ] : undefined,
    }
  );
}
