# Node.js Express backend Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose API port
EXPOSE 5000

# Set environment defaults
ENV PORT=5000 \
    NODE_ENV=production

# Start Express backend server
CMD ["node", "server.js"]
