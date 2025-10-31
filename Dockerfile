# Dockerfile for Next.js standalone deployment
# Multi-stage build for optimal image size
#
# Note: This sets BUILD_STANDALONE=true during build to trigger
# the ternary in next.config.ts: output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined
# This allows normal Next.js builds (Vercel, local dev) to work without standalone mode

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application with standalone output enabled
# This sets BUILD_STANDALONE=true which triggers the ternary in next.config.ts
RUN BUILD_STANDALONE=true pnpm build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Note: We use Next.js's generated server.js from .next/standalone
# which is already copied above. No need for custom server.js
# since CORS is handled in next.config.ts

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3006

ENV PORT=3006
ENV HOSTNAME=0.0.0.0

# Start Next.js's generated standalone server
CMD ["node", "server.js"]

