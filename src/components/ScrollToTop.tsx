'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. 遷移直後に即座にスクロール
    window.scrollTo(0, 0);

    // 2. イベントループの次のタイミングで実行（非同期DOM更新用）
    const timeoutId = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);

    // 3. ブラウザの次の描画フレーム（Paint）の直前に実行し、確実に戻す
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  return null;
}
