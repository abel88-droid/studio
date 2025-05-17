
export interface FeedChannelInfo {
  discordChannel: string;
  name: string;
}

export interface FeedData {
  [channelId: string]: FeedChannelInfo;
}

export interface FeedSimplificationSuggestion {
  id: string; // Or some unique identifier
  suggestion: string;
}
