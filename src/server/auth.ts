import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const secret = process.env.AUTH_SECRET ?? process.env.SECRET ?? (
  process.env.NODE_ENV === "development" ? "dev-secret-k8x9m2p4" : "museai-fallback-secret-prod-v1"
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers: [
    GitHub({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET, allowDangerousEmailAccountLinking: true }),
    Google({ clientId: process.env.GOOGLE_ID, clientSecret: process.env.GOOGLE_SECRET, allowDangerousEmailAccountLinking: true }),
    Credentials({
      id: "demo",
      name: "demo",
      credentials: {},
      authorize: async () => {
        return { id: "demo-user", email: "guest@museai.app", name: "訪客" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}