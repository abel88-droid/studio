
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

// Enhanced helper function to fetch channel details from a YouTube page URL (channel or video)
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

    // Check if it's a video page URL
    const videoIdRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const isVideoUrl = videoIdRegex.test(normalizedPageUrl);

    if (isVideoUrl) {
      // Attempt to extract channel ID and name from video page
      // Pattern 1: "ownerProfileUrl":"https://www.youtube.com/channel/UC..."
      match = html.match(/"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
      if (match && match[1]) {
        channelId = match[1];
      }
      // Pattern 2: Looking for channelId in script tags (often within ytInitialData or ytInitialPlayerResponse)
      if (!channelId) {
        const scriptMatches = html.matchAll(/<script[^>]*>(.*?)<\/script>/gs);
        for (const scriptMatch of scriptMatches) {
            const scriptContent = scriptMatch[1];
            // Try to find author and their channelId
            const authorChannelMatch = scriptContent.match(/"author":"[^"]+","channelId":"(UC[\w-]{22})"/);
            if (authorChannelMatch && authorChannelMatch[1]) {
                channelId = authorChannelMatch[1];
                // Try to get channel name from the same context if possible
                const authorNameMatch = scriptContent.match(/"author":"([^"]+)","channelId":"\1"/);
                if(authorNameMatch && authorNameMatch[1]) {
                    channelName = authorNameMatch[1];
                }
                break; 
            }
            // Fallback for channelId if specific author structure not found but script seems relevant
            if (!channelId && (scriptContent.includes('ytInitialPlayerResponse') || scriptContent.includes('ytInitialData'))) {
                 const cidMatch = scriptContent.match(/"channelId":"(UC[\w-]{22})"/);
                 if (cidMatch && cidMatch[1]) {
                    // This is less specific, so use with caution, might not be the uploader's
                    // For now, let's prioritize the authorChannelMatch
                 }
            }
        }
      }
      
      // Try to get channel name from meta tags or other distinct parts of video page if not found with ID
      if (channelId && !channelName) {
        const uploaderNameMatch = html.match(/<span itemprop="author"[^>]*><link itemprop="url"[^>]+><meta itemprop="name" content="([^"]+)">/i);
        if (uploaderNameMatch && uploaderNameMatch[1]) {
            channelName = uploaderNameMatch[1].trim();
        } else {
            const ownerChannelNameMatch = html.match(/"ownerChannelName":"([^"]+)"/);
            if (ownerChannelNameMatch && ownerChannelNameMatch[1]) {
                channelName = ownerChannelNameMatch[1].trim();
            }
        }
      }

      if (channelId) {
        // If we got an ID from a video page, we can consider it found.
        // The name might be missing or generic, `addFeed` can decide to re-fetch full details if needed.
        return { channelId, channelName };
      }
      // If video parsing fails, fall through to channel page parsing if applicable, or return null
    }

    // --- Channel ID Extraction (from channel page HTML, ordered by presumed reliability) ---
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
        if (match && match[1]) channelId = match[1]; // Check if this is reliable for channel pages
    }
     // 5. Fallback: browseId (can be less reliable for non-channel pages, but we check URL context)
    if (!channelId && (normalizedPageUrl.includes('/channel/') || normalizedPageUrl.includes('/c/') || normalizedPageUrl.includes('/user/') || normalizedPageUrl.includes('/@'))) {
      match = html.match(/"browseId":"(UC[\w-]{22})"/);
      if (match && match[1]) {
        channelId = match[1];
      }
    }
    
    // --- Channel Name Extraction (if ID was found from channel page) ---
    if (channelId && !channelName) { // only if not already set by video page logic
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
    // If we have a direct feed URL, we might still want to fetch the name if not provided
    // For now, this path assumes the name will be generic or set via JSON editor.
    // To improve: fetch name using the channelId if adding a raw feed URL.
    const channelDetails = await fetchChannelDetailsFromPage(`https://www.youtube.com/channel/${channelId}`);
    if (channelDetails && channelDetails.channelName) {
        fetchedChannelName = channelDetails.channelName;
    }

  } else {
    // Not a direct feed URL, try to parse as a page URL (channel or video)
    const details = await fetchChannelDetailsFromPage(trimmedUrl);
    if (details && details.channelId) {
      channelId = details.channelId;
      finalFeedUrl = constructFeedUrl(channelId);
      fetchedChannelName = details.channelName;
    } else {
      return { success: false, message: 'Could not extract Channel ID. Please check the URL or try a different format (e.g., youtube.com/@handle, video URL, or a direct feed URL).' };
    }
  }

  if (!channelId) {
    return { success: false, message: 'Could not determine YouTube Channel ID from the URL.' };
  }

  const { data: currentData, sha } = await readFeedDataFromGitHub();
  if (currentData[channelId]) {
    return { success: false, message: `Feed for channel ID ${channelId} already exists.` };
  }

  const newChannelName = fetchedChannelName || "New Channel (edit name)";
  const defaultDiscordChannel = "0"; 

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
    return { success: true, message: `${deletedChannelNames.length || urlsToDelete.length} feed(s) successfully deleted.` };
  } else if (urlsToDelete.length > 0) {
    return { success: false, message: "No matching feeds found for deletion, or URLs were invalid."}
  }
  return { success: true, message: "No feeds were selected for deletion or no changes made." }; // Or specific message if urlsToDelete was empty
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
          typeof entry.discordChannel !== 'string') { 
        return { success: false, message: `Invalid structure for channel ID "${key}". Each entry must be an object with "name" (string) and "discordChannel" (string ID).` };
      }
      if (!/^\d+$/.test(entry.discordChannel) && entry.discordChannel !== "0") { 
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
  currentData[channelId].discordChannel = extractedDiscordId; 

  const commitMessage = `feat: Update Discord channel for ${oldChannelName} (ID: ${channelId})`;
  const writeResult = await writeFeedDataToGitHub(currentData, sha, commitMessage);

  if (!writeResult.success) {
    return { success: false, message: writeResult.message || 'Failed to save Discord channel update to repository.' };
  }

  const updatedFeedItem: DisplayFeedItem = {
    channelId,
    url: constructFeedUrl(channelId),
    name: currentData[channelId].name,
    discordChannel: extractedDiscordId, 
  };
  return { success: true, updatedFeedItem };
}
