# Dockerfile for Next.js standalone deployment
# Multi-stage build for optimal image size
#
# Note: This sets BUILD_STANDALONE=true during build to trigger
# the ternary in next.config.ts: output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined
# This allows normal Next.js builds (Vercel, local dev) to work without standalone mode
#
# The standalone build creates its own optimized server.js in .next/standalone/
# which includes all necessary dependencies and API routes

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

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output (includes node_modules and server)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start the standalone server (it has its own server built-in)
CMD ["node", "server.js"]

