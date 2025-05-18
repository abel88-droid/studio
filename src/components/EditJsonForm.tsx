
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
          // Channel IDs typically start with 'UC' and are 24 characters long.
          if (!/^UC[\w-]{22}$/.test(key)) { 
            // console.warn(`Invalid key format for channel ID: ${key}. Expected 'UC' followed by 22 alphanumeric characters, hyphens, or underscores.`);
            // Relaxing this for the form, server-side will be stricter.
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
    }, { message: "Invalid JSON. Must be an object where each key is a YouTube Channel ID (e.g., \"UCYL-QGEkA1r7R7U5rN_Yonw\"), and the value is an object with 'name' (string) and 'discordChannel' (string) properties." }),
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
                The JSON file should be an object. Each key must be a unique YouTube Channel ID (e.g., <code>"UCYL-QGEkA1r7R7U5rN_Yonw"</code>).
                The value for each key must be an object with two string properties:
                <code className="block bg-muted p-1 rounded text-xs my-1">"discordChannel": "Your Discord Channel ID for notifications"</code>
                <code className="block bg-muted p-1 rounded text-xs my-1">"name": "Your Channel Display Name"</code>
                <br />
                Example:
                <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-x-auto">
{`{
  "UCYL-QGEkA1r7R7U5rN_Yonw": { "discordChannel": "1341719063780393031", "name": "Vereshchak" },
  "UC16xML3oyIZDeF3g8nnV6MA": { "discordChannel": "1341719063780393031", "name": "Vokope" }
}`}
                </pre>
              </FormDescription>
              <FormControl>
                <Textarea
                  placeholder='{\n  "UCYL-QGEkA1r7R7U5rN_Yonw": { "discordChannel": "1341719063780393031", "name": "Vereshchak" },\n  "UC16xML3oyIZDeF3g8nnV6MA": { "discordChannel": "1341719063780393031", "name": "Vokope" }\n}'
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
