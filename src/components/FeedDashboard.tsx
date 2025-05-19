
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addFeed, deleteFeeds, updateRawJson, updateFeedDiscordChannel } from '@/lib/feed-actions';
import { FeedTable } from './FeedTable';
import { AddFeedForm } from './AddFeedForm';
import { EditJsonForm } from './EditJsonForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, PlusCircle, Edit3, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"; // Keep for AlertDialogAction if needed
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
    discordChannel: info.discordChannel,
  }));
}

interface FeedDashboardProps {
  initialFeeds: DisplayFeedItem[]; 
  initialRawJson: string;
}

export function FeedDashboard({ initialFeeds: serverInitialFeeds, initialRawJson }: FeedDashboardProps) {
  const [feeds, setFeeds] = useState<DisplayFeedItem[]>(serverInitialFeeds);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [rawJsonInput, setRawJsonInput] = useState<string>(initialRawJson);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'url' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
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

  const handleSort = (key: 'name' | 'url') => {
    if (sortKey === key) {
      setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedFeeds = useMemo(() => {
    if (!sortKey) return feeds;
    return [...feeds].sort((a, b) => {
      const valA = a[sortKey].toLowerCase();
      const valB = b[sortKey].toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [feeds, sortKey, sortOrder]);


  const handleAddFeed = async (url: string) => {
    setIsLoading(true);
    const result = await addFeed(url);
    if (result.success && result.newFeedItem) {
      setFeeds(prev => [...prev, result.newFeedItem!]);
      try {
          const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
          currentJsonData[result.newFeedItem.channelId] = { 
            name: result.newFeedItem.name, 
            discordChannel: result.newFeedItem.discordChannel
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

  const promptDeleteSelectedFeeds = () => {
    if (selectedFeeds.length === 0) {
        toast({
            variant: "destructive",
            title: "No feeds selected",
            description: "Please select feeds to delete.",
            action: <AlertTriangle className="text-red-500" />,
        });
        return;
    }
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteSelectedFeeds = async () => {
    setIsLoading(true);
    setIsDeleteDialogOpen(false);
    const result = await deleteFeeds(selectedFeeds);
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
        description: result.message || `${selectedFeeds.length} feed(s) have been successfully deleted.`,
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
        setFeeds(mapFeedDataToDisplayItems(parsedData));
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
      setFeeds(prevFeeds => 
        prevFeeds.map(feed => 
          feed.channelId === channelId 
            ? { ...feed, discordChannel: result.updatedFeedItem!.discordChannel } 
            : feed
        )
      );
      try {
        const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
        if (currentJsonData[channelId]) {
          currentJsonData[channelId].discordChannel = result.updatedFeedItem.discordChannel;
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
            Manage your list of YouTube feed URLs. Select feeds to delete them. You can also edit the Discord Channel ID for each feed directly in the table. Click on column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedTable
            feeds={sortedFeeds}
            selectedFeeds={selectedFeeds} 
            onToggleSelectFeed={handleToggleSelectFeed}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteSelected={promptDeleteSelectedFeeds}
            onUpdateFeedDiscordChannel={handleUpdateFeedDiscordChannel}
            isLoading={isLoading}
            sortKey={sortKey}
            sortOrder={sortOrder}
            onSort={handleSort}
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
              Enter a YouTube channel URL (e.g. @handle, channel page, video URL) or a direct feed URL.
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
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete {selectedFeeds.length} selected feed(s) from your feed.json.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSelectedFeeds}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
