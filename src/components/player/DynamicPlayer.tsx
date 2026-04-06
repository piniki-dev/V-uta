'use client';

import dynamic from 'next/dynamic';

const MiniPlayer = dynamic(() => import("./MiniPlayer"), { ssr: false });
const FullPlayer = dynamic(() => import("./FullPlayer"), { ssr: false });
const PersistentPlayer = dynamic(() => import("./PersistentPlayer"), { ssr: false });

export default function DynamicPlayer() {
  return (
    <>
      <MiniPlayer />
      <FullPlayer />
      <PersistentPlayer />
    </>
  );
}
