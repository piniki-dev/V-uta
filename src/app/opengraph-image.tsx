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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Noto Sans JP, sans-serif',
        }}
      >
        {/* Deep Mesh Gradients */}
        <div
          style={{
            position: 'absolute',
            top: '-25%',
            left: '-10%',
            width: '801px',
            height: '801px',
            background: 'radial-gradient(circle, hsla(339, 100%, 65%, 0.25) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-25%',
            right: '-10%',
            width: '901px',
            height: '901px',
            background: 'radial-gradient(circle, hsla(271, 91%, 65%, 0.25) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Decorative Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Central Content Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '60px 100px',
            borderRadius: '48px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Logo Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '32px' }}>
            {iconData ? (
              <img
                src={iconData}
                alt="Icon"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '24px',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  background: 'linear-gradient(135deg, #ff4e8e 0%, #7c3aed 100%)',
                  borderRadius: '24px',
                }}
              />
            )}
            <div
              style={{
                fontSize: '110px',
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-4px',
                textShadow: '0 10px 20px rgba(0,0,0,0.3)',
              }}
            >
              V-uta
            </div>
          </div>

          <div
            style={{
              fontSize: '36px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 500,
              letterSpacing: '0.5px',
              textAlign: 'center',
            }}
          >
            VTuber の歌枠を、もっと手軽に。
          </div>
          
          <div
            style={{
              marginTop: '40px',
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.3)',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Premium Fan-made Player
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '48px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '24px', fontWeight: 600 }}>v-uta.app</div>
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
