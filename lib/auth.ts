import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertAuthConfigured() {
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    throw new Error(
      "NEXTAUTH_SECRET is missing. Add it to .env.local (see .env.local.example).",
    );
  }
}

export const authOptions: NextAuthOptions = {
  // Explicitly set the secret so next-auth never falls back to an auto-generated
  // one (which triggers the [NO_SECRET] warning in dev and breaks prod).
  // The value comes from NEXTAUTH_SECRET in .env / Vercel env vars.
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        assertAuthConfigured();

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        const email = normalizeEmail(credentials.email);

        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
          });
          if (!user) throw new Error("Invalid email or password");

          const ok = await bcrypt.compare(credentials.password, user.password);
          if (!ok) throw new Error("Invalid email or password");

          if (user.role === "PENDING") {
            throw new Error("Account pending admin approval");
          }

          return {
            id:      user.id,
            name:    user.name,
            email:   user.email,
            role:    user.role,
            company: user.company,
          };
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "P1001") {
            throw new Error(
              "Cannot reach the database. Check DATABASE_URL in .env.local, wake the Neon project in the console, then restart npm run dev.",
            );
          }
          throw error;
        }
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id;
        token.name    = user.name;
        token.email   = user.email;
        token.role    = (user as { role?: string }).role ?? "PENDING";
        token.company = (user as { company?: string | null }).company ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id      = token.id;
        session.user.name    = token.name    ?? session.user.name;
        session.user.email   = token.email   ?? session.user.email;
        session.user.role    = token.role;
        session.user.company = token.company;
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
};
