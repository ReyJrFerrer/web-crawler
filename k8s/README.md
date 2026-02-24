# Kubernetes Deployment Strategy & Architecture Plan

## Architecture Overview

For a massive scalable system, decoupling the heavy lifting workers (fetchers) from the API/Dashboard is crucial.

1. **Crawler Fetcher (Workers):**
   - The main engines downloading and parsing pages, running headless browsers.
   - Deployed as a scalable `Deployment` with dynamic replicas via CLI or HPA.
   - Requires substantial CPU/Memory allocations.
   - Headless: Does not expose any HTTP ports.

2. **Crawler API (Backend Interface):**
   - The BFF (Backend-For-Frontend) powering the Dashboard, exposing REST metrics, queue controls, and stored data.
   - Deployed as a singleton or small replica set.
   - Exposed externally to the internet or internal network via a `LoadBalancer` or `Ingress`.
   - Any standalone frontend (React, Vue) can simply connect to this API service endpoint.

3. **External State:**
   - **Redis (BullMQ):** Acts as the URL Frontier. Must be externalized to a highly available Redis Cluster (e.g., DigitalOcean Managed Redis).
   - **MongoDB:** Stores extracted metadata. External managed database (e.g., DigitalOcean Managed MongoDB).
   - **Object Storage (S3 / Spaces):** High-volume raw HTML storage. DigitalOcean Spaces.

## Local Prototyping (Docker Desktop)

The `local/` manifests rely on an existing `docker-compose` stack running Redis and MongoDB locally, accessible via `host.docker.internal`.

1. **Build Local Image:**
   ```bash
   docker build -t web-crawler:local .
   ```

2. **Apply Manifests:**
   ```bash
   kubectl apply -f k8s/local/configmap.yaml
   kubectl apply -f k8s/local/deployment.yaml
   ```

3. **Scale Locally using CLI:**
   ```bash
   bun run src/cli/scale.ts
   ```

## DigitalOcean Kubernetes (DOKS) Strategy

1. **Push to Container Registry:**
   ```bash
   docker build -t registry.digitalocean.com/your-registry/web-crawler:latest .
   docker push registry.digitalocean.com/your-registry/web-crawler:latest
   ```

2. **Configure Secrets:**
   Update `k8s/doks/secret.yaml` with your DO Managed Redis, Mongo, and Spaces credentials. DO NOT commit this to version control.

3. **Deploy:**
   ```bash
   kubectl apply -f k8s/doks/secret.yaml
   kubectl apply -f k8s/doks/configmap.yaml
   kubectl apply -f k8s/doks/api-deployment.yaml
   kubectl apply -f k8s/doks/deployment.yaml
   ```

4. **Access the Backend Interface:**
   Use `kubectl get svc crawler-api-service` to retrieve the external LoadBalancer IP assigned by DigitalOcean.
   Point any decoupled frontend dashboard to this IP address.
