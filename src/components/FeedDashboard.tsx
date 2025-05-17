
'use client';

import { useState, useEffect, useCallback } from 'react';
import { addFeed, deleteFeeds, updateRawJson, updateFeedDiscordChannel } from '@/lib/feed-actions';
import { FeedTable } from './FeedTable';
import { AddFeedForm } from './AddFeedForm';
import { EditJsonForm } from './EditJsonForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, PlusCircle, Edit3, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import type { FeedData, DisplayFeedItem } from '@/types';

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

function mapFeedDataToDisplayItems(feedData: FeedData): DisplayFeedItem[] {
  return Object.entries(feedData).map(([channelId, info]) => ({
    channelId,
    url: constructFeedUrl(channelId),
    name: info.name,
    discordChannel: info.discordChannel, // Ensure discordChannel is mapped
  }));
}

interface FeedDashboardProps {
  initialFeeds: DisplayFeedItem[]; 
  initialRawJson: string;
}

export function FeedDashboard({ initialFeeds: serverInitialFeeds, initialRawJson }: FeedDashboardProps) {
  const [feeds, setFeeds] = useState<DisplayFeedItem[]>(serverInitialFeeds);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]); // Stores URLs of selected feeds
  const [rawJsonInput, setRawJsonInput] = useState<string>(initialRawJson);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const parsedJson = JSON.parse(initialRawJson) as FeedData;
      setFeeds(mapFeedDataToDisplayItems(parsedJson));
    } catch (e) {
      console.error("Failed to parse initialRawJson for feeds", e);
      setFeeds(serverInitialFeeds); 
    }
    setRawJsonInput(initialRawJson);
  }, [initialRawJson, serverInitialFeeds]);


  const handleAddFeed = async (url: string) => {
    setIsLoading(true);
    const result = await addFeed(url);
    if (result.success && result.newFeedItem) {
      setFeeds(prev => [...prev, result.newFeedItem!]);
      try {
          const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
          currentJsonData[result.newFeedItem.channelId] = { 
            name: result.newFeedItem.name, 
            discordChannel: result.newFeedItem.discordChannel // Use discordChannel from newFeedItem
          };
          setRawJsonInput(JSON.stringify(currentJsonData, null, 2));
      } catch (e) {
          console.error("Error updating rawJsonInput after add:", e);
      }
      toast({
        title: "Feed added",
        description: "The new feed has been successfully added.",
        action: <CheckCircle className="text-green-500" />,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Failed to add feed",
        description: result.message || "An unknown error occurred.",
        action: <AlertTriangle className="text-red-500" />,
      });
    }
    setIsLoading(false);
    return {success: result.success, message: result.message};
  };

  const handleDeleteSelectedFeeds = async () => {
    if (selectedFeeds.length === 0) return;
    setIsLoading(true);
    const result = await deleteFeeds(selectedFeeds); // Pass URLs to delete
    if (result.success) {
      const newFeeds = feeds.filter(feed => !selectedFeeds.includes(feed.url));
      setFeeds(newFeeds); 

      try {
        const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
        selectedFeeds.forEach(url => {
          const channelId = extractChannelIdFromUrl(url);
          if (channelId && currentJsonData[channelId]) {
            delete currentJsonData[channelId];
          }
        });
        setRawJsonInput(JSON.stringify(currentJsonData, null, 2));
      } catch (e) {
        console.error("Error updating rawJsonInput after delete:", e);
      }
      setSelectedFeeds([]);
      toast({
        title: "Feeds deleted",
        description: `${selectedFeeds.length} feed(s) have been successfully deleted.`,
        action: <CheckCircle className="text-green-500" />,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Failed to delete feeds",
        description: result.message || "An unknown error occurred.",
        action: <AlertTriangle className="text-red-500" />,
      });
    }
    setIsLoading(false);
  };

  const handleUpdateRawJson = async (jsonContent: string) => {
    setIsLoading(true);
    const result = await updateRawJson(jsonContent);
    if (result.success) {
      try {
        const parsedData = JSON.parse(jsonContent) as FeedData;
        setFeeds(mapFeedDataToDisplayItems(parsedData)); // This will now map discordChannel too
        setRawJsonInput(jsonContent); 
         toast({
          title: "JSON updated",
          description: "The feed.json content has been successfully updated.",
          action: <CheckCircle className="text-green-500" />,
        });
      } catch (e) {
         toast({
          variant: "destructive",
          title: "JSON parsing error after save",
          description: "The JSON was saved but could not be parsed locally to update the feed list.",
          action: <AlertTriangle className="text-red-500" />,
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Failed to update JSON",
        description: result.message || "An unknown error occurred.",
        action: <AlertTriangle className="text-red-500" />,
      });
    }
    setIsLoading(false);
    return result;
  };

  const handleUpdateFeedDiscordChannel = async (channelId: string, newDiscordId: string) => {
    setIsLoading(true);
    const result = await updateFeedDiscordChannel(channelId, newDiscordId);
    if (result.success && result.updatedFeedItem) {
      // Update local feeds state
      setFeeds(prevFeeds => 
        prevFeeds.map(feed => 
          feed.channelId === channelId 
            ? { ...feed, discordChannel: result.updatedFeedItem!.discordChannel } 
            : feed
        )
      );
      // Update rawJsonInput state
      try {
        const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
        if (currentJsonData[channelId]) {
          currentJsonData[channelId].discordChannel = newDiscordId;
          setRawJsonInput(JSON.stringify(currentJsonData, null, 2));
        }
      } catch (e) {
        console.error("Error updating rawJsonInput after Discord channel update:", e);
      }
      toast({
        title: "Discord Channel Updated",
        description: `Discord channel for ${result.updatedFeedItem.name} updated.`,
        action: <CheckCircle className="text-green-500" />,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: result.message || "Could not update Discord channel.",
        action: <AlertTriangle className="text-red-500" />,
      });
      // Optionally, revert optimistic UI update if any, or refresh data
      // For now, we rely on the DiscordChannelInput's useEffect to reset if initialValue changes
      // due to a failed backend update that might trigger a parent data refresh.
    }
    setIsLoading(false);
  };


  const handleToggleSelectFeed = (feedUrl: string) => {
    setSelectedFeeds(prev =>
      prev.includes(feedUrl) ? prev.filter(f => f !== feedUrl) : [...prev, feedUrl]
    );
  };
  
  const handleToggleSelectAll = () => {
    if (selectedFeeds.length === feeds.length) {
      setSelectedFeeds([]);
    } else {
      setSelectedFeeds(feeds.map(f => f.url)); 
    }
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-6 w-6 text-primary" />
            Your YouTube Feeds
          </CardTitle>
          <CardDescription>
            Manage your list of YouTube feed URLs. Select feeds to delete them. You can also edit the Discord Channel ID for each feed directly in the table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedTable
            feeds={feeds}
            selectedFeeds={selectedFeeds} 
            onToggleSelectFeed={handleToggleSelectFeed}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteSelected={handleDeleteSelectedFeeds}
            onUpdateFeedDiscordChannel={handleUpdateFeedDiscordChannel} // Pass the handler
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <PlusCircle className="mr-2 h-6 w-6 text-primary" />
              Add New Feed
            </CardTitle>
            <CardDescription>
              Enter a valid YouTube feed URL to add it to your list. Name and Discord channel can be edited in the raw JSON editor or directly in the table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddFeedForm onAddFeed={handleAddFeed} isLoading={isLoading} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Edit3 className="mr-2 h-6 w-6 text-primary" />
              Edit Raw feed.json
            </CardTitle>
            <CardDescription>
              Directly edit the content of your feed.json file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditJsonForm initialJsonContent={rawJsonInput} onUpdateJson={handleUpdateRawJson} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
      
      <Toaster />
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
