
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
                console.warn('Invalid channel entry in feed.json, returning empty data for specific key or all.');
                // Decide if to return {} or filter out invalid entries
                return {}; // Returning empty on any invalid entry for safety
            }
        }
        return jsonData;
    }
    console.warn('feed.json is not in the expected object format, returning empty data.');
    return {};
  } catch (error) {
    console.warn('Error reading or parsing feed.json, returning empty data:', error);
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
    discordChannel: info.discordChannel, // Include discordChannel
  }));
}

export async function getRawJson(): Promise<string> {
  try {
    const data = await fs.readFile(feedFilePath, 'utf-8');
    // Ensure it's valid JSON before returning
    JSON.parse(data); 
    if (data.trim() === "") return "{}"; // Handle empty file case
    return data;
  } catch (error) {
    // If file doesn't exist or is invalid JSON, return an empty object string
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
  const defaultDiscordChannel = "default_discord_id";
  currentData[channelId] = {
    name: newChannelName,
    discordChannel: defaultDiscordChannel 
  };

  await writeFeedFile(currentData);
  return { success: true, newFeedItem: { channelId, url, name: newChannelName, discordChannel: defaultDiscordChannel } };
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
        const entry = parsedData[key] as FeedChannelInfo;
        if (typeof entry !== 'object' || entry === null ||
            typeof entry.name !== 'string' ||
            typeof entry.discordChannel !== 'string') {
        return { success: false, message: `Invalid structure for channel ID "${key}". Each entry must be an object with "name" (string) and "discordChannel" (string).` };
        }
    }
    await writeFeedFile(parsedData as FeedData);
    return { success: true };
  } catch (error) {
    // Check if error is an instance of Error to access message property
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON content. Could not parse.';
    console.error('Error updating raw JSON:', error);
    return { success: false, message: errorMessage };
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

export async function updateFeedDiscordChannel(channelId: string, newDiscordChannelId: string): Promise<{ success: boolean; message?: string; updatedFeedItem?: DisplayFeedItem }> {
  if (!channelId || typeof newDiscordChannelId !== 'string') {
    return { success: false, message: 'Invalid input for updating Discord channel.' };
  }

  const currentData = await readFeedFile();
  if (!currentData[channelId]) {
    return { success: false, message: 'Feed not found for the given channel ID.' };
  }

  currentData[channelId].discordChannel = newDiscordChannelId;

  try {
    await writeFeedFile(currentData);
    const updatedFeedItem: DisplayFeedItem = {
      channelId,
      url: constructFeedUrl(channelId),
      name: currentData[channelId].name,
      discordChannel: newDiscordChannelId,
    };
    return { success: true, updatedFeedItem };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update feed data.';
    return { success: false, message: errorMessage };
  }
}
