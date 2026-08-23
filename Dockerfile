# Production Dockerfile for Sia AI Orchestrator
FROM node:20-alpine AS base

# Install curl for healthcheck and system dependencies
RUN apk add --no-cache curl python3 make g++

WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts || npm install --omit=dev

# Copy application source
COPY client ./client
COPY server ./server
COPY data ./data

# Ensure data storage directories exist
RUN mkdir -p data/memory data/device/screenshots

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Expose server and websocket port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["npm", "start"]
