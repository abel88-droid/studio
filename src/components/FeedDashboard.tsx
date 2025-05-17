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
import type { SimplifyFeedsOutput } from '@/ai/flows/simplify-feeds';

interface FeedDashboardProps {
  initialFeeds: string[];
  initialRawJson: string;
}

export function FeedDashboard({ initialFeeds, initialRawJson }: FeedDashboardProps) {
  const [feeds, setFeeds] = useState<string[]>(initialFeeds);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [rawJsonInput, setRawJsonInput] = useState<string>(initialRawJson);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const refreshFeedsAndJson = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real app, you'd re-fetch from the server actions
      // For now, we assume server actions update the source and then we can re-initialize state
      // or better, the actions would return the new state.
      // This is simplified due to local file system interaction.
      // We will rely on optimistic updates and explicit calls for now.
      // const updatedFeeds = await getFeeds(); // Not strictly needed if actions return new state
      // const updatedRawJson = await getRawJson();
      // setFeeds(updatedFeeds);
      // setRawJsonInput(updatedRawJson);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error refreshing data",
        description: "Could not reload feed data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setFeeds(initialFeeds);
  }, [initialFeeds]);

  useEffect(() => {
    setRawJsonInput(initialRawJson);
  }, [initialRawJson]);


  const handleAddFeed = async (url: string) => {
    setIsLoading(true);
    const result = await addFeed(url);
    if (result.success) {
      setFeeds(prev => [...prev, url]);
      setRawJsonInput(prev => JSON.stringify({ feeds: [...JSON.parse(prev).feeds, url] }, null, 2));
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
      setFeeds(newFeeds);
      setRawJsonInput(JSON.stringify({ feeds: newFeeds }, null, 2));
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
        const parsedData = JSON.parse(jsonContent);
        setFeeds(parsedData.feeds);
        setRawJsonInput(jsonContent); // Keep user's formatting if valid
         toast({
          title: "JSON updated",
          description: "The feed.json content has been successfully updated.",
          action: <CheckCircle className="text-green-500" />,
        });
      } catch (e) {
         toast({
          variant: "destructive",
          title: "JSON parsing error after save",
          description: "The JSON was saved but could not be parsed locally.",
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
      setSelectedFeeds(feeds.slice()); // Select all
    }
  };

  const handleSimplifyFeeds = async (feedUrls: string[]): Promise<SimplifyFeedsOutput> => {
    setIsLoading(true);
    try {
      const result = await simplifyFeedsAction(feedUrls);
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
              Enter a valid YouTube feed URL to add it to your list.
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

      <FeedSimplifierSection feeds={feeds} onSimplifyFeeds={handleSimplifyFeeds} />
      
      <Toaster />
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
