
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlusCircle } from 'lucide-react';

const addFeedFormSchema = z.object({
  feedUrl: z.string().min(3, { message: "URL or ID seems too short." })
    .refine(url => {
      const lowerUrl = url.toLowerCase();
      // Check for keywords or patterns that indicate it's likely a YouTube URL, handle, or ID
      const looksLikeYouTube =
        lowerUrl.includes('youtube.com') ||
        lowerUrl.includes('youtu.be') ||
        lowerUrl.startsWith('@') ||
        (lowerUrl.startsWith('uc') && lowerUrl.length > 20) || // Basic check for UC channel IDs
        lowerUrl.includes('/@') ||
        lowerUrl.includes('/c/') ||
        lowerUrl.includes('/user/') ||
        lowerUrl.includes('/channel/') ||
        lowerUrl.includes('/feeds/videos.xml');

      return looksLikeYouTube;
    }, {
      message: "Enter a YouTube URL (e.g., @handle, channel/video URL), raw Channel ID (UC...), or feed link."
    }),
});

type AddFeedFormValues = z.infer<typeof addFeedFormSchema>;

interface AddFeedFormProps {
  onAddFeed: (url: string) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
}

export function AddFeedForm({ onAddFeed, isLoading }: AddFeedFormProps) {
  const form = useForm<AddFeedFormValues>({
    resolver: zodResolver(addFeedFormSchema),
    defaultValues: {
      feedUrl: "",
    },
  });

  async function onSubmit(data: AddFeedFormValues) {
    const result = await onAddFeed(data.feedUrl);
    if (result.success) {
      form.reset();
    } else if (result.message) {
      form.setError("feedUrl", { type: "manual", message: result.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="feedUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New YouTube Channel or Feed URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., @handle, channel/video URL, raw Channel ID (UC...), or ...videos.xml"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Feed
        </Button>
      </form>
    </Form>
  );
}
