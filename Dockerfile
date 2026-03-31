FROM mcr.microsoft.com/playwright:v1.58.0-noble

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy server and scraper code
COPY server/ ./server/
COPY scrapers/ ./scrapers/
COPY tsconfig.json ./

# Expose port
EXPOSE 3000

# Start the server
CMD ["npx", "ts-node", "server/index.ts"]
