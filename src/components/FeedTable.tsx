
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from 'lucide-react';
import type { DisplayFeedItem } from '@/types';

interface DiscordChannelInputProps {
  initialValue: string; // This will be the raw numeric ID
  channelId: string;
  onSave: (channelId: string, newValue: string) => Promise<void>; // newValue is the string from input
  disabled: boolean;
}

const DiscordChannelInput: FC<DiscordChannelInputProps> = ({ initialValue, channelId, onSave, disabled }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    // When initialValue (raw ID from server) changes, update the input field's display value.
    // This ensures the input reflects the actual stored data.
    setValue(initialValue);
  }, [initialValue]);

  const handleBlur = async () => {
    // Only save if the typed value is different from the initial raw ID.
    // The server will parse and validate the format.
    if (value !== initialValue) {
      await onSave(channelId, value);
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className="text-sm h-8"
      placeholder="#name-ID or raw ID" // Updated placeholder
    />
  );
};


interface FeedTableProps {
  feeds: DisplayFeedItem[];
  selectedFeeds: string[]; // Stores URLs of selected feeds
  onToggleSelectFeed: (feedUrl: string) => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onUpdateFeedDiscordChannel: (channelId: string, newDiscordIdInput: string) => Promise<void>;
  isLoading: boolean;
}

export const FeedTable: FC<FeedTableProps> = ({
  feeds,
  selectedFeeds,
  onToggleSelectFeed,
  onToggleSelectAll,
  onDeleteSelected,
  onUpdateFeedDiscordChannel,
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
              <TableHead className="min-w-[250px]">Discord Channel (#name-ID or ID)</TableHead> 
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
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
                  <TableCell className="max-w-[250px]">
                    <DiscordChannelInput
                      initialValue={feedItem.discordChannel}
                      channelId={feedItem.channelId}
                      onSave={onUpdateFeedDiscordChannel}
                      disabled={isLoading}
                    />
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

