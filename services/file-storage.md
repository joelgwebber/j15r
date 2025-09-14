> I'm looking into solutions for remote file storage, à la Dropbox, Google Drive, et al, but self-hosted. My needs are *very* simple: self-hosting, preferably on GCP through kube & GCS or durable attached storage; efficient, reliable mirroring on multiple local devices (either a full-copy or virtualized if possible); a simple web UI and API access (or following a well-known protocol, just *not* WebDAV).

> I *don't* need: complex document editing, image editing, integrations with other platforms, etc. I just need to keep it simple.

Looking at your requirements, I have a few clarifying questions to help focus the research on the best solutions for your setup:

1. For client sync: Do you need real-time sync like Dropbox (files appear instantly on all devices) or is periodic sync acceptable?

2. For the web UI: Do you need any file preview capabilities (viewing PDFs, images, text files in browser) or just basic upload/download/organize functionality?

3. Storage scale: Roughly how much data are you planning to store? This affects whether certain lightweight solutions would work well.

Once I have these details, I'll dive deep into researching self-hosted file storage solutions that work well with GCP/Kubernetes and meet your specific requirements!

> I'd prefer ~instant sync, but periodic is acceptable as long as the period isn't too long. I'm skeptical of tools like `rsync` because of past difficulties with things getting weird, files out of sync, `cron` jobs getting lost, etc. But I'm open to the concept if there's a coherent approach that addresses these issues.

> I really don't need much from the web UI. Image/PDF preview would be nice, but not strictly necessary. In fact, if there's a straightforward API, I'm happy to build my own UI if I need to.

> For scale, I'd like it to be unbounded (relative to my willingness to pay for storage). If the solution allows for virtualized local copies (i.e., subsets of the full repository, on demand), then the sky's the limit. If not, then I'd probably want a good way to create separate mappings for different devices (e.g., sync images/ but not archive/ to this device).

# Self-hosted file storage solutions for GCP Kubernetes environments

Based on extensive research into modern self-hosted file storage platforms that meet your specific requirements for reliable sync, GCP/Kubernetes deployment, and advanced selective sync capabilities, three solutions emerge as optimal candidates: **Seafile**, **ownCloud Infinite Scale**, and **Rclone with MinIO**. Each addresses your core concerns about sync reliability while offering distinct advantages for containerized deployments.

## Why modern solutions avoid the rsync "sync getting weird" problem

Your skepticism about rsync/cron approaches is well-founded. Traditional rsync suffers from **timing problems** when files change during sync operations, lacks state awareness between runs, and provides only simple timestamp-based conflict resolution. Modern file storage solutions have fundamentally solved these issues through **event-driven architectures** using inotify (Linux) and FSEvents (macOS) for real-time change detection, **block-level delta synchronization** that transfers only changed portions, and **sophisticated conflict resolution** with version vectors and atomic operations. These systems maintain persistent sync state, handle network interruptions gracefully with resumable transfers, and provide intelligent batching to avoid sync storms during bulk operations.

## Top recommendation: Seafile with GCS backend

**Seafile** stands out as the most battle-tested solution for your requirements. Its **delta synchronization** mechanism analyzes files for changes and syncs only differences at the block level, using Content-Defined Chunking (CDC) to split files into ~8MB blocks with rolling hash algorithms. This approach fundamentally avoids rsync's limitations while providing **system-wide deduplication** across all libraries and users.

For GCP/Kubernetes deployment, Seafile offers mature Helm charts with StatefulSet configurations that work seamlessly with GCS through S3-compatible interfaces or rclone integration. The architecture uses separate pods for MariaDB, Memcached, and Seafile services, allowing independent scaling of each component. Critical for your reliability requirements, Seafile provides **atomic operations** for all sync activities, automatic retry mechanisms for failed operations, and library-based isolation that prevents cross-contamination of sync issues.

**Selective sync implementation**: Seafile's SeaDrive client provides virtual drive mapping where files exist as placeholders until accessed, with on-demand downloading and configurable "always-sync" folders for specific content. The library-based architecture allows different sync mappings per device - you can sync your images/ folder to one device while excluding archive/ folders, all managed through sub-folder selective sync controls in the desktop client.

**Technical deployment on GKE**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: seafile-server
spec:
  serviceName: seafile-headless
  replicas: 3
  template:
    spec:
      containers:
      - name: seafile
        volumeMounts:
        - name: seafile-data
          mountPath: /shared
  volumeClaimTemplates:
  - metadata:
      name: seafile-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gcs-fuse-performance
      resources:
        requests:
          storage: 100Gi
```

**API access**: Seafile provides comprehensive REST APIs for all operations, explicitly **NOT using WebDAV** as its primary protocol. The API supports file operations, sharing, versioning, and administrative functions with well-documented endpoints.

## Cloud-native alternative: ownCloud Infinite Scale

**ownCloud Infinite Scale (oCIS)** represents the most architecturally advanced option, built from scratch as a cloud-native microservices platform in Go. Its **event-driven synchronization** uses NATS messaging for real-time updates, completely eliminating periodic sync issues. The CS3 APIs with gRPC provide efficient binary communication between services, while the TUS protocol handles resumable uploads for large files.

The platform excels in Kubernetes environments with its stateless microservices that can be scaled independently. For GCS integration, oCIS provides full support through S3-compatible interfaces with automatic data tiering between local and cloud storage based on policies. The federated storage spaces model allows unbounded scaling by breaking down storage into independently manageable units.

**Virtual Files implementation**: On Windows, oCIS provides native File Provider API integration similar to OneDrive, where files exist as placeholders showing actual size and type until accessed. Users can mark specific folders for permanent local sync or convert synced files back to placeholders with "Free up space" commands. Linux and macOS support remains experimental but functional.

**Key advantage**: The microservices architecture provides exceptional reliability through service isolation - a sync issue in one component doesn't affect others, and the supervisor automatically handles service recovery.

## Power user option: Rclone VFS with MinIO backend

For maximum flexibility and control, combining **Rclone's advanced VFS caching** with **MinIO** as an S3-compatible layer provides unparalleled customization options. Rclone offers four distinct cache modes, with the "full" mode providing sparse file support that only downloads accessed portions of files.

**Advanced selective sync**: Rclone's extensive filter system allows precise control over what syncs to each device through `--exclude`, `--include`, and `--filter` options applied at mount time. Combined with per-device configuration files specified via environment variables, you can create sophisticated sync mappings:

```bash
# Device-specific mount with selective sync
rclone mount gcs:bucket /mnt/storage \
  --vfs-cache-mode full \
  --vfs-cache-max-size 50G \
  --vfs-read-ahead 256M \
  --filter="+ images/**" \
  --filter="- archive/**" \
  --vfs-cache-max-age 24h
```

MinIO provides the S3-compatible API layer with proven Kubernetes deployment through its Operator, supporting horizontal scaling, erasure coding for data protection, and native GCS tiering for cold storage. The combination gives you complete control over sync behavior while maintaining enterprise-grade reliability.

**GKE optimization**: Deploy MinIO with the official Operator for automated tenant management, using regional persistent disks for high availability and GCS for object storage tiering. The GCS FUSE CSI Driver provides optimal integration:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gcs-fuse-performance
provisioner: gcsfuse.csi.storage.gke.io
mountOptions:
  - file-cache:max-size-mb:-1
  - metadata-cache:ttl-secs:-1
  - file-cache:enable-parallel-downloads:true
```

## Critical implementation considerations

**GCS FUSE CSI Driver optimization** is essential regardless of chosen solution. Enable Hierarchical Namespace (HNS) buckets for 8x performance improvement, configure aggressive metadata caching to reduce API calls, and use local SSD caching for frequently accessed files. The driver supports `ReadWriteMany` access modes crucial for multi-pod deployments.

**Reliability architecture patterns** should include StatefulSets over Deployments for persistent storage requirements, multi-zone pod distribution using anti-affinity rules, and automatic backup to GCS with versioning enabled. Implement Workload Identity Federation for secure GCS access without service account keys.

**Performance tuning** requires attention to mount-specific directories with `only-dir` flags to reduce metadata overhead, parallel downloads for files over 1GB, and kernel read-ahead configuration (`read_ahead_kb=1024`) for sequential access patterns.

## Limitations and trade-offs

**Seafile** requires understanding its library-based model which may not suit all workflows, and direct file access on the backend storage isn't possible due to its block storage format. **ownCloud Infinite Scale**, while architecturally superior, has experimental VFS support on Linux/macOS and requires more complex initial setup due to its microservices nature. The **Rclone/MinIO** combination demands significant configuration expertise and ongoing maintenance but provides maximum flexibility.

All solutions fundamentally solve your sync reliability concerns through modern architectures that monitor filesystem events in real-time, maintain persistent sync state, and handle conflicts intelligently. The choice depends on whether you prioritize proven reliability (Seafile), cloud-native architecture (oCIS), or maximum configurability (Rclone/MinIO).

## Deployment recommendation

Start with Seafile for its proven track record and straightforward deployment, using the official Helm chart with GCS backend configuration. If you need more advanced virtual file capabilities on Windows or prefer a microservices architecture, migrate to ownCloud Infinite Scale once comfortable with the Kubernetes deployment patterns. Reserve the Rclone/MinIO option for scenarios requiring extreme customization or when integrating with existing S3-compatible workflows.

Configure the GCS FUSE CSI Driver with aggressive caching parameters, deploy using StatefulSets for data persistence, and implement comprehensive monitoring through Cloud Operations Suite to track sync performance and identify potential issues before they impact users.
