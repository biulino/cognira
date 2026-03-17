.PHONY: up down restart logs migrate seed backup shell-db shell-be

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=100

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.seed

backup:
	docker compose exec postgres pg_dump -U $${POSTGRES_USER:-emercado} estudos_mercado | gzip > backup_$$(date +%Y%m%d_%H%M%S).sql.gz

shell-db:
	docker compose exec postgres psql -U $${POSTGRES_USER:-emercado} estudos_mercado

shell-be:
	docker compose exec backend bash

test:
	docker compose exec backend pytest -x -q
