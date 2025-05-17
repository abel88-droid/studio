
'use client';

import { useState, useEffect, useCallback } from 'react';
import { addFeed, deleteFeeds, updateRawJson, simplifyFeeds as simplifyFeedsAction } from '@/lib/feed-actions';
import { FeedTable } from './FeedTable';
import { AddFeedForm } from './AddFeedForm';
import { EditJsonForm } from './EditJsonForm';
import { FeedSimplifierSection } from './FeedSimplifierSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, PlusCircle, Edit3, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import type { SimplifyFeedsOutput, FeedData, FeedChannelInfo } from '@/ai/flows/simplify-feeds'; // Assuming SimplifyFeedsOutput is also in types or ai/flows

// Helper functions (can be moved to a utils file if used elsewhere)
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

function getUrlsFromFeedData(feedData: FeedData): string[] {
  return Object.keys(feedData).map(constructFeedUrl);
}

interface FeedDashboardProps {
  initialFeeds: string[]; // This will now be derived from initialRawJson on client
  initialRawJson: string;
}

export function FeedDashboard({ initialFeeds: serverInitialFeeds, initialRawJson }: FeedDashboardProps) {
  const [feeds, setFeeds] = useState<string[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [rawJsonInput, setRawJsonInput] = useState<string>(initialRawJson);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize feeds from initialRawJson, as initialFeeds prop might be stale if JSON changes often
    try {
      const parsedJson = JSON.parse(initialRawJson) as FeedData;
      setFeeds(getUrlsFromFeedData(parsedJson));
    } catch (e) {
      console.error("Failed to parse initialRawJson for feeds", e);
      setFeeds(serverInitialFeeds); // Fallback to serverInitialFeeds if parsing fails
    }
    setRawJsonInput(initialRawJson);
  }, [initialRawJson, serverInitialFeeds]);


  const handleAddFeed = async (url: string) => {
    setIsLoading(true);
    const result = await addFeed(url);
    if (result.success) {
      const channelId = extractChannelIdFromUrl(url);
      if (channelId) {
        setFeeds(prev => [...prev, url]); // Optimistic update for the URL list
        try {
            const currentJsonData = JSON.parse(rawJsonInput) as FeedData;
            currentJsonData[channelId] = { name: "New Channel (please edit)", discordChannel: "default_discord_id" };
            setRawJsonInput(JSON.stringify(currentJsonData, null, 2));
        } catch (e) {
            console.error("Error updating rawJsonInput after add:", e);
            // Potentially re-fetch raw JSON here if local update fails
        }
      }
      toast({
        title: "Feed added",
        description: "The new feed URL has been successfully added.",
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
    return result;
  };

  const handleDeleteSelectedFeeds = async () => {
    if (selectedFeeds.length === 0) return;
    setIsLoading(true);
    const result = await deleteFeeds(selectedFeeds);
    if (result.success) {
      const newFeeds = feeds.filter(feed => !selectedFeeds.includes(feed));
      setFeeds(newFeeds); // Optimistic update for the URL list

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
         // Potentially re-fetch raw JSON here
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
        setFeeds(getUrlsFromFeedData(parsedData)); // Derive URLs from the new JSON
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

  const handleToggleSelectFeed = (feedUrl: string) => {
    setSelectedFeeds(prev =>
      prev.includes(feedUrl) ? prev.filter(f => f !== feedUrl) : [...prev, feedUrl]
    );
  };
  
  const handleToggleSelectAll = () => {
    if (selectedFeeds.length === feeds.length) {
      setSelectedFeeds([]);
    } else {
      setSelectedFeeds(feeds.slice()); 
    }
  };

  const handleSimplifyFeeds = async (feedUrlsToSimplify: string[]): Promise<SimplifyFeedsOutput> => {
    setIsLoading(true);
    try {
      // Ensure we pass the current list of URLs from the state
      const result = await simplifyFeedsAction(feedUrlsToSimplify.length > 0 ? feedUrlsToSimplify : feeds);
      toast({
        title: "Analysis Complete",
        description: "Feed simplification suggestions are ready.",
        action: <CheckCircle className="text-green-500" />,
      });
      return result;
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Simplification Failed",
        description: "Could not get simplification suggestions.",
        action: <AlertTriangle className="text-red-500" />,
      });
      return { suggestions: ['Error: Could not process simplification.'] };
    } finally {
      setIsLoading(false);
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
            Manage your list of YouTube feed URLs. Select feeds to delete them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedTable
            feeds={feeds}
            selectedFeeds={selectedFeeds}
            onToggleSelectFeed={handleToggleSelectFeed}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteSelected={handleDeleteSelectedFeeds}
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
              Enter a valid YouTube feed URL to add it to your list. Name and Discord channel can be edited in the raw JSON editor.
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
      
      <Separator />

      <FeedSimplifierSection feeds={feeds} onSimplifyFeeds={() => handleSimplifyFeeds(feeds)} />
      
      <Toaster />
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
