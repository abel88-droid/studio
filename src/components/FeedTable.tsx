'use client';

import type { FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';

interface FeedTableProps {
  feeds: string[];
  selectedFeeds: string[];
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
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select All
            </label>
           </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={selectedFeeds.length === 0 || isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedFeeds.length})
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Feed URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center">
                  No feeds yet. Add some feeds to get started.
                </TableCell>
              </TableRow>
            ) : (
              feeds.map((feed, index) => (
                <TableRow key={index} data-state={selectedFeeds.includes(feed) ? "selected" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedFeeds.includes(feed)}
                      onCheckedChange={() => onToggleSelectFeed(feed)}
                      aria-label={`Select feed ${feed}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium truncate max-w-sm_ lg:max-w-md_ xl:max-w-lg"> {/* Added truncate and max-width classes */}
                    {feed}
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
