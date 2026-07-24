/**
 * InnerTube API を用いて YouTube 動画のコラボレーター（共演チャンネル）情報を自動抽出するモジュール
 */

export interface CollaboratorChannelInfo {
  ytChannelId: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
}

interface InnerTubeListItem {
  listItemViewModel?: {
    title?: {
      content?: string;
      commandRuns?: Array<{
        onTap?: {
          innertubeCommand?: {
            browseEndpoint?: {
              browseId?: string;
              canonicalBaseUrl?: string;
            };
          };
        };
      }>;
    };
    subtitle?: {
      content?: string;
    };
    leadingImage?: {
      sources?: Array<{ url: string }>;
    };
  };
}

/**
 * YouTube InnerTube `/next` API を呼び出し、動画のコラボレーター情報を取得する
 */
export async function fetchCollaboratorChannels(videoId: string): Promise<CollaboratorChannelInfo[]> {
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20260715.04.00',
            hl: 'ja',
            gl: 'JP',
          },
        },
        videoId,
      }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(`[InnerTube] Response not OK: ${response.status}`);
      return [];
    }

    const rawText = await response.text();
    return parseCollaboratorsFromInnerTubeResponse(rawText);
  } catch (err) {
    console.error('[InnerTube] Failed to fetch collaborator channels:', err);
    return [];
  }
}

/**
 * InnerTube API のレスポンス (JSON文字列) からコラボレーターチャンネル情報を抽出する
 */
export function parseCollaboratorsFromInnerTubeResponse(rawJsonText: string): CollaboratorChannelInfo[] {
  const results: CollaboratorChannelInfo[] = [];
  const seenIds = new Set<string>();

  try {
    const data = JSON.parse(rawJsonText);

    // 1. レスポンス内を検索し、listItemViewModel から browseEndpoint を含むものを探し出す
    // ytInitialData / InnerTube /next の構造を再帰的または特定のセクションから抽出

    // コラボレーターのモーダルダイアログ (avatarStackViewModel -> dialogViewModel -> listViewModel -> listItems)
    // リクエストデータから "browseId": "UC..." と "content": "チャンネル名" を併せ持つアイテムを走査
    extractFromObject(data, results, seenIds);
  } catch (e) {
    console.error('[InnerTube] Error parsing JSON response:', e);
  }

  return results;
}

function extractFromObject(obj: unknown, results: CollaboratorChannelInfo[], seenIds: Set<string>, keyName = ''): void {
  if (!obj || typeof obj !== 'object') return;

  // 関連動画リスト (secondaryResults) は対象動画のコラボ者ではないため探索から除外
  if (keyName === 'secondaryResults') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractFromObject(item, results, seenIds, keyName);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  // avatarStackViewModel の親コンテキスト、または listItemViewModel
  if (record.listItemViewModel && typeof record.listItemViewModel === 'object') {
    const item = record as InnerTubeListItem;
    const vm = item.listItemViewModel;

    const titleObj = vm?.title;
    const titleText = titleObj?.content;
    const commandRuns = titleObj?.commandRuns || [];

    let browseId: string | undefined;
    let canonicalBaseUrl: string | undefined;

    for (const run of commandRuns) {
      const endpoint = run.onTap?.innertubeCommand?.browseEndpoint;
      if (endpoint?.browseId) {
        browseId = endpoint.browseId;
        canonicalBaseUrl = endpoint.canonicalBaseUrl;
        break;
      }
    }

    if (browseId && browseId.startsWith('UC') && titleText && !seenIds.has(browseId)) {
      seenIds.add(browseId);

      // ハンドル名の抽出 (@... パターン)
      let handle: string | undefined;
      const subtitleText = vm?.subtitle?.content || '';
      const handleMatch = subtitleText.match(/@([a-zA-Z0-9._-]+)/) || (canonicalBaseUrl?.match(/@([a-zA-Z0-9._-]+)/));
      if (handleMatch) {
        handle = `@${handleMatch[1]}`;
      }

      // アバター画像の柔軟な抽出
      let avatarUrl: string | undefined;
      const leadingSources = vm?.leadingImage?.sources || (vm as Record<string, unknown> & { leadingImage?: { thumbnailViewModel?: { image?: { sources?: Array<{ url: string }> } } } })?.leadingImage?.thumbnailViewModel?.image?.sources;
      if (Array.isArray(leadingSources) && leadingSources.length > 0) {
        avatarUrl = leadingSources[leadingSources.length - 1]?.url || leadingSources[0]?.url;
      }
      if (!avatarUrl) {
        // 全体のネスト内から https://yt3.ggpht.com を探す
        const match = JSON.stringify(vm).match(/https:\/\/yt3\.(?:ggpht|googleusercontent)\.com\/[a-zA-Z0-9_\-=/]+/);
        if (match) {
          avatarUrl = match[0];
        }
      }

      results.push({
        ytChannelId: browseId,
        name: titleText.trim(),
        handle,
        avatarUrl,
      });
    }
  }

  // 子プロパティを再帰検索
  for (const key of Object.keys(record)) {
    // 高速化のため巨大なトークン配列などはスキップ可能だが、JSONツリーを安全に探索
    if (key !== 'trackingParams' && key !== 'clickTrackingParams' && key !== 'secondaryResults') {
      extractFromObject(record[key], results, seenIds, key);
    }
  }
}
