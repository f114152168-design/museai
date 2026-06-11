// Prisma client - only available when database is configured and prisma generate has been run
// For demo mode, this falls back to a simple storage adapter

export const prisma = null;

// When ready for production, uncomment:
// import { PrismaClient } from "@prisma/client";
// const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
// export const prisma = globalForPrisma.prisma ?? new PrismaClient();
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;