
import Image from 'next/image';
import { getFeeds, getRawJson } from '@/lib/feed-actions';
import { FeedDashboard } from '@/components/FeedDashboard';
import type { Metadata } from 'next';
import { AuthButton } from '@/components/AuthButton';

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
      <header className="mb-12 flex flex-col items-center text-center relative">
        <div className="absolute top-0 right-0 p-2 md:p-4">
          <AuthButton />
        </div>
        <Image
          src="/dc-dashboard-logo.png" 
          alt="DC dashboard dragon logo swirling around the title"
          width={400} 
          height={200} 
          className="rounded-md shadow-lg mb-6"
          data-ai-hint="dragon logo text"
          priority
        />
        <p className="text-lg text-muted-foreground">
          YouTube Feed Management Dashboard
        </p>
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
