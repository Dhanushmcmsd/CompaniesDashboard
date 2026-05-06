import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) throw new Error("Invalid email or password");

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) throw new Error("Invalid email or password");

        if (user.role === "PENDING") {
          throw new Error("Account pending admin approval");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = (user as { role?: string }).role ?? "PENDING";
        token.company = (user as { company?: string | null }).company ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.role = token.role;
        session.user.company = token.company;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
