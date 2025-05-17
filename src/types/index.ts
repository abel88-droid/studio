
export interface FeedChannelInfo {
  discordChannel: string;
  name: string;
}

export interface FeedData {
  [channelId: string]: FeedChannelInfo;
}

export interface DisplayFeedItem {
  channelId: string;
  url: string;
  name: string;
  discordChannel: string; // Added discordChannel
}
