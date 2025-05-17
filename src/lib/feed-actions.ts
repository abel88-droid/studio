
'use server';

import type { FeedData, FeedChannelInfo, DisplayFeedItem } from '@/types';
import { getRepoFileContent, updateRepoFileContent } from './github-service';

// Helper function from original file
function extractChannelIdFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'www.youtube.com' && parsedUrl.pathname === '/feeds/videos.xml') {
      return parsedUrl.searchParams.get('channel_id');
    }
  } catch (e) { /* Invalid URL */ }
  return null;
}

function constructFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}


async function readFeedDataFromGitHub(): Promise<{ data: FeedData; sha: string | null }> {
  try {
    const { data, sha } = await getRepoFileContent();
    return { data, sha };
  } catch (error) {
    console.error('Failed to read feed data from GitHub:', error);
    // Return empty data and no SHA if there's an error to prevent app from crashing
    // Components should ideally handle this (e.g. show error message)
    return { data: {}, sha: null };
  }
}

async function writeFeedDataToGitHub(data: FeedData, sha: string | null, commitMessage: string): Promise<{success: boolean, message?:string}> {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    return await updateRepoFileContent(jsonContent, commitMessage, sha);
  } catch (error) {
    console.error('Failed to write feed data to GitHub:', error);
    const message = error instanceof Error ? error.message : 'Failed to update feed data in repository.';
    return {success: false, message};
  }
}

export async function getFeeds(): Promise<DisplayFeedItem[]> {
  const { data } = await readFeedDataFromGitHub();
  return Object.entries(data).map(([channelId, info]) => ({
    channelId,
    url: constructFeedUrl(channelId),
    name: info.name,
    discordChannel: info.discordChannel,
  }));
}

export async function getRawJson(): Promise<string> {
  try {
    const { rawContent } = await getRepoFileContent();
    // Ensure it's valid JSON before returning, or at least not empty if it's supposed to be JSON
    // The github-service already handles parsing and returns "{}" on error/empty
    return rawContent;
  } catch (error) {
    console.error('Failed to get raw JSON from GitHub:', error);
    return "{}"; // Fallback to empty object string
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

  const { data: currentData, sha } = await readFeedDataFromGitHub();
  if (currentData[channelId]) {
    return { success: false, message: 'Feed for this channel ID already exists.' };
  }

  const newChannelName = "New Channel (please edit)";
  const defaultDiscordChannel = "default_discord_id"; // Consider making this configurable or an empty string
  currentData[channelId] = {
    name: newChannelName,
    discordChannel: defaultDiscordChannel,
  };

  const commitMessage = `feat: Add YouTube feed for ${newChannelName} (ID: ${channelId})`;
  const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);
  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save new feed to repository.' };
  }

  return { 
    success: true, 
    newFeedItem: { 
      channelId, 
      url, 
      name: newChannelName, 
      discordChannel: defaultDiscordChannel 
    } 
  };
}

export async function deleteFeeds(urlsToDelete: string[]): Promise<{ success: boolean; message?: string }> {
  const { data: currentData, sha } = await readFeedDataFromGitHub();
  let changed = false;
  const deletedChannelNames: string[] = [];

  for (const url of urlsToDelete) {
    const channelId = extractChannelIdFromUrl(url);
    if (channelId && currentData[channelId]) {
      deletedChannelNames.push(currentData[channelId].name);
      delete currentData[channelId];
      changed = true;
    }
  }

  if (changed) {
    const commitMessage = `feat: Delete YouTube feed(s): ${deletedChannelNames.join(', ') || urlsToDelete.length + ' item(s)'}`;
    const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);
     if (!writeResult.success) {
      return { success: false, message: writeResult.message || 'Failed to save deletions to repository.' };
    }
  }
  return { success: true };
}

export async function updateRawJson(jsonContent: string): Promise<{ success: boolean; message?: string }> {
  let parsedData: FeedData;
  try {
    parsedData = JSON.parse(jsonContent);
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON content. Could not parse.';
    return { success: false, message: errorMessage };
  }
  
  // Fetch current SHA to ensure we are updating the latest version
  const { sha: currentSha } = await readFeedDataFromGitHub();
  const commitMessage = 'feat: Update feed.json content via raw editor';
  const writeResult = await writeFeedDataToGitHub(parsedData, currentSha, commitMessage);

  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save updated JSON to repository.' };
  }
  return { success: true };
}

export async function updateFeedDiscordChannel(channelId: string, newDiscordChannelId: string): Promise<{ success: boolean; message?: string; updatedFeedItem?: DisplayFeedItem }> {
  if (!channelId || typeof newDiscordChannelId !== 'string') {
    return { success: false, message: 'Invalid input for updating Discord channel.' };
  }

  const { data: currentData, sha } = await readFeedDataFromGitHub();
  if (!currentData[channelId]) {
    return { success: false, message: 'Feed not found for the given channel ID.' };
  }

  const oldChannelName = currentData[channelId].name;
  currentData[channelId].discordChannel = newDiscordChannelId;

  const commitMessage = `feat: Update Discord channel for ${oldChannelName} (ID: ${channelId})`;
  const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);

  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save Discord channel update to repository.' };
  }

  const updatedFeedItem: DisplayFeedItem = {
    channelId,
    url: constructFeedUrl(channelId),
    name: currentData[channelId].name,
    discordChannel: newDiscordChannelId,
  };
  return { success: true, updatedFeedItem };
}
