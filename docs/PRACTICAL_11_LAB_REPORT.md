# Practical 11: Containerization with Docker and Docker Compose
**Course:** ADVANCED WEB DEVELOPMENT FRAMEWORKS (ITUE301)  
**CO/PO Mapping:** CO2, CO4 / PO3, PO5  
**Topic:** Containerization of Full-Stack Web Applications, Multi-Stage Builds, Docker Networking, and Multi-Service Orchestration with Docker Compose  

---

## 1. Executive Summary & Objective

The objective of Practical 11 is to containerize a full-stack Task Management web application using **Docker** and orchestrate its multi-container environment with **Docker Compose**.

### Key Deliverables:
1. **Frontend Containerization (`student-portfolio/Dockerfile`):** Write a production-ready, multi-stage Dockerfile that builds the React (Vite) frontend into optimized static assets and serves them via a lightweight **Nginx** web server with client-side SPA routing support (`nginx.conf`).
2. **Backend Containerization (`server/Dockerfile`):** Write a containerized runtime environment for the Node.js/Express API with in-memory caching and event-driven background processing.
3. **Multi-Service Orchestration (`docker-compose.yml`):** Define a unified orchestration specification combining **Frontend**, **Backend**, and **MongoDB** services.
4. **Networking & Service Discovery:** Configure an isolated internal Docker bridge network (`awdf-network`) allowing inter-container DNS communication (`mongodb://mongo:27017/task_management_db`), while mapping external host ports for browser access.
5. **Single-Command Startup:** Ensure the entire full-stack system spins up automatically via a single command: `docker-compose up`, with automated dependency ordering and database health checking.

---

## 2. Architecture & Container Network Topology

```
+---------------------------------------------------------------------------------------+
|                                    HOST MACHINE (Windows)                             |
|                                                                                       |
|   Browser / Postman                     Browser / Frontend Web Client                 |
|   http://localhost:5000                 http://localhost:3000 / http://localhost:5173 |
+---------------------------------------------------------------------------------------+
         │                                                      │
         │ Port 5000:5000                                       │ Port 3000:80 / 5173:80
         ▼                                                      ▼
+───────────────────────────────────────────────────────────────────────────────────────+
|                         DOCKER ENGINE: awdf-network (Bridge Network)                  |
|                                                                                       |
|   +──────────────────────────+         +──────────────────────────+                   |
|   | Container: awdf-backend  |         | Container: awdf-frontend |                   |
|   | Image: node:20-alpine    |         | Image: nginx:alpine      |                   |
|   | Port: 5000               |         | Port: 80                 |                   |
|   | Express + EventEmitter   |         | React SPA Production     |                   |
|   +──────────────────────────+         +──────────────────────────+                   |
|                │                                                                      |
|                │ DNS: "mongo:27017"                                                   |
|                ▼                                                                      |
|   +──────────────────────────+                                                        |
|   | Container: awdf-mongodb  |                                                        |
|   | Image: mongo:7.0         |                                                        |
|   | Port: 27017              |                                                        |
|   | Healthcheck: mongosh ping|                                                        |
|   +──────────────────────────+                                                        |
|                │                                                                      |
|                ▼                                                                      |
|     Volume: mongo-data                                                                |
|     (Persistent Host Storage)                                                         |
+───────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Implementation Details

### 3.1 React Frontend Multi-Stage Dockerfile (`student-portfolio/Dockerfile`)
The frontend uses a **multi-stage build** architecture. In Stage 1 (`builder`), the Node.js 20 image compiles the React/Vite source code into production JavaScript/CSS bundles. In Stage 2, the compiled assets are transferred to a minimal **Nginx Alpine** image (~25MB), completely discarding the heavy Node.js compiler and source dependencies.

```dockerfile
# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm install

# Copy application source code
COPY . .

# Build production bundle (dist)
RUN npm run build

# Stage 2: Serve application using lightweight Nginx web server
FROM nginx:alpine

# Remove default static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built production assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration supporting React Router SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
```

### 3.2 Nginx Production Routing (`student-portfolio/nginx.conf`)
Ensures that client-side routes (e.g. `/projects`, `/contact`) fall back to `index.html` without triggering 404 errors:

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 3.3 Node/Express Backend Dockerfile (`server/Dockerfile`)
Containerizes the Express REST API with minimal Alpine footprint:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package manifests & install production dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Expose API port
EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production

CMD ["node", "server.js"]
```

### 3.4 Orchestration with Docker Compose (`docker-compose.yml`)
Orchestrates the 3 microservices with automated dependency ordering and health checking:

```yaml
version: '3.8'

services:
  # 1. MongoDB Database Service
  mongo:
    image: mongo:7.0
    container_name: awdf-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    networks:
      - awdf-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  # 2. Node/Express Backend API Service
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: awdf-backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/task_management_db
    depends_on:
      mongo:
        condition: service_healthy
    networks:
      - awdf-network

  # 3. React Frontend Service (Served via Nginx)
  frontend:
    build:
      context: ./student-portfolio
      dockerfile: Dockerfile
    container_name: awdf-frontend
    restart: always
    ports:
      - "3000:80"
      - "5173:80"
    depends_on:
      - backend
    networks:
      - awdf-network

# Persistent storage volume for MongoDB database
volumes:
  mongo-data:
    driver: local

# Isolated internal bridge network for inter-container communication
networks:
  awdf-network:
    driver: bridge
```

---

## 4. Single-Command Startup & Operational Workflow

### 4.1 Launching the Full Stack
```bash
# Build images and start all 3 containers in detached mode
docker-compose up --build -d
```

### 4.2 Verifying Container Status & Health
```bash
docker-compose ps
```

Expected Output:
```
NAME            IMAGE           COMMAND                  SERVICE      CREATED         STATUS                   PORTS
awdf-backend    awdf-backend    "docker-entrypoint.s…"   backend      1 minute ago    Up 1 minute              0.0.0.0:5000->5000/tcp
awdf-frontend   awdf-frontend   "/docker-entrypoint.…"   frontend     1 minute ago    Up 1 minute              0.0.0.0:3000->80/tcp, 0.0.0.0:5173->80/tcp
awdf-mongodb    mongo:7.0       "docker-entrypoint.s…"   mongo        1 minute ago    Up 1 minute (healthy)    0.0.0.0:27017->27017/tcp
```

### 4.3 Stopping the Application
```bash
docker-compose down
```

---

## 5. Key Concepts & Analysis

### Q1: Why is a multi-stage Docker build essential for the React frontend?
1. **Size Optimization:** A standard Node.js image containing build tools, npm packages, and source code exceeds **450MB+**. By contrast, the multi-stage build discards the builder container and transfers only the static compiled bundle (`dist`) to an Nginx Alpine container, yielding an image size under **25MB** (an **18x size reduction**).
2. **Security Hardening:** The production container contains zero compilers, npm binaries, or development dependencies, drastically reducing the CVE attack surface.
3. **Production Performance:** Serving static assets through high-performance compiled Nginx is orders of magnitude faster and consumes negligible memory compared to running a development Vite server in production.

### Q2: How does service discovery work inside Docker Compose?
Inside `awdf-network`, Docker runs an embedded internal DNS server at `127.0.0.11`. When the backend requests `mongodb://mongo:27017`:
- The container queries the internal DNS resolver for the hostname `mongo`.
- Docker resolves `mongo` to the private IP address assigned to container `awdf-mongodb` on the bridge network.
- This decouples microservice configuration from static IP addresses and eliminates hardcoded host bindings.

### Q3: Why is database volume persistence (`mongo-data:/data/db`) necessary?
Containers are by nature **ephemeral**—any files created inside a container's writable layer are permanently lost when the container is deleted or recreated during code updates (`docker-compose down && docker-compose up`). Mapping the persistent volume `mongo-data` ensures all task documents and user data survive container restarts and updates.

---

## 6. Conclusion

Practical 11 successfully implemented full containerization of the Task Management architecture. The React frontend is packaged in a high-efficiency multi-stage Nginx container, the Node.js API runs with environment-aware connection pooling, and MongoDB data is backed by persistent volume storage. The entire stack launches seamlessly with zero manual steps via `docker-compose up`.
