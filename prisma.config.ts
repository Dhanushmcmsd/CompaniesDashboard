import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import('@prisma/adapter-neon');
      const { neon }       = await import('@neondatabase/serverless');
      const neonUrl = process.env.DATABASE_URL;
      if (!neonUrl) throw new Error('DATABASE_URL is not set');
      const sql = neon(neonUrl);
      return new PrismaNeon({ connectionString: neonUrl });
    },
  },
});
