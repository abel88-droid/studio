
'use server';

import fs from 'fs/promises';
import path from 'path';
import type { FeedData, FeedChannelInfo, DisplayFeedItem } from '@/types';
import { simplifyFeeds as callSimplifyFeedsAI, type SimplifyFeedsOutput } from '@/ai/flows/simplify-feeds';

const feedFilePath = path.join(process.cwd(), 'feed.json');

function extractChannelIdFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'www.youtube.com' && parsedUrl.pathname === '/feeds/videos.xml') {
      return parsedUrl.searchParams.get('channel_id');
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}

function constructFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

async function readFeedFile(): Promise<FeedData> {
  try {
    const data = await fs.readFile(feedFilePath, 'utf-8');
    const jsonData = JSON.parse(data) as FeedData;
    if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
        for (const key in jsonData) {
            if (typeof jsonData[key] !== 'object' || jsonData[key] === null ||
                typeof (jsonData[key] as FeedChannelInfo).name !== 'string' ||
                typeof (jsonData[key] as FeedChannelInfo).discordChannel !== 'string') {
                console.warn('Invalid channel entry in feed.json, returning empty data.');
                return {};
            }
        }
        return jsonData;
    }
    console.warn('feed.json is not in the expected object format, returning empty data.');
    return {};
  } catch (error) {
    return {};
  }
}

async function writeFeedFile(data: FeedData): Promise<void> {
  try {
    await fs.writeFile(feedFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing feed.json:', error);
    throw new Error('Failed to update feed data.');
  }
}

export async function getFeeds(): Promise<DisplayFeedItem[]> {
  const data = await readFeedFile();
  return Object.entries(data).map(([channelId, info]) => ({
    channelId,
    url: constructFeedUrl(channelId),
    name: info.name,
  }));
}

export async function getRawJson(): Promise<string> {
  try {
    const data = await fs.readFile(feedFilePath, 'utf-8');
    JSON.parse(data); 
    if (data.trim() === "") return "{}";
    return data;
  } catch (error) {
    return "{}";
  }
}

export async function addFeed(url: string): Promise<{ success: boolean; message?: string; newFeedItem?: DisplayFeedItem }> {
  if (!url.startsWith('https://www.youtube.com/feeds/videos.xml?')) {
    return { success: false, message: 'Invalid YouTube feed URL format.' };
  }
  const channelId = extractChannelIdFromUrl(url);
  if (!channelId) {
    return { success: false, message: 'Could not extract channel ID from URL.' };
  }

  const currentData = await readFeedFile();
  if (currentData[channelId]) {
    return { success: false, message: 'Feed for this channel ID already exists.' };
  }

  const newChannelName = "New Channel (please edit)";
  currentData[channelId] = {
    name: newChannelName,
    discordChannel: "default_discord_id" 
  };

  await writeFeedFile(currentData);
  return { success: true, newFeedItem: { channelId, url, name: newChannelName } };
}

export async function deleteFeeds(urlsToDelete: string[]): Promise<{ success: boolean; message?: string }> {
  const currentData = await readFeedFile();
  let changed = false;
  for (const url of urlsToDelete) {
    const channelId = extractChannelIdFromUrl(url);
    if (channelId && currentData[channelId]) {
      delete currentData[channelId];
      changed = true;
    }
  }
  if (changed) {
    await writeFeedFile(currentData);
  }
  return { success: true };
}

export async function updateRawJson(jsonContent: string): Promise<{ success: boolean; message?: string }> {
  try {
    const parsedData = JSON.parse(jsonContent);
    if (typeof parsedData !== 'object' || parsedData === null || Array.isArray(parsedData)) {
      return { success: false, message: 'Invalid JSON structure. Must be an object.' };
    }
    for (const key in parsedData) {
        if (typeof parsedData[key] !== 'object' || parsedData[key] === null ||
            typeof (parsedData[key] as FeedChannelInfo).name !== 'string' ||
            typeof (parsedData[key] as FeedChannelInfo).discordChannel !== 'string') {
        return { success: false, message: `Invalid structure for channel ID "${key}". Each entry must be an object with "name" and "discordChannel" strings.` };
        }
    }
    await writeFeedFile(parsedData as FeedData);
    return { success: true };
  } catch (error) {
    console.error('Error updating raw JSON:', error);
    return { success: false, message: 'Invalid JSON content. Could not parse.' };
  }
}

export async function simplifyFeeds(feedUrls: string[]): Promise<SimplifyFeedsOutput> {
  if (!feedUrls || feedUrls.length === 0) {
    return { suggestions: ['No feed URLs provided to simplify.'] };
  }
  try {
    const result = await callSimplifyFeedsAI({ feedUrls });
    return result;
  } catch (error) {
    console.error('Error simplifying feeds:', error);
    return { suggestions: ['An error occurred while simplifying feeds.'] };
  }
}
