
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, UserCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User avatar'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <UserCircle className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground hidden sm:inline">
          {session.user?.name || session.user?.email}
        </span>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => signIn('discord')}>
      <LogIn className="mr-2 h-4 w-4" />
      Sign In with Discord
    </Button>
  );
}
