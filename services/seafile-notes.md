# Seafile Deployment Notes

## Overview
Seafile is a self-hosted file sync and share platform deployed on GKE (Google Kubernetes Engine). This document captures the deployment structure, configuration details, and issues encountered during setup.

## Deployment Architecture

### Components
The Seafile deployment consists of three containers in a single pod:
1. **Seafile Server** - Main application container (seafileltd/seafile-mc:11.0-latest)
2. **Cloud SQL Proxy** - Sidecar for MySQL database access (gcr.io/cloudsql-docker/gce-proxy:1.33.14)
3. **Memcached** - Caching layer (memcached:1.6-alpine)

### Database
- **Cloud SQL MySQL** - j15r-mysql instance (MySQL 8.0)
- **Connection**: Via Cloud SQL Proxy on localhost:3306
- **Databases**: ccnet_db, seafile_db, seahub_db

### Storage
- **Persistent Volume**: 50GB (standard-rwo storage class)
- **Mount Path**: `/shared` in Seafile container
- **Content**: Seafile file storage and configuration

### Networking
- **Service**: NodePort service exposing port 80
- **Ingress**: GKE managed ingress with Google-managed SSL certificate
- **Domain**: files.j15r.com
- **Static IP**: Reserved global IP (seafile-ip)

## Configuration Files

### Kubernetes Resources
```
k8s/seafile/
├── deployment.yaml       # Main deployment with 3 containers
├── pvc.yaml             # 50GB persistent volume claim
├── service.yaml         # NodePort service
├── backend-config.yaml  # Health check configuration
├── ingress.yaml        # Ingress rules for files.j15r.com
├── managed-cert.yaml   # SSL certificate
└── frontend-config.yaml # HTTPS redirect configuration
```

### Key Configuration Details

#### Environment Variables
```yaml
DB_HOST: "127.0.0.1"
DB_ROOT_PASSWD: "SeafileDB2024!"
SEAFILE_ADMIN_EMAIL: "admin@j15r.com"
SEAFILE_ADMIN_PASSWORD: "SeafileAdmin2024!"
SEAFILE_SERVER_HOSTNAME: "files.j15r.com"
SEAFILE_SERVER_LETSENCRYPT: "false"
NON_ROOT: "false"
FORCE_HTTPS_IN_CONF: "false"
```

#### Health Checks
- **Readiness Probe**: HTTP GET `/accounts/login/` on port 80
  - Initial delay: 90 seconds
  - Timeout: 5 seconds
  - Period: 10 seconds
- **Liveness Probe**: HTTP GET `/accounts/login/` on port 80
  - Initial delay: 180 seconds
  - Period: 30 seconds

## Issues Encountered and Resolutions

### 1. Permission Issues
**Problem**: Seafile container failed to start with error:
```
The permission of path seafile/ is incorrect.
To use non root, run [ chmod -R a+rwx /opt/seafile-data/seafile/ ]
```

**Initial Attempt**: Used init container with `chown -R 1000:1000 /shared`

**Resolution**:
- Changed init container to use `chmod -R a+rwx /shared`
- Set `NON_ROOT: "false"` in environment variables
- Eventually removed init container entirely when running as root

### 2. Database Choice
**Problem**: Seafile traditionally requires MySQL/MariaDB, but the cluster uses Cloud SQL PostgreSQL for other services.

**Initial Attempt**: Tried to use Cloud SQL Proxy with PostgreSQL

**Initial Resolution**: Deployed MariaDB as a sidecar container in the same pod, using a subPath of the persistent volume for database storage.

**Final Resolution**: Created a Cloud SQL MySQL instance (j15r-mysql) and migrated all data from embedded MariaDB. Now uses Cloud SQL Proxy sidecar to connect to Cloud SQL MySQL, providing centralized database management with automatic backups.

### 3. Seafile Services Not Starting
**Problem**: Container was running but Seafile services weren't actually starting - just running an idle loop.

**Analysis**: The seafile-mc image was running but not executing the actual Seafile services.

**Resolution**:
- Removed `NON_ROOT: "true"` environment variable
- Set `NON_ROOT: "false"` to allow proper service startup
- Services started automatically after this change

### 4. Readiness Probe Failures
**Problem**: Readiness probe kept failing with timeout errors, pod never became ready.

**Initial Issue**: Root path `/` returned 302 redirect to `/accounts/login/`, but probe expected 200.

**Resolution**:
- Changed probe path from `/` to `/accounts/login/`
- Increased timeout from 1 second to 5 seconds
- Increased initial delay from 60 to 90 seconds
- Updated backend-config health check path to match

### 5. Volume Attachment Issues
**Problem**: Multiple pods trying to attach the same RWO (ReadWriteOnce) volume, causing pods to stuck in ContainerCreating.

**Cause**: Rolling updates and multiple replica sets trying to claim the same volume.

**Resolution**:
- Scaled deployment to 0 replicas
- Deleted stuck pods manually
- Scaled back to 1 replica
- Ensured only one pod runs at a time (RWO volume limitation)

### 6. CSRF Verification Failed
**Problem**: Login attempts failed with "CSRF verification failed" error when accessing via HTTPS.

**Cause**: Seafile was configured with `SERVICE_URL = "http://files.j15r.com"` but being accessed via HTTPS.

**Resolution**: Updated `/shared/seafile/conf/seahub_settings.py`:
```python
SERVICE_URL = "https://files.j15r.com"
FILE_SERVER_ROOT = "https://files.j15r.com/seafhttp"
CSRF_TRUSTED_ORIGINS = ["https://files.j15r.com"]
```

### 7. Memcached Connection Errors
**Problem**: "Page unavailable" error with logs showing:
```
pylibmc.ServerDown: error 47 from memcached_get: SERVER HAS FAILED AND IS DISABLED UNTIL TIMED RETRY
```

**Cause**: Seahub configured to connect to `memcached:11211` but memcached running on localhost.

**Resolution**: Updated `/shared/seafile/conf/seahub_settings.py`:
```python
CACHES = {
    'default': {
        'BACKEND': 'django_pylibmc.memcached.PyLibMCCache',
        'LOCATION': '127.0.0.1:11211',  # Changed from 'memcached:11211'
    },
}
```

## Deployment Commands

### Initial Deployment
```bash
# Reserve static IP
gcloud compute addresses create seafile-ip --global --project=j15rpersonal

# Get the allocated IP
gcloud compute addresses describe seafile-ip --global --project=j15rpersonal --format="value(address)"

# Deploy to Kubernetes
make deploy-seafile
```

### Configuration Updates
Since configuration is stored in the persistent volume, updates persist across pod restarts:

```bash
# Get pod name
POD=$(kubectl get pods -l app=seafile -o name | head -1 | cut -d/ -f2)

# Edit configuration
kubectl exec $POD -c seafile -- vi /shared/seafile/conf/seahub_settings.py

# Restart pod to apply changes
kubectl delete pod $POD
```

### Troubleshooting Commands
```bash
# Check pod status
kubectl get pods -l app=seafile

# View Seafile logs
kubectl logs -l app=seafile -c seafile --tail=50

# View Seahub error logs
kubectl exec $POD -c seafile -- tail -50 /shared/seafile/logs/seahub.log

# Check MariaDB logs
kubectl logs -l app=seafile -c mariadb --tail=50

# Check memcached logs
kubectl logs -l app=seafile -c memcached --tail=20

# Test service locally
kubectl exec $POD -c seafile -- curl -I http://localhost/accounts/login/

# Check SSL certificate status
kubectl get managedcertificate seafile-cert
```

## Maintenance Notes

### Persistent Configuration
Configuration changes made to files in `/shared/seafile/conf/` persist across pod restarts because they're stored on the persistent volume. Key files:
- `/shared/seafile/conf/seahub_settings.py` - Main Django settings
- `/shared/seafile/conf/seafile.conf` - Seafile server configuration
- `/shared/seafile/conf/ccnet.conf` - Network configuration

### Scaling Limitations
Due to the RWO (ReadWriteOnce) persistent volume, only one pod can run at a time. For high availability, would need to:
1. Use a ReadWriteMany storage class (like Filestore)
2. Or implement Seafile's cluster mode with shared backend storage (S3/GCS)

### Database Backup
Database is automatically backed up by Cloud SQL MySQL. For manual backups:
```bash
# Cloud SQL automatic backups
gcloud sql backups list --instance=j15r-mysql

# Manual backup via gcloud
gcloud sql backups create --instance=j15r-mysql

# Export to local file if needed
gcloud sql export sql j15r-mysql gs://BUCKET_NAME/seafile-backup.sql --database=ccnet_db,seafile_db,seahub_db
```

## Access Information

- **URL**: https://files.j15r.com
- **Admin Email**: admin@j15r.com
- **Admin Password**: SeafileAdmin2024!
- **Static IP**: 34.49.161.89

## Lessons Learned

1. **Container Images**: The seafileltd/seafile-mc image requires specific environment variables and expects to run as root by default.

2. **Health Checks**: Must account for redirects - use the final destination URL for probes.

3. **Multi-Container Pods**: When running multiple services in one pod, ensure they communicate via localhost (127.0.0.1) not service names.

4. **Persistent Volumes**: RWO volumes can cause deployment issues during rolling updates - consider scaling strategies.

5. **HTTPS Configuration**: When behind a load balancer doing SSL termination, ensure the application knows it's being accessed via HTTPS to avoid CSRF issues.

6. **Configuration Persistence**: Storing configuration on persistent volumes means changes survive pod restarts but requires manual pod deletion to apply changes.