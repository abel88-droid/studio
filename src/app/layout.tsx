import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const geistSans = GeistSans; // Use the imported variable directly
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'DC dashboard',
  description: 'Manage your YouTube feeds from your GitHub repository.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster /> {/* Add Toaster here for global toast notifications */}
      </body>
    </html>
  );
}
