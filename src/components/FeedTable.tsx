
'use client';

import type { FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';
import type { DisplayFeedItem } from '@/types';

interface FeedTableProps {
  feeds: DisplayFeedItem[];
  selectedFeeds: string[]; // Stores URLs of selected feeds
  onToggleSelectFeed: (feedUrl: string) => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  isLoading: boolean;
}

export const FeedTable: FC<FeedTableProps> = ({
  feeds,
  selectedFeeds,
  onToggleSelectFeed,
  onToggleSelectAll,
  onDeleteSelected,
  isLoading,
}) => {
  const allSelected = feeds.length > 0 && selectedFeeds.length === feeds.length;
  const someSelected = selectedFeeds.length > 0 && selectedFeeds.length < feeds.length;

  return (
    <div className="space-y-4">
      {feeds.length > 0 && (
         <div className="flex items-center justify-between">
           <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={allSelected || (someSelected && "indeterminate") === "indeterminate"}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all feeds"
              disabled={isLoading}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select All ({selectedFeeds.length}/{feeds.length})
            </label>
           </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={selectedFeeds.length === 0 || isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Channel Name</TableHead>
              <TableHead>Feed URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No feeds yet. Add some feeds to get started.
                </TableCell>
              </TableRow>
            ) : (
              feeds.map((feedItem) => (
                <TableRow 
                  key={feedItem.channelId} 
                  data-state={selectedFeeds.includes(feedItem.url) ? "selected" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedFeeds.includes(feedItem.url)}
                      onCheckedChange={() => onToggleSelectFeed(feedItem.url)}
                      aria-label={`Select feed for ${feedItem.name}`}
                      disabled={isLoading}
                    />
                  </TableCell>
                  <TableCell className="font-medium truncate max-w-xs">
                    {feedItem.name}
                  </TableCell>
                  <TableCell className="font-medium truncate max-w-sm"> 
                    {feedItem.url}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
