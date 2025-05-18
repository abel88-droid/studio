
import Image from 'next/image';
import { getFeeds, getRawJson } from '@/lib/feed-actions';
import { FeedDashboard } from '@/components/FeedDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DC dashboard - YouTube Feed Manager',
  description: 'Manage your YouTube feeds from your GitHub repository.',
};

export default async function HomePage() {
  // getFeeds now returns DisplayFeedItem[] which includes discordChannel
  const initialFeeds = await getFeeds();
  const initialRawJson = await getRawJson();

  return (
    <div className="container mx-auto min-h-screen p-4 py-8 md:p-8">
      <header className="mb-12 flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-center sm:gap-6">
        <Image
          src="https://placehold.co/120x100.png"
          alt="Dragon emblem"
          width={120}
          height={100}
          className="rounded-md shadow-lg mb-4 sm:mb-0 order-1 sm:order-none"
          data-ai-hint="dragon"
          priority
        />
        <div className="order-2 sm:order-none">
          <h1 className="text-5xl font-bold tracking-tight text-primary">
            DC dashboard
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Your YouTube Feed Management Dashboard
          </p>
        </div>
      </header>

      <main>
        <FeedDashboard initialFeeds={initialFeeds} initialRawJson={initialRawJson} />
      </main>

      <footer className="mt-16 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DC dashboard. All rights reserved.</p>
        <p>Powered by Next.js and ShadCN UI.</p>
      </footer>
    </div>
  );
}
