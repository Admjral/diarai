# Frontend Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (excluding server folder)
COPY public ./public
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Production stage - use serve instead of nginx
FROM node:20-slim

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files
COPY --from=builder /app/dist ./dist

# Railway uses PORT env variable
ENV PORT=3000
EXPOSE ${PORT}

# Serve the app with SPA mode
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
