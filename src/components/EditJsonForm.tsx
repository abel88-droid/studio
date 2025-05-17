'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Save } from 'lucide-react';
import { useEffect } from "react";

const editJsonFormSchema = z.object({
  jsonContent: z.string().min(1, { message: "JSON content cannot be empty." })
    .refine(value => {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.feeds) && parsed.feeds.every((item: any) => typeof item === 'string');
      } catch (e) {
        return false;
      }
    }, { message: "Invalid JSON structure. Must be { \"feeds\": [\"url1\", ...] } and all feeds must be strings." }),
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
              <FormControl>
                <Textarea
                  placeholder='{ "feeds": ["url1", "url2"] }'
                  className="min-h-[200px] font-mono text-sm"
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
