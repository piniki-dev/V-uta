-- チャンネル内の楽曲からランダムな曲IDのリストを取得する関数
create or replace function get_random_song_ids_by_channel(
  p_channel_record_id bigint,
  p_exclude_ids bigint[],
  p_limit int
)
returns table(song_id bigint)
language sql
as $$
  select s.id
  from songs s
  join videos v on s.video_id = v.id
  where v.channel_record_id = p_channel_record_id
    and s.is_active = true
    and not (s.id = any(p_exclude_ids))
  order by random()
  limit p_limit;
$$;

-- dummy comment to trigger migration filter on retry
