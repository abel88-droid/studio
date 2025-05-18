
'use server';

import type { FeedData, FeedChannelInfo, DisplayFeedItem } from '@/types';
import { getRepoFileContent, updateRepoFileContent } from './github-service';

// Helper function to extract channel ID from a standard feed URL
function extractChannelIdFromXmlFeedUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.toLowerCase().includes('youtube.com') && parsedUrl.pathname.toLowerCase() === '/feeds/videos.xml') {
      return parsedUrl.searchParams.get('channel_id');
    }
  } catch (e) { /* Invalid URL */ }
  return null;
}

// Helper function to construct the standard XML feed URL
function constructFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

// New helper function to fetch channel details from a YouTube page URL
async function fetchChannelDetailsFromPage(pageUrl: string): Promise<{ channelId: string; channelName?: string } | null> {
  const normalizedPageUrl = pageUrl.toLowerCase().startsWith('http') ? pageUrl : `https://${pageUrl}`;

  try {
    const response = await fetch(normalizedPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch YouTube page ${normalizedPageUrl}: ${response.status}`);
      return null;
    }
    const html = await response.text();

    let channelId: string | null = null;
    let channelName: string | undefined = undefined;
    let match;

    // --- Channel ID Extraction (ordered by presumed reliability) ---
    // 1. Canonical link tag
    match = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})">/);
    if (match && match[1]) {
      channelId = match[1];
    }
    // 2. Meta property og:url
    if (!channelId) {
      match = html.match(/<meta\s+property="og:url"\s+content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})">/);
      if (match && match[1]) channelId = match[1];
    }
    // 3. "externalId" in JSON script data
    if (!channelId) {
      match = html.match(/"externalId":"(UC[\w-]{22})"/);
      if (match && match[1]) channelId = match[1];
    }
    // 4. "channelId" in JSON script data (more generic)
    if (!channelId) {
        match = html.match(/"channelId":"(UC[\w-]{22})"/);
        if (match && match[1]) channelId = match[1];
    }
    // 5. Fallback: browseId (can be less reliable)
    if (!channelId) {
      match = html.match(/"browseId":"(UC[\w-]{22})"/);
      if (match && match[1]) {
        const titleMatchForBrowseId = html.match(/<title>[^<]*channel[^<]*<\/title>/i);
        const isDirectChannelUrl = normalizedPageUrl.includes('/channel/UC');
        if (titleMatchForBrowseId || isDirectChannelUrl) {
             channelId = match[1];
        }
      }
    }
    
    // --- Channel Name Extraction (if ID was found) ---
    if (channelId) {
      match = html.match(/<meta\s+property="og:title"\s+content="([^"]+)">/);
      if (match && match[1]) {
        channelName = match[1].trim();
      } else {
        match = html.match(/<title>([^<]+)\s*-\s*YouTube<\/title>/i); 
        if (match && match[1]) {
          channelName = match[1].trim();
        }
      }
    }

    if (channelId) {
      return { channelId, channelName };
    }

    console.warn(`Could not extract channel ID from HTML of ${normalizedPageUrl} using common patterns.`);
    return null;
  } catch (error) {
    console.error(`Error fetching or parsing YouTube page URL ${normalizedPageUrl}:`, error);
    return null;
  }
}


async function readFeedDataFromGitHub(): Promise<{ data: FeedData; sha: string | null }> {
  try {
    const { data, sha } = await getRepoFileContent();
    return { data, sha };
  } catch (error) {
    console.error('Failed to read feed data from GitHub:', error);
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
    return rawContent;
  } catch (error) {
    console.error('Failed to get raw JSON from GitHub:', error);
    return "{}";
  }
}

export async function addFeed(userInputUrl: string): Promise<{ success: boolean; message?: string; newFeedItem?: DisplayFeedItem }> {
  const trimmedUrl = userInputUrl.trim();
  if (!trimmedUrl) {
    return { success: false, message: 'URL cannot be empty.' };
  }

  let channelId: string | null = null;
  let finalFeedUrl: string = '';
  let fetchedChannelName: string | undefined = undefined;

  channelId = extractChannelIdFromXmlFeedUrl(trimmedUrl);
  if (channelId) {
    finalFeedUrl = trimmedUrl;
  } else {
    let urlToFetch = trimmedUrl;
    const lowerUrl = trimmedUrl.toLowerCase();

    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      if (lowerUrl.startsWith('@')) { // @handle
        urlToFetch = `https://www.youtube.com/${trimmedUrl}`;
      } else if (lowerUrl.includes('youtube.com/')) { // youtube.com/@handle or www.youtube.com/c/name
        urlToFetch = `https://${trimmedUrl.substring(lowerUrl.indexOf('youtube.com/'))}`;
      } else if (lowerUrl.startsWith('com/@')) { // com/@handle -> youtube.com/@handle
        urlToFetch = `https://www.youtube.${trimmedUrl}`;
      } else if (trimmedUrl.startsWith('/')) { // /@handle or /c/name
        urlToFetch = `https://www.youtube.com${trimmedUrl}`;
      } else if (/^UC[\w-]{22}$/.test(trimmedUrl)) { // Raw UCxxxx ID
        urlToFetch = `https://www.youtube.com/channel/${trimmedUrl}`;
      }
      // If still no http(s), fetchChannelDetailsFromPage will prepend https://
    }
    
    const details = await fetchChannelDetailsFromPage(urlToFetch);
    if (details && details.channelId) {
      channelId = details.channelId;
      finalFeedUrl = constructFeedUrl(channelId);
      fetchedChannelName = details.channelName;
    } else {
      return { success: false, message: 'Could not extract Channel ID. Please check the URL or try a different format (e.g., youtube.com/@handle or a direct feed URL).' };
    }
  }

  if (!channelId) {
    // This case should ideally be caught by the logic above.
    return { success: false, message: 'Could not determine YouTube Channel ID from the URL.' };
  }

  const { data: currentData, sha } = await readFeedDataFromGitHub();
  if (currentData[channelId]) {
    return { success: false, message: `Feed for channel ID ${channelId} already exists.` };
  }

  const newChannelName = fetchedChannelName || "New Channel (edit name)";
  const defaultDiscordChannel = "0"; // Default to a placeholder raw ID

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
      url: finalFeedUrl,
      name: newChannelName,
      discordChannel: defaultDiscordChannel,
    }
  };
}

export async function deleteFeeds(urlsToDelete: string[]): Promise<{ success: boolean; message?: string }> {
  const { data: currentData, sha } = await readFeedDataFromGitHub();
  let changed = false;
  const deletedChannelNames: string[] = [];

  for (const url of urlsToDelete) {
    const channelId = extractChannelIdFromXmlFeedUrl(url);
    if (channelId && currentData[channelId]) {
      deletedChannelNames.push(currentData[channelId].name);
      delete currentData[channelId];
      changed = true;
    } else {
        console.warn(`Could not find or extract channel ID for deletion from URL: ${url}`);
    }
  }

  if (changed) {
    const commitMessage = `feat: Delete YouTube feed(s): ${deletedChannelNames.join(', ') || urlsToDelete.length + ' item(s)'}`;
    const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);
     if (!writeResult.success) {
      return { success: false, message: writeResult.message || 'Failed to save deletions to repository.' };
    }
  } else if (urlsToDelete.length > 0) {
    return { success: false, message: "No matching feeds found for deletion, or URLs were invalid."}
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
      if (!/^UC[\w-]{22}$/.test(key)) {
         return { success: false, message: `Invalid key format: "${key}". Key must be a valid YouTube Channel ID.` };
      }
      const entry = parsedData[key] as FeedChannelInfo;
      if (typeof entry !== 'object' || entry === null ||
          typeof entry.name !== 'string' ||
          typeof entry.discordChannel !== 'string') { // discordChannel is raw ID string
        return { success: false, message: `Invalid structure for channel ID "${key}". Each entry must be an object with "name" (string) and "discordChannel" (string ID).` };
      }
      // Validate discordChannel is a numeric string if needed, e.g. /^\d+$/.test(entry.discordChannel)
      if (!/^\d+$/.test(entry.discordChannel) && entry.discordChannel !== "0") { // "0" for default/unset
         return { success: false, message: `Invalid discordChannel for channel ID "${key}". Must be a numeric string.` };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON content. Could not parse.';
    return { success: false, message: errorMessage };
  }
  
  const { sha: currentSha } = await readFeedDataFromGitHub();
  const commitMessage = 'feat: Update feed.json content via raw editor';
  const writeResult = await writeFeedDataToGitHub(parsedData, currentSha, commitMessage);

  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save updated JSON to repository.' };
  }
  return { success: true };
}

export async function updateFeedDiscordChannel(channelId: string, newDiscordChannelInput: string): Promise<{ success: boolean; message?: string; updatedFeedItem?: DisplayFeedItem }> {
  if (!channelId || typeof newDiscordChannelInput !== 'string') {
    return { success: false, message: 'Invalid input for updating Discord channel.' };
  }
  if (!/^UC[\w-]{22}$/.test(channelId)) {
    return { success: false, message: `Invalid Channel ID format for update: "${channelId}".` };
  }

  const discordChannelPattern = /^#([a-zA-Z0-9_-]+)-(\d{17,19})$/;
  const trimmedInput = newDiscordChannelInput.trim();
  const match = trimmedInput.match(discordChannelPattern);

  let extractedDiscordId: string;

  if (trimmedInput === "0" || /^\d{17,19}$/.test(trimmedInput)) {
    // Allow direct input of raw ID or "0"
    extractedDiscordId = trimmedInput;
  } else if (match) {
    extractedDiscordId = match[2];
  } else {
    return { success: false, message: 'Invalid Discord channel format. Expected #name-ID (e.g., #general-1234567890123456789) or a raw numeric ID.' };
  }

  const { data: currentData, sha } = await readFeedDataFromGitHub();
  if (!currentData[channelId]) {
    return { success: false, message: 'Feed not found for the given channel ID.' };
  }

  const oldChannelName = currentData[channelId].name;
  currentData[channelId].discordChannel = extractedDiscordId; // Save the extracted raw ID

  const commitMessage = `feat: Update Discord channel for ${oldChannelName} (ID: ${channelId})`;
  const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);

  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save Discord channel update to repository.' };
  }

  const updatedFeedItem: DisplayFeedItem = {
    channelId,
    url: constructFeedUrl(channelId),
    name: currentData[channelId].name,
    discordChannel: extractedDiscordId, // Return the raw ID
  };
  return { success: true, updatedFeedItem };
}

