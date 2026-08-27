# ==========================================
# SkyCast Weather Frontend - Dockerfile
# ==========================================
# Stage 1: Build Production Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build


# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:alpine AS runner

WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built production assets from builder stage
COPY --from=builder /app/dist .

# Copy custom Nginx SPA and reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
