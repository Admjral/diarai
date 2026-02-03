# Frontend Dockerfile (NOT for backend!)
FROM node:20-slim AS builder

WORKDIR /app

# Copy only frontend files (not server/)
COPY package*.json ./
COPY public ./public
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./

# Install dependencies
RUN npm install

# Build the app with API URL
ARG VITE_API_URL=https://backend-production-be6a0.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install serve
RUN npm install -g serve@14

# Copy only built files
COPY --from=builder /app/dist ./dist

# Serve static files on Railway's PORT
CMD serve -s dist -l ${PORT:-3000}
