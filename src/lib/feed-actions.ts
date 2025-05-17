'use server';

import fs from 'fs/promises';
import path from 'path';
import type { FeedData } from '@/types';
import { simplifyFeeds as callSimplifyFeedsAI, type SimplifyFeedsOutput } from '@/ai/flows/simplify-feeds';

const feedFilePath = path.join(process.cwd(), 'public', 'feed.json');

async function readFeedFile(): Promise<FeedData> {
  try {
    const data = await fs.readFile(feedFilePath, 'utf-8');
    const jsonData = JSON.parse(data) as FeedData;
    if (!jsonData.feeds || !Array.isArray(jsonData.feeds)) {
      return { feeds: [] };
    }
    return jsonData;
  } catch (error) {
    // If file doesn't exist or is invalid, return empty feeds
    console.error('Error reading feed.json:', error);
    return { feeds: [] };
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

export async function getFeeds(): Promise<string[]> {
  const data = await readFeedFile();
  return data.feeds;
}

export async function getRawJson(): Promise<string> {
  try {
    const data = await fs.readFile(feedFilePath, 'utf-8');
    return data;
  } catch (error) {
    console.error('Error reading feed.json for raw content:', error);
    return JSON.stringify({ feeds: [] }, null, 2); // Return default structure if error
  }
}

export async function addFeed(url: string): Promise<{ success: boolean; message?: string }> {
  if (!url || !url.startsWith('https://www.youtube.com/feeds/videos.xml?')) {
    return { success: false, message: 'Invalid YouTube feed URL format.' };
  }
  const currentData = await readFeedFile();
  if (currentData.feeds.includes(url)) {
    return { success: false, message: 'Feed URL already exists.' };
  }
  currentData.feeds.push(url);
  await writeFeedFile(currentData);
  return { success: true };
}

export async function deleteFeeds(urlsToDelete: string[]): Promise<{ success: boolean; message?: string }> {
  const currentData = await readFeedFile();
  currentData.feeds = currentData.feeds.filter(feed => !urlsToDelete.includes(feed));
  await writeFeedFile(currentData);
  return { success: true };
}

export async function updateRawJson(jsonContent: string): Promise<{ success: boolean; message?: string }> {
  try {
    const parsedData = JSON.parse(jsonContent) as FeedData;
    if (!parsedData.feeds || !Array.isArray(parsedData.feeds) || !parsedData.feeds.every(item => typeof item === 'string')) {
      return { success: false, message: 'Invalid JSON structure. Must be { "feeds": ["url1", ...] }.' };
    }
    await writeFeedFile(parsedData);
    return { success: true };
  } catch (error) {
    console.error('Error updating raw JSON:', error);
    return { success: false, message: 'Invalid JSON content.' };
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
