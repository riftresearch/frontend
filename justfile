# justfile for Rift Frontend Docker commands
# Usage: just backend <command>
# Examples:
#   just backend up -d
#   just backend down
#   just backend logs -f
#   just backend restart

# Default recipe (shows help)
default:
    @just --list

# Backend docker compose wrapper with .env file
backend *ARGS:
    docker compose --env-file .env {{ARGS}}

# Quick shortcuts
up: (backend "up" "-d")
down: (backend "down")
logs: (backend "logs" "-f")
restart: (backend "restart")
ps: (backend "ps")
build: (backend "build" "--no-cache")

# Build and start
start: (backend "build") (backend "up" "-d")

# Stop and remove
stop: (backend "down" "-v")

# View logs for specific service
logs-app: (backend "logs" "-f" "nextjs-app")

# Execute command in container
exec *CMD:
    docker compose --env-file .env exec nextjs-app {{CMD}}

# Shell into container
shell:
    @just exec sh

# Check container stats
stats:
    docker stats rift-frontend

# Health check
health:
    @curl -s http://localhost:3005/api/health | jq

# Clean everything (containers, volumes, images)
clean:
    docker compose --env-file .env down -v --rmi all

# Rebuild from scratch
rebuild: clean (backend "build" "--no-cache") (backend "up" "-d")

# Show container status
status:
    @echo "=== Container Status ==="
    @docker compose --env-file .env ps
    @echo ""
    @echo "=== Health Check ==="
    @curl -s http://localhost:3005/api/health | jq || echo "App not responding"

# Tail logs with follow
tail:
    @just logs

# Restart just the app
restart-app:
    @just backend restart nextjs-app

