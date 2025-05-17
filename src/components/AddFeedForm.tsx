'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlusCircle } from 'lucide-react';

const addFeedFormSchema = z.object({
  feedUrl: z.string().url({ message: "Please enter a valid URL." })
    .refine(url => url.startsWith("https://www.youtube.com/feeds/videos.xml?"), {
      message: "URL must be a valid YouTube feed URL (e.g., https://www.youtube.com/feeds/videos.xml?channel_id=...)."
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
              <FormLabel>New Feed URL</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://www.youtube.com/feeds/videos.xml?channel_id=..." {...field} 
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
