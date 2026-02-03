# Frontend Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy everything except what's in .dockerignore
COPY . .

# Install dependencies
RUN npm install

# Build the app with API URL
ARG VITE_API_URL=https://backend-production-be6a0.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install serve for static file hosting
RUN npm install -g serve@14

# Copy built files
COPY --from=builder /app/dist ./dist

# Railway uses PORT env variable
EXPOSE ${PORT:-3000}

# Serve the app with SPA mode on dynamic PORT
CMD serve -s dist -l ${PORT:-3000}
