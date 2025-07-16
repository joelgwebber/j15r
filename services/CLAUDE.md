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

### Common Architecture Pattern
1. **Database**: Cloud SQL PostgreSQL instance (`j15r-db`)
2. **Proxy**: Cloud SQL Proxy sidecar container for secure DB access
3. **Storage**: 
   - Miniflux: Stateless (all data in PostgreSQL)
   - Readeck: Persistent volume for bookmark archives
   - Bewcloud: Persistent volume for user files (20GB)
4. **Ingress**: GKE managed ingress with SSL certificates
5. **Health Checks**: Backend configs for proper load balancer health monitoring

## Deployment Commands

### Quick Deploy
```bash
# Deploy a specific service
make deploy-miniflux
make deploy-readeck
make deploy-bewcloud

# Deploy all services
make deploy-all

# Restart a service (rolling update)
make restart-miniflux
make restart-readeck
make restart-bewcloud
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