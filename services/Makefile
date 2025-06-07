PROJECT_ID = j15rpersonal
REGISTRY = gcr.io/$(PROJECT_ID)
SERVICES = miniflux miniflux-ai
KUSTOMIZE_DIR = k8s/overlays
DOCKER_DIR = .

deploy-%:
	kustomize build k8s/overlays/$* | kubectl apply -f -

restart-%:
	kubectl rollout restart deployment $*-deployment

update-config-%:
	kubectl create configmap $*-config \
	  --from-file=config.yml=./k8s/overlays/$*/config.yml \
	  --dry-run=client -o yaml | kubectl apply -f -

deploy-all: $(addprefix deploy-,$(SERVICES))

