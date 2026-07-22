import { describe, it, expect } from 'vitest';
import { parseCollaboratorsFromInnerTubeResponse } from '@/lib/youtube-collab';

describe('YouTube Collaborator Parser', () => {
  it('should correctly parse collaborator channels from InnerTube mock JSON', () => {
    const mockJson = {
      contents: {
        twoColumnWatchNextResults: {
          results: {
            results: {
              contents: [
                {
                  videoSecondaryInfoRenderer: {
                    owner: {
                      videoOwnerRenderer: {
                        avatarStackViewModel: {
                          attributedTitle: {
                            content: "Naco Ch. 成瀬なこ + 2 チャンネル"
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      frameworkUpdates: {},
      dialogViewModel: {
        customContent: {
          listViewModel: {
            listItems: [
              {
                listItemViewModel: {
                  title: {
                    content: "Naco Ch. 成瀬なこ",
                    commandRuns: [
                      {
                        startIndex: 0,
                        length: 13,
                        onTap: {
                          innertubeCommand: {
                            browseEndpoint: {
                              browseId: "UCzqQYhCoGsQhzUjtFjppW1Q",
                              canonicalBaseUrl: "/channel/UCzqQYhCoGsQhzUjtFjppW1Q"
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              },
              {
                listItemViewModel: {
                  title: {
                    content: "みのるちねる【みのる】",
                    commandRuns: [
                      {
                        startIndex: 0,
                        length: 15,
                        onTap: {
                          innertubeCommand: {
                            browseEndpoint: {
                              browseId: "UCq4urABC8bl-2uXOzBN1GCA",
                              canonicalBaseUrl: "/channel/UCq4urABC8bl-2uXOzBN1GCA"
                            }
                          }
                        }
                      }
                    ]
                  },
                  subtitle: {
                    content: "・@minoruKU100・チャンネル登録者数 16.4万人"
                  }
                }
              },
              {
                listItemViewModel: {
                  title: {
                    content: "Toiki Ch. 夜想といき",
                    commandRuns: [
                      {
                        startIndex: 0,
                        length: 15,
                        onTap: {
                          innertubeCommand: {
                            browseEndpoint: {
                              browseId: "UCNj88lUpk9fyzQydjbsuzRw",
                              canonicalBaseUrl: "/channel/UCNj88lUpk9fyzQydjbsuzRw"
                            }
                          }
                        }
                      }
                    ]
                  },
                  subtitle: {
                    content: "・@yasou_toiki・チャンネル登録者数 7.45万人"
                  }
                }
              }
            ]
          }
        }
      }
    };

    const collaborators = parseCollaboratorsFromInnerTubeResponse(JSON.stringify(mockJson));

    expect(collaborators).toHaveLength(3);
    expect(collaborators[0]).toEqual({
      ytChannelId: "UCzqQYhCoGsQhzUjtFjppW1Q",
      name: "Naco Ch. 成瀬なこ",
      handle: undefined,
      avatarUrl: undefined,
    });
    expect(collaborators[1]).toEqual({
      ytChannelId: "UCq4urABC8bl-2uXOzBN1GCA",
      name: "みのるちねる【みのる】",
      handle: "@minoruKU100",
      avatarUrl: undefined,
    });
    expect(collaborators[2]).toEqual({
      ytChannelId: "UCNj88lUpk9fyzQydjbsuzRw",
      name: "Toiki Ch. 夜想といき",
      handle: "@yasou_toiki",
      avatarUrl: undefined,
    });
  });
});
