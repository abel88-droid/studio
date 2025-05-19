
import type { DefaultSession, User } from 'next-auth';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique ID. */
      id?: string;
    } & DefaultSession['user']; // Keep existing properties like name, email, image
  }

  // If you need to add properties to the User object (e.g., from the provider's profile)
  // interface User {
  //   id?: string; // Ensure User also has id if you're adding it
  // }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    idToken?: string;
    // You can add custom properties to the JWT token here
    // sub is usually the user id from the provider
  }
}
