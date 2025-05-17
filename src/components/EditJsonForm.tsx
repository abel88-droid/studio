
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Save } from 'lucide-react';
import { useEffect } from "react";
import type { FeedChannelInfo } from "@/types";

const editJsonFormSchema = z.object({
  jsonContent: z.string().min(1, { message: "JSON content cannot be empty." })
    .refine(value => {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return false;
        }
        // Allow empty object
        if (Object.keys(parsed).length === 0) {
            return true;
        }
        for (const key in parsed) {
          // Key should be a valid channel ID (basic check, can be improved)
          if (!/^[a-zA-Z0-9_-]{24}$/.test(key) && !key.startsWith('UC')) { 
            // console.warn(`Invalid key format for channel ID: ${key}`);
            // Relaxing this check as user might have different ID formats.
            // Main check is on the value structure.
          }
          const channelInfo = parsed[key] as FeedChannelInfo;
          if (typeof channelInfo !== 'object' || channelInfo === null ||
              typeof channelInfo.discordChannel !== 'string' ||
              typeof channelInfo.name !== 'string') {
            return false;
          }
        }
        return true;
      } catch (e) {
        return false;
      }
    }, { message: "Invalid JSON. Must be an object where each key is a YouTube Channel ID, and the value is an object with 'name' (string) and 'discordChannel' (string) properties." }),
});

type EditJsonFormValues = z.infer<typeof editJsonFormSchema>;

interface EditJsonFormProps {
  initialJsonContent: string;
  onUpdateJson: (jsonContent: string) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
}

export function EditJsonForm({ initialJsonContent, onUpdateJson, isLoading }: EditJsonFormProps) {
  const form = useForm<EditJsonFormValues>({
    resolver: zodResolver(editJsonFormSchema),
    defaultValues: {
      jsonContent: initialJsonContent,
    },
  });

  useEffect(() => {
    form.reset({ jsonContent: initialJsonContent });
  }, [initialJsonContent, form]);

  async function onSubmit(data: EditJsonFormValues) {
    const result = await onUpdateJson(data.jsonContent);
     if (result.message && !result.success) {
      form.setError("jsonContent", { type: "manual", message: result.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="jsonContent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>feed.json Content</FormLabel>
              <FormDescription>
                The JSON file should be an object. Each key must be a unique YouTube Channel ID (e.g., "UCxxxxxxxxxxxx").
                The value for each key must be an object with two string properties:
                <code className="block bg-muted p-1 rounded text-xs my-1">"name": "Your Channel Display Name"</code>
                <code className="block bg-muted p-1 rounded text-xs my-1">"discordChannel": "Your Discord Channel ID for notifications"</code>
              </FormDescription>
              <FormControl>
                <Textarea
                  placeholder='{\n  "UCxxxxxxxxxxxx": { "name": "Channel Name", "discordChannel": "123456789012345678" },\n  "UCyyyyyyyyyyyy": { "name": "Another Channel", "discordChannel": "876543210987654321" }\n}'
                  className="min-h-[200px] font-mono text-sm mt-2"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          Save JSON
        </Button>
      </form>
    </Form>
  );
}
