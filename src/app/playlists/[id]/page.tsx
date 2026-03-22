import { getPlaylistDetail } from '../actions';
import PlaylistDetailClient from './PlaylistDetailClient';
import { notFound } from 'next/navigation';

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const result = await getPlaylistDetail(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <PlaylistDetailClient playlist={result.data} />;
}
