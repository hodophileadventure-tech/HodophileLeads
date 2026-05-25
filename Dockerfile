# Stage 1: Build Backend
FROM node:20-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/jest.config.js ./
RUN npm run build

# Stage 2: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts ./
COPY frontend/index.html ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 3: Runtime - Nginx + Backend
FROM nginx:1.27-alpine

# Install Node.js on top of nginx image
RUN apk add --no-cache nodejs npm

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create proper nginx config file
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    # Frontend static files
    location ~ ^/(assets|public)/ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve index.html for SPA
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:5000;
    }
}
NGINX_EOF

# Copy frontend build
COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html

# Setup backend
RUN mkdir -p /app/backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /build/backend/dist ./dist
COPY backend/scripts ./scripts

ENV NODE_ENV=production
ENV PORT=5000

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app
EXPOSE 80

CMD ["/app/start.sh"]
