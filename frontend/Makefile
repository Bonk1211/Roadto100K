.PHONY: help install dev stop restart clean api user plugin agent build typecheck status logs

PORTS := 4000 5173 5174 5175

help:
	@echo "SafeSend — make targets"
	@echo "  make install     install all workspace deps"
	@echo "  make dev         start mock-api + 3 React apps (concurrently)"
	@echo "  make stop        kill anything on ports $(PORTS)"
	@echo "  make restart     stop + dev"
	@echo "  make status      show what is running on ports $(PORTS)"
	@echo "  make api         start only mock-api (:4000)"
	@echo "  make user        start only user-app (:5173)"
	@echo "  make plugin      start only plugin (:5174)"
	@echo "  make agent       start only agent-dashboard (:5175)"
	@echo "  make build       build all workspaces"
	@echo "  make typecheck   typecheck all workspaces"
	@echo "  make clean       remove node_modules + dist"

install:
	npm install

dev:
	npm run dev

api:
	npm run dev:api

user:
	npm run dev:user

plugin:
	npm run dev:plugin

agent:
	npm run dev:agent

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
	npm run build

typecheck:
	npm run typecheck

clean:
	find . -name node_modules -type d -prune -exec rm -rf {} +
	find . -name dist -type d -prune -exec rm -rf {} +
