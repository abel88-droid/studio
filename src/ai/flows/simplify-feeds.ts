'use server';
/**
 * @fileOverview AI flow to simplify a list of YouTube feed URLs by identifying similar feeds.
 *
 * - simplifyFeeds - A function that takes an array of feed URLs and returns suggestions for simplification.
 * - SimplifyFeedsInput - The input type for the simplifyFeeds function.
 * - SimplifyFeedsOutput - The return type for the simplifyFeeds function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimplifyFeedsInputSchema = z.object({
  feedUrls: z
    .array(z.string().url())
    .describe('An array of YouTube feed URLs to analyze.'),
});
export type SimplifyFeedsInput = z.infer<typeof SimplifyFeedsInputSchema>;

const SimplifyFeedsOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe(
      'An array of suggestions for simplifying the feed URLs, including identifying similar feeds and potential consolidations.'
    ),
});
export type SimplifyFeedsOutput = z.infer<typeof SimplifyFeedsOutputSchema>;

export async function simplifyFeeds(input: SimplifyFeedsInput): Promise<SimplifyFeedsOutput> {
  return simplifyFeedsFlow(input);
}

const simplifyFeedsPrompt = ai.definePrompt({
  name: 'simplifyFeedsPrompt',
  input: {schema: SimplifyFeedsInputSchema},
  output: {schema: SimplifyFeedsOutputSchema},
  prompt: `You are an expert in analyzing YouTube feed URLs and identifying opportunities for simplification.

  Given the following list of feed URLs:
  {{#each feedUrls}}
  - {{{this}}}
  {{/each}}

  Analyze the list and provide suggestions for simplification. Consider the following:
  - Are there any feeds that seem to be duplicates or provide very similar content?
  - Can any feeds be consolidated into a single feed?
  - Are there any feeds that are no longer active or relevant?

  Provide your suggestions in a clear and concise manner.
  `,
});

const simplifyFeedsFlow = ai.defineFlow(
  {
    name: 'simplifyFeedsFlow',
    inputSchema: SimplifyFeedsInputSchema,
    outputSchema: SimplifyFeedsOutputSchema,
  },
  async input => {
    const {output} = await simplifyFeedsPrompt(input);
    return output!;
  }
);

