PROJECT_ID = j15rpersonal
REGISTRY = gcr.io/$(PROJECT_ID)
SERVICES = miniflux readeck bewcloud seafile
KUSTOMIZE_DIR = k8s/overlays
DOCKER_DIR = .

deploy-%:
	kubectl apply -f k8s/$*/

restart-%:
	kubectl rollout restart deployment $*-deployment

deploy-all: $(addprefix deploy-,$(SERVICES))

