
import NextAuth, { type NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      // Add user ID and other custom properties to the session
      if (token.sub) {
        session.user.id = token.sub;
      }
      // You can add more properties from the token to the session user if needed
      // For example, if Discord provider returns roles or other specific data in the token
      return session;
    },
  },
  // You can add custom pages for sign-in, error, etc. if needed
  // pages: {
  //   signIn: '/auth/signin',
  // }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
