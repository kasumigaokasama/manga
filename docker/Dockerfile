# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Install build dependencies (no vips - let sharp use prebuilt)
RUN apk add --no-cache python3 make g++

# Copy all package files for workspace resolution
COPY package.json package-lock.json ./
COPY app/frontend/package.json ./app/frontend/
COPY app/backend/package.json ./app/backend/

# Install all workspace dependencies
RUN npm ci

# Force cache invalidation for frontend source 
RUN echo "Cache bust: $(date +%s)" 

# Copy frontend source
COPY app/frontend ./app/frontend

# Build Angular app (from root using workspace command)
RUN npm run build -w app/frontend

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /build

# Install build dependencies for native modules (better-sqlite3)
# NOTE: Do NOT install vips-dev here - let sharp use prebuilt binaries
RUN apk add --no-cache python3 make g++

# Copy all package files for workspace resolution
COPY package.json package-lock.json ./
COPY app/frontend/package.json ./app/frontend/
COPY app/backend/package.json ./app/backend/

# Install all workspace dependencies
RUN npm ci

# Copy backend source
COPY app/backend ./app/backend

# Build TypeScript
RUN npm run build -w app/backend

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine AS production

# Install runtime dependencies
# vips (not vips-dev) for sharp runtime, poppler-utils for PDF covers
RUN apk add --no-cache \
    vips \
    poppler-utils \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S mangashelf && \
    adduser -u 1001 -S mangashelf -G mangashelf

WORKDIR /app

# Copy package files for production install
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/

# Install production dependencies only
RUN npm ci --workspace=app/backend --omit=dev && \
    npm cache clean --force

# Copy built assets
COPY --from=backend-builder /build/app/backend/dist ./app/backend/dist
COPY --from=frontend-builder /build/app/frontend/dist ./public

# Copy env example
COPY app/backend/.env.example ./app/backend/.env.example

# Create storage directories
RUN mkdir -p /app/storage/originals \
    /app/storage/pages \
    /app/storage/thumbnails \
    /app/storage/previews \
    /app/storage/db && \
    chown -R mangashelf:mangashelf /app

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/app/storage \
    MAX_UPLOAD_MB=512

# Switch to non-root user
USER mangashelf

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "app/backend/dist/main.js"]
