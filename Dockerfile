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
FROM nginx:alpine

WORKDIR /app

# Copy built files and nginx config template
COPY --from=builder /app/dist ./dist
COPY nginx.conf.template /tmp/nginx.conf.template

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Default PORT (Railway sets this at runtime)
ENV PORT=3000

# Substitute PORT in nginx config and start nginx
CMD sh -c "envsubst '\${PORT}' < /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
