# Kubernetes Architecture Guide

This guide explains how to deploy the Agnostic Automation Center on Kubernetes, mapping the Docker Compose services to Kubernetes resources.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Ingress        │    │   Ingress        │                   │
│  │   (Dashboard)    │    │   (API)          │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Dashboard      │    │   Producer       │                   │
│  │   Deployment     │    │   Deployment     │                   │
│  │   (nginx)        │    │   (Node.js)      │                   │
│  └──────────────────┘    └────────┬─────────┘                   │
│                                   │                              │
│           ┌───────────────────────┼───────────────────────┐      │
│           │                       │                       │      │
│           ▼                       ▼                       ▼      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────┐│
│  │   Worker         │    │   RabbitMQ       │    │   Redis     ││
│  │   Deployment     │    │   StatefulSet    │    │   StatefulSet│
│  │   (Node.js)      │    │                  │    │             ││
│  └────────┬─────────┘    └──────────────────┘    └─────────────┘│
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │   Docker-in-      │                                           │
│  │   Docker (DinD)   │                                           │
│  │   DaemonSet       │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│           ┌──────────────────────────────────────────────┐      │
│           │             External Services                 │      │
│           │  ┌─────────────┐    ┌─────────────┐          │      │
│           │  │  MongoDB    │    │  SendGrid   │          │      │
│           │  │  Atlas      │    │  (Email)    │          │      │
│           │  └─────────────┘    └─────────────┘          │      │
│           └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Mapping

### From Docker Compose to Kubernetes

| Docker Compose Service | Kubernetes Resource | Reason |
|------------------------|---------------------|--------|
| `producer` | **Deployment** + Service | Stateless API server, horizontally scalable |
| `worker` | **Deployment** + Service | Stateless job processor, scalable |
| `dashboard` | **Deployment** + Service | Static files served by nginx |
| `docs` | **Deployment** + Service | Static Docusaurus site |
| `rabbitmq` | **StatefulSet** + Service | Persistent message queue |
| `redis` | **StatefulSet** + Service | Persistent cache/rate limiting |
| `npm` (nginx proxy) | **Ingress Controller** | Use existing cluster ingress |

---

## Recommended Configuration

### 1. Producer Service (Deployment)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: producer
  labels:
    app: automation-producer
spec:
  replicas: 2  # Scale based on load
  selector:
    matchLabels:
      app: automation-producer
  template:
    metadata:
      labels:
        app: automation-producer
    spec:
      containers:
      - name: producer
        image: your-registry/automation-producer:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: rabbitmq-url
        - name: MONGO_URI
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: mongo-uri
        - name: REDIS_URL
          value: "redis://redis:6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. Worker Service (Deployment)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  labels:
    app: automation-worker
spec:
  replicas: 2  # Scale based on job queue depth
  selector:
    matchLabels:
      app: automation-worker
  template:
    metadata:
      labels:
        app: automation-worker
    spec:
      containers:
      - name: worker
        image: your-registry/automation-worker:latest
        env:
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: rabbitmq-url
        - name: MONGO_URI
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: mongo-uri
        - name: PRODUCER_URL
          value: "http://producer:3000"
        # Docker-in-Docker setup
        - name: DOCKER_HOST
          value: "tcp://localhost:2375"
        volumeMounts:
        - name: reports
          mountPath: /app/reports
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      # Sidecar: Docker-in-Docker
      - name: dind
        image: docker:dind
        securityContext:
          privileged: true
        volumeMounts:
        - name: dind-storage
          mountPath: /var/lib/docker
      volumes:
      - name: reports
        persistentVolumeClaim:
          claimName: reports-pvc
      - name: dind-storage
        emptyDir: {}
```

### 3. RabbitMQ (StatefulSet)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
spec:
  serviceName: rabbitmq
  replicas: 1  # Or 3 for HA cluster
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3-management
        ports:
        - containerPort: 5672
          name: amqp
        - containerPort: 15672
          name: management
        env:
        - name: RABBITMQ_DEFAULT_USER
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: rabbitmq-user
        - name: RABBITMQ_DEFAULT_PASS
          valueFrom:
            secretKeyRef:
              name: automation-secrets
              key: rabbitmq-pass
        volumeMounts:
        - name: rabbitmq-data
          mountPath: /var/lib/rabbitmq
  volumeClaimTemplates:
  - metadata:
      name: rabbitmq-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### 4. Redis (StatefulSet or Managed)

For production, consider using a managed Redis service (AWS ElastiCache, Redis Cloud).

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes"]
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 5Gi
```

---

## Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: automation-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - agnox.dev
    - api.agnox.dev
    - docs.agnox.dev
    secretName: automation-tls
  rules:
  - host: agnox.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: dashboard
            port:
              number: 80
  - host: api.agnox.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: producer
            port:
              number: 3000
  - host: docs.agnox.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: docs
            port:
              number: 80
```

---

## Secrets Management

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: automation-secrets
type: Opaque
stringData:
  mongo-uri: "<REDACTED_MONGO_URI>"
  rabbitmq-url: "amqp://user:pass@rabbitmq:5672"
  rabbitmq-user: "admin"
  rabbitmq-pass: "secure-password"
  jwt-secret: "your-64-char-jwt-secret"
  sendgrid-api-key: "SG.xxxx"
  gemini-api-key: "<REDACTED_GOOGLE_API_KEY>"
```

> **Important:** Use a secrets management solution like HashiCorp Vault, AWS Secrets Manager, or Sealed Secrets for production.

---

## Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: producer-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: producer
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Recommended Managed Services

For production deployments, consider using managed services:

| Service | Managed Alternative |
|---------|---------------------|
| MongoDB | MongoDB Atlas |
| Redis | AWS ElastiCache, Redis Cloud |
| RabbitMQ | Amazon MQ, CloudAMQP |
| Container Registry | AWS ECR, GCR, Docker Hub |

---

## Migration Checklist

- [ ] Create Kubernetes namespace (`automation-prod`)
- [ ] Configure secrets (use external secrets manager)
- [ ] Deploy StatefulSets (RabbitMQ, Redis) or configure managed services
- [ ] Deploy Deployments (Producer, Worker, Dashboard, Docs)
- [ ] Configure Ingress with TLS
- [ ] Set up HPA for auto-scaling
- [ ] Configure PersistentVolumeClaims for reports
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure logging (Fluentd, CloudWatch, ELK)

---

## Related Documentation

- [Deployment Guide](./deployment.md)
- [Infrastructure Overview](./infrastructure.md)
- [Security Audit](./security-audit.md)
