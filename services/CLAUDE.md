# Services Deployment Guide

## Overview

This directory contains Kubernetes deployments for self-hosted services running on GKE (Google Kubernetes Engine). All services follow consistent patterns for deployment, database connectivity, and ingress configuration.

## Architecture

### GKE Cluster
- **Project**: j15rpersonal  
- **Cluster**: gke_j15rpersonal_us-central1-a_j15r-cluster
- **Region**: us-central1-a

### Current Services
- **Miniflux**: RSS feed reader at https://flux.j15r.com
- **Readeck**: Read-it-later service at https://read.j15r.com
- **Bewcloud**: Personal cloud storage at https://cloud.j15r.com
- **Seafile**: File sync and share platform at https://files.j15r.com

### Common Architecture Pattern
1. **Database**: Cloud SQL PostgreSQL instance (`j15r-db`)
2. **Proxy**: Cloud SQL Proxy sidecar container for secure DB access
3. **Storage**:
   - Miniflux: Stateless (all data in PostgreSQL)
   - Readeck: Persistent volume for bookmark archives
   - Bewcloud: Persistent volume for user files (20GB)
   - Seafile: Persistent volume for file storage (50GB)
4. **Ingress**: GKE managed ingress with SSL certificates
5. **Health Checks**: Backend configs for proper load balancer health monitoring

## Deployment Commands

### Quick Deploy
```bash
# Deploy a specific service
make deploy-miniflux
make deploy-readeck
make deploy-bewcloud
make deploy-seafile

# Deploy all services
make deploy-all

# Restart a service (rolling update)
make restart-miniflux
make restart-readeck
make restart-bewcloud
make restart-seafile
```

### Manual kubectl Commands
```bash
# Apply all configs for a service
kubectl apply -f k8s/readeck/

# Check deployment status
kubectl rollout status deployment/readeck-deployment

# View logs
kubectl logs -l app=readeck --tail=50 -f

# Get pod details
kubectl describe pod -l app=readeck
```

## Service Configuration Standards

### 1. File Structure
Each service has its own directory under `k8s/` containing:
- `deployment.yaml` - Main application deployment
- `service.yaml` - Kubernetes service (usually NodePort for ingress)
- `ingress.yaml` - Ingress rules for external access
- `managed-cert.yaml` - Google-managed SSL certificate
- `frontend-config.yaml` - Frontend configuration (redirects, etc.)
- `backend-config.yaml` - Backend health checks (if needed)
- `pvc.yaml` - Persistent volume claim (if stateful)

### 2. Database Connection Pattern
All services use Cloud SQL Proxy as a sidecar container:
```yaml
- name: cloudsql-proxy
  image: gcr.io/cloudsql-docker/gce-proxy:1.33.14
  command:
    - /cloud_sql_proxy
    - -dir=/cloudsql
    - -instances=j15rpersonal:us-central1:j15r-db=tcp:5432
    - -credential_file=/secrets/cloudsql/credentials.json
```

Database URLs use localhost: `postgres://postgres:PASSWORD@127.0.0.1:5432/dbname?sslmode=disable`

### 3. Service Type Requirements
- Use `NodePort` for services behind ingress (not ClusterIP)
- Add backend config annotation for health checks:
  ```yaml
  annotations:
    cloud.google.com/backend-config: '{"default": "service-backend-config"}'
  ```

### 4. Health Check Configuration
Create a BackendConfig for services that redirect or need custom health checks:
```yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: service-backend-config
spec:
  healthCheck:
    checkIntervalSec: 10
    timeoutSec: 5
    type: HTTP
    requestPath: /path-that-returns-200-or-300s
```

### 5. SSL and Domain Management
- Domains follow pattern: `service.j15r.com`
- Use Google-managed certificates
- Frontend config handles HTTP→HTTPS redirect
- DNS managed externally (update TTL to 30m for changes)

## Common Issues and Solutions

### 502 Bad Gateway
1. Check pod logs: `kubectl logs -l app=service-name`
2. Verify service is NodePort, not ClusterIP
3. Check backend health: `kubectl describe backendconfig`
4. Ensure health check path returns 200-300 status codes

### SSL Errors After DNS Change
- DNS propagation can take 30+ minutes
- Clear local DNS cache: `sudo dscacheutil -flushcache`
- Test with: `curl -v https://domain.j15r.com/`

### Database Connection Issues
1. Verify Cloud SQL proxy is running: `kubectl logs <pod> -c cloudsql-proxy`
2. Check secret exists: `kubectl get secret cloudsql-instance-credentials`
3. Ensure database exists in Cloud SQL instance

## Adding a New Service

1. Create directory: `k8s/servicename/`
2. Copy template files from existing service
3. Update:
   - App labels and names
   - Container image
   - Port numbers
   - Database name
   - Domain name
   - Environment variables
4. Add to Makefile SERVICES list
5. Deploy: `make deploy-servicename`

## Best Practices

### Do's
- ✅ Use persistent volumes for stateful data
- ✅ Configure proper health checks
- ✅ Use NodePort services with ingress
- ✅ Follow existing naming patterns
- ✅ Test locally with `kubectl apply --dry-run=client`

### Don'ts
- ❌ Don't use ClusterIP for ingress services
- ❌ Don't use emptyDir for persistent data
- ❌ Don't expose secrets in logs
- ❌ Don't skip health check configuration
- ❌ Don't use NFS for SQLite databases

## Monitoring and Debugging

```bash
# View all resources for a service
kubectl get all -l app=readeck

# Check ingress status
kubectl describe ingress readeck-ingress

# View backend health
kubectl get backendconfig

# Check persistent volume claims
kubectl get pvc

# Execute commands in pod
kubectl exec -it <pod-name> -- /bin/sh
```

## Security Notes
- Database passwords are in deployments (consider using secrets)
- Cloud SQL uses private IP with proxy authentication
- All services use HTTPS with managed certificates
- Ingress handles SSL termination

## Service-Specific Notes

### Bewcloud
Bewcloud is a personal cloud storage solution with file management, notes, and photos capabilities.

#### Initial Setup
1. Create database: `CREATE DATABASE bewcloud;`
2. Deploy the service: `make deploy-bewcloud`
3. Run database migrations:
   ```bash
   POD=$(kubectl get pods -l app=bewcloud -o name | head -1 | cut -d/ -f2)
   kubectl exec $POD -c bewcloud -- bash -c "cd /app && make migrate-db"
   ```

#### Configuration
- Uses different environment variables than standard: `POSTGRESQL_*` instead of `POSTGRES_*`
- Requires `JWT_SECRET` and `PASSWORD_SALT` for authentication
- Config file mounted via ConfigMap at `/app/bewcloud.config.ts`
- Health check endpoint: `/login` (returns 200)

#### Storage Management
- User files stored in `/app/data-files/` 
- 20GB persistent volume attached
- Init container sets proper permissions (uid/gid 1993 for deno user)
- Directory structure: `/app/data-files/{user-uuid}/{Files,Notes,Photos,.Trash}/`

#### Common Issues
1. **Permission errors on file operations**
   - Solution: Init container runs `chown -R 1993:1993 /app/data-files`
   
2. **Database connection errors**
   - Check env vars: `POSTGRESQL_HOST`, `POSTGRESQL_USER`, `POSTGRESQL_PASSWORD`, `POSTGRESQL_DBNAME`
   - Ensure database exists and migrations are run

3. **502 errors on ingress**
   - Health check uses `/login` endpoint (not `/`)
   - Root path returns 303 redirect which was causing health check failures

#### Maintenance Commands
```bash
# Check logs
kubectl logs -l app=bewcloud -c bewcloud --tail=50

# Run database migrations
POD=$(kubectl get pods -l app=bewcloud -o name | head -1 | cut -d/ -f2)
kubectl exec $POD -c bewcloud -- bash -c "cd /app && make migrate-db"

# Check disk usage
kubectl exec -it $POD -c bewcloud -- df -h /app/data-files

# Access shell for troubleshooting
kubectl exec -it $POD -c bewcloud -- bash
```

### Seafile
Seafile is a file sync and share platform with desktop and mobile clients, similar to Dropbox but self-hosted.

#### Initial Setup
1. **Deploy the service** (uses Cloud SQL MySQL):
   ```bash
   make deploy-seafile
   ```

   Note: Seafile uses a Cloud SQL MySQL instance (`j15r-mysql`) for its database backend. Connection is handled via Cloud SQL Proxy sidecar container.

2. **Reserve static IP** (if not already done):
   ```bash
   gcloud compute addresses create seafile-ip --global
   ```

3. **Update DNS**:
   - Add A record for `files.j15r.com` pointing to the reserved IP
   - Wait for DNS propagation and SSL certificate provisioning (can take 15-30 minutes)

#### Configuration
- **Admin credentials**: Set via `SEAFILE_ADMIN_EMAIL` and `SEAFILE_ADMIN_PASSWORD` environment variables
- **Storage**: 50GB persistent volume for file data at `/shared`
- **Database**: Cloud SQL MySQL instance (`j15r-mysql`)
- **Components**:
  - Seafile server (file sync engine)
  - Seahub (web interface)
  - Cloud SQL Proxy (database connection)
  - Memcached (caching layer)
- **Ports**:
  - Port 80: Web interface (Seahub)
  - Port 8082: Seafile fileserver (internal)
- **Health checks**: Root path `/` returns 200 when ready

#### Features
- **File synchronization**: Real-time sync across devices with desktop/mobile clients
- **Selective sync**: Choose which folders to sync on each device
- **File versioning**: Automatic version history for all files
- **Sharing**: Share files/folders with links or other users
- **Library-based organization**: Separate libraries for different projects/purposes
- **Block-level deduplication**: Efficient storage using content-defined chunking
- **Delta sync**: Only sync changed parts of files

#### Client Setup
1. **Download clients**:
   - Desktop: https://www.seafile.com/en/download/
   - Mobile: Available on App Store and Google Play

2. **Server configuration**:
   - Server URL: `https://files.j15r.com`
   - Login with admin credentials

3. **Selective sync** (Desktop):
   - Right-click on library → "Sync this library"
   - Choose local folder
   - Select sub-folders to sync or use "Selective Sync"

#### Common Issues
1. **Database connection errors**:
   - Uses Cloud SQL MySQL via proxy sidecar
   - Ensure Cloud SQL Proxy is running: `kubectl logs -l app=seafile -c cloudsql-proxy --tail=20`
   - Database user `seafile` must exist with proper permissions

2. **File upload failures**:
   - Check persistent volume has sufficient space: `kubectl exec -it <pod> -- df -h /shared`
   - Verify nginx client_max_body_size if behind additional proxy

3. **Sync client connection issues**:
   - Ensure fileserver port (8082) is accessible internally
   - Check that `SEAFILE_SERVER_HOSTNAME` matches the public domain

#### Maintenance Commands
```bash
# Check logs
kubectl logs -l app=seafile -c seafile --tail=50

# Access Seafile shell
POD=$(kubectl get pods -l app=seafile -o name | head -1 | cut -d/ -f2)
kubectl exec -it $POD -c seafile -- bash

# Check storage usage
kubectl exec $POD -c seafile -- df -h /shared

# View Seafile server status
kubectl exec $POD -c seafile -- /opt/seafile/seafile-server-latest/seafile.sh status

# Garbage collection (clean deleted files)
kubectl exec $POD -c seafile -- /opt/seafile/seafile-server-latest/seaf-gc.sh

# Check memcached status
kubectl logs -l app=seafile -c memcached --tail=20

# Check Cloud SQL Proxy status
kubectl logs -l app=seafile -c cloudsql-proxy --tail=20

# Database operations via Cloud SQL
gcloud sql databases list --instance=j15r-mysql
gcloud sql backups list --instance=j15r-mysql
```