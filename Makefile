.PHONY: help install dev dev-all stop restart clean api user agent build typecheck status \
        backend-build backend-deploy backend-logs api-url

PORTS := 4000 5173 5175
API_URL := https://yognv4d3gl.execute-api.ap-southeast-1.amazonaws.com/prod
STACK   := safesend-backend
REGION  := ap-southeast-1
RDS_PWD ?= Roadto100K

help:
	@echo "SafeSend — make targets"
	@echo ""
	@echo "  Frontend"
	@echo "    make install         install all workspace deps"
	@echo "    make dev             start user-app + agent-dashboard (deployed AWS backend)"
	@echo "    make dev-all         start user, agent, AND local mock-api (legacy)"
	@echo "    make user            user-app only         (:5173)"
	@echo "    make agent           agent-dashboard only  (:5175)"
	@echo "    make api             local mock-api only   (:4000) — legacy/optional"
	@echo "    make stop            kill anything on ports $(PORTS)"
	@echo "    make restart         stop + dev"
	@echo "    make status          show what is running on ports $(PORTS)"
	@echo "    make build           build all workspaces"
	@echo "    make typecheck       typecheck all workspaces"
	@echo ""
	@echo "  Backend (AWS SAM)"
	@echo "    make backend-build   sam build"
	@echo "    make backend-deploy  sam build + deploy (RDS_PWD=...)"
	@echo "    make backend-logs    tail fraud-query lambda logs"
	@echo "    make api-url         print deployed API Gateway URL"
	@echo ""
	@echo "    make clean           remove node_modules + dist"

install:
	cd frontend && npm install

dev:
	cd frontend && npm run dev

dev-all:
	cd frontend && npm run dev:all

api:
	cd frontend && npm run dev:api

user:
	cd frontend && npm run dev:user

agent:
	cd frontend && npm run dev:agent

stop:
	@pids=$$(lsof -ti:$(shell echo $(PORTS) | tr ' ' ',') 2>/dev/null); \
	if [ -n "$$pids" ]; then echo "killing $$pids"; kill $$pids 2>/dev/null; sleep 1; \
	  pids2=$$(lsof -ti:$(shell echo $(PORTS) | tr ' ' ',') 2>/dev/null); \
	  [ -n "$$pids2" ] && kill -9 $$pids2 2>/dev/null || true; \
	else echo "nothing running on $(PORTS)"; fi

restart: stop dev

status:
	@for p in $(PORTS); do \
	  pid=$$(lsof -ti:$$p 2>/dev/null); \
	  if [ -n "$$pid" ]; then echo "port $$p: pid $$pid"; else echo "port $$p: free"; fi; \
	done

build:
	cd frontend && npm run build

typecheck:
	cd frontend && npm run typecheck

backend-build:
	cd backend && sam build --parameter-overrides RdsPassword=$(RDS_PWD)

backend-deploy:
	cd backend && sam build --parameter-overrides RdsPassword=$(RDS_PWD) && \
	sam deploy --stack-name $(STACK) --region $(REGION) --resolve-s3 \
	  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
	  --parameter-overrides "Stage=prod RdsPassword=$(RDS_PWD)"

backend-logs:
	aws logs tail /aws/lambda/safesend-fraud-query --since 5m --region $(REGION) --follow

api-url:
	@echo $(API_URL)

clean:
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name dist -type d -prune -exec rm -rf {} +
	rm -rf backend/.aws-sam
