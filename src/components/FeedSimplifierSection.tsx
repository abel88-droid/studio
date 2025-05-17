'use client';

import { useState, type FC } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from 'lucide-react';
import type { SimplifyFeedsOutput } from '@/ai/flows/simplify-feeds';

interface FeedSimplifierSectionProps {
  feeds: string[];
  onSimplifyFeeds: (feedUrls: string[]) => Promise<SimplifyFeedsOutput>;
}

export const FeedSimplifierSection: FC<FeedSimplifierSectionProps> = ({ feeds, onSimplifyFeeds }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimplify = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const result = await onSimplifyFeeds(feeds);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError('Failed to get suggestions. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-accent" />
          AI Feed Simplifier
        </CardTitle>
        <CardDescription>
          Let AI analyze your feed list for potential simplifications and consolidations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSimplify} disabled={isLoading || feeds.length === 0} className="w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Analyze Feeds
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {suggestions.length > 0 && (
          <div className="space-y-2 pt-4">
            <h4 className="font-semibold">Suggestions:</h4>
            <ul className="list-disc space-y-1 rounded-md border bg-muted/50 p-4 pl-8 text-sm">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
         {suggestions.length === 0 && !isLoading && !error && feeds.length > 0 && (
          <p className="text-sm text-muted-foreground pt-4">Click "Analyze Feeds" to get suggestions.</p>
        )}
        {feeds.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground pt-4">Add some feeds to analyze them.</p>
        )}
      </CardContent>
    </Card>
  );
};
