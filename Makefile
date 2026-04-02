.PHONY: help dev test lint format clean install migrate seed logs stop

help:
	@echo "Comandos disponíveis:"
	@echo "  make install     - Instala dependências de backend e frontend"
	@echo "  make dev         - Inicia ambiente de desenvolvimento (docker-compose + apps)"
	@echo "  make test        - Roda testes unitários"
	@echo "  make test:e2e    - Roda testes E2E com Playwright"
	@echo "  make lint        - Valida TypeScript e ESLint"
	@echo "  make format      - Formata código com Prettier"
	@echo "  make migrate     - Roda migrations Prisma"
	@echo "  make seed        - Popula banco com dados iniciais"
	@echo "  make logs        - Mostra logs docker-compose"
	@echo "  make clean       - Para containers e remove volumes"
	@echo "  make db-reset    - Reseta banco (CUIDADO!)"

install:
	@echo "Instalando backend..."
	cd backend && npm install
	@echo "Instalando frontend..."
	cd frontend && npm install

dev:
	@echo "Iniciando ambiente de desenvolvimento..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Aguardando serviços..."
	sleep 5
	cd backend && npm run start:dev &
	cd frontend && npm run dev &
	@echo "Acesse:"
	@echo "  Backend:  http://localhost:4000"
	@echo "  Frontend: http://localhost:3001"
	@echo "  Docs:     http://localhost:4000/api/docs"

test:
	cd backend && npm run test -- --coverage

test\:e2e:
	cd frontend && npm run test:e2e

lint:
	cd backend && npm run lint
	cd frontend && npm run lint

format:
	cd backend && npm run format
	cd frontend && npm run format

migrate:
	cd backend && npx prisma migrate dev

seed:
	cd backend && npx prisma db seed

logs:
	docker-compose -f docker-compose.dev.yml logs -f

stop:
	docker-compose -f docker-compose.dev.yml down

clean:
	docker-compose -f docker-compose.dev.yml down -v
	rm -rf backend/dist backend/node_modules backend/.env
	rm -rf frontend/.next frontend/node_modules frontend/.env.local

db-reset:
	cd backend && npx prisma migrate reset --force
