# Build Kuvira Expo web app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifest first for better Docker layer caching.
COPY package.json ./

# The repository has a local-development command guard as an npm lifecycle
# hook. Cloud Build installs the already-declared dependencies directly;
# Expo's web bundle does not require that hook to run.
RUN npm install --ignore-scripts

COPY . .

RUN npx expo export --platform web

# Serve static Expo web output
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Expo Router needs SPA fallback for client-side routes.
RUN printf '%s\n' \
  'server {' \
  '  listen 8080;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
