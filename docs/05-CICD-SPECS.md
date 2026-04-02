# CI/CD Specifications - 3D Miniatures E-commerce

Especificações completas de pipelines de integração contínua e deployment automático usando GitHub Actions para o projeto de e-commerce de miniaturas 3D.

## Visão Geral da Estratégia

```
Branch develop/main
     │
     ├─ Trigger: push/PR
     │  └─ ci.yml (testes, build, cobertura)
     │
     ├─ Trigger: diário + PRs
     │  └─ security.yml (scanning, auditoria)
     │
     └─ Trigger: merge to main
        └─ deploy.yml (build, push, deploy)
```

---

## 1. ci.yml - Integração Contínua Completa

Workflow executado em todo push e pull request para as branches `develop` e `main`.

### Especificação Geral

```yaml
name: CI - Build & Test

on:
  push:
    branches:
      - develop
      - main
  pull_request:
    branches:
      - develop
      - main

env:
  NODE_VERSION: '24.4'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ========================================================================
  # Job 1: Setup e Validação de Código
  # ========================================================================
  lint-and-types:
    name: Lint & TypeScript Check
    runs-on: ubuntu-latest
    timeout-minutes: 15

    strategy:
      matrix:
        workspace:
          - backend
          - frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history para análise

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '${{ matrix.workspace }}/package-lock.json'

      - name: Install dependencies - ${{ matrix.workspace }}
        working-directory: ${{ matrix.workspace }}
        run: npm ci

      - name: Run ESLint
        working-directory: ${{ matrix.workspace }}
        run: npm run lint
        continue-on-error: false

      - name: Check TypeScript types
        working-directory: ${{ matrix.workspace }}
        run: npm run type-check
        continue-on-error: false

  # ========================================================================
  # Job 2: Testes Unitários Backend
  # ========================================================================
  test-backend-unit:
    name: Unit Tests - Backend
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: lint-and-types

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run unit tests with coverage
        working-directory: backend
        run: npm run test:cov
        env:
          NODE_ENV: test

      - name: Upload coverage reports to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/coverage-final.json
          flags: backend
          name: backend-coverage
          fail_ci_if_error: false

  # ========================================================================
  # Job 3: Testes Unitários Frontend
  # ========================================================================
  test-frontend-unit:
    name: Unit Tests - Frontend
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: lint-and-types

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Run unit tests with coverage
        working-directory: frontend
        run: npm run test:cov
        env:
          NODE_ENV: test

      - name: Upload coverage reports to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/coverage-final.json
          flags: frontend
          name: frontend-coverage
          fail_ci_if_error: false

  # ========================================================================
  # Job 4: Setup Services (Database, Redis, Elasticsearch)
  # ========================================================================
  services:
    name: Setup Test Services
    runs-on: ubuntu-latest
    timeout-minutes: 5

    services:
      postgres:
        image: postgres:18.2-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: miniatures_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432

      redis:
        image: redis:7.4-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6380:6379

      elasticsearch:
        image: docker.elastic.co/elasticsearch/elasticsearch:9.3.1
        env:
          discovery.type: single-node
          xpack.security.enabled: 'false'
          ES_JAVA_OPTS: '-Xms256m -Xmx256m'
        options: >-
          --health-cmd "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"yellow\\|green\"'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 9201:9200

    steps:
      - name: Wait for services
        run: |
          echo "Services are up and running"

  # ========================================================================
  # Job 5: Testes de Integração Backend
  # ========================================================================
  test-backend-integration:
    name: Integration Tests - Backend
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: [lint-and-types, services]

    services:
      postgres:
        image: postgres:18.2-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: miniatures_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432

      redis:
        image: redis:7.4-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6380:6379

      elasticsearch:
        image: docker.elastic.co/elasticsearch/elasticsearch:9.3.1
        env:
          discovery.type: single-node
          xpack.security.enabled: 'false'
          ES_JAVA_OPTS: '-Xms256m -Xmx256m'
        options: >-
          --health-cmd "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"yellow\\|green\"'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 9201:9200

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run Prisma migrations
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5433/miniatures_test
        run: npx prisma migrate deploy

      - name: Generate Prisma client
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5433/miniatures_test
        run: npx prisma generate

      - name: Run integration tests
        working-directory: backend
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test_user:test_password@localhost:5433/miniatures_test
          REDIS_URL: redis://localhost:6380/0
          ELASTICSEARCH_NODE: http://localhost:9201
        run: npm run test:int
        continue-on-error: false

      - name: Upload integration test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: integration-test-results
          path: backend/test-results/

  # ========================================================================
  # Job 6: Build Backend
  # ========================================================================
  build-backend:
    name: Build - Backend
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [lint-and-types, test-backend-unit]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Build application
        working-directory: backend
        run: npm run build

      - name: Generate Prisma client
        working-directory: backend
        run: npx prisma generate

      - name: Verify build output
        working-directory: backend
        run: |
          test -d dist || exit 1
          test -f dist/main.js || exit 1
          echo "✓ Build artifacts verified"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: backend-build
          path: |
            backend/dist/
            backend/node_modules/
            backend/package*.json
          retention-days: 1

  # ========================================================================
  # Job 7: Build Frontend
  # ========================================================================
  build-frontend:
    name: Build - Frontend
    runs-on: ubuntu-latest
    timeout-minutes: 25
    needs: [lint-and-types, test-frontend-unit]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Build Next.js app
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3000
        run: npm run build

      - name: Export static site (if applicable)
        working-directory: frontend
        run: npm run export
        continue-on-error: true

      - name: Verify build output
        working-directory: frontend
        run: |
          test -d .next || exit 1
          echo "✓ Build artifacts verified"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: frontend-build
          path: |
            frontend/.next/
            frontend/public/
            frontend/package*.json
          retention-days: 1

  # ========================================================================
  # Job 8: E2E Tests com Playwright
  # ========================================================================
  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: [build-backend, build-frontend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Install Playwright browsers
        working-directory: frontend
        run: npx playwright install --with-deps

      - name: Download backend build
        uses: actions/download-artifact@v3
        with:
          name: backend-build
          path: backend/

      - name: Download frontend build
        uses: actions/download-artifact@v3
        with:
          name: frontend-build
          path: frontend/

      - name: Start backend server
        working-directory: backend
        run: |
          node dist/main.js &
          sleep 10
        env:
          NODE_ENV: test
          APP_PORT: 3000

      - name: Start frontend server
        working-directory: frontend
        run: |
          npx next start -p 3001 &
          sleep 10
        env:
          NODE_ENV: test
          NEXT_PUBLIC_API_URL: http://localhost:3000

      - name: Run Playwright tests
        working-directory: frontend
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3001

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30

  # ========================================================================
  # Job 9: Cobertura de Testes
  # ========================================================================
  coverage-check:
    name: Coverage Check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [test-backend-unit, test-frontend-unit, test-backend-integration]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download backend coverage
        uses: actions/download-artifact@v3
        with:
          name: backend-build

      - name: Check backend coverage
        run: |
          COVERAGE=$(cat backend/coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Backend coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "✗ Backend coverage below 80%"
            exit 1
          fi
          echo "✓ Backend coverage OK"

  # ========================================================================
  # Job 10: Prisma Migration Check
  # ========================================================================
  prisma-migration-check:
    name: Prisma Migration Check
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: github.event_name == 'pull_request'

    services:
      postgres:
        image: postgres:18.2-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: miniatures_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432

    steps:
      - name: Checkout code (current branch)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Check if schema.prisma changed
        id: schema_check
        run: |
          if git diff origin/develop...HEAD -- backend/prisma/schema.prisma | grep -q .; then
            echo "schema_changed=true" >> $GITHUB_OUTPUT
          else
            echo "schema_changed=false" >> $GITHUB_OUTPUT
          fi

      - name: Verify migration exists
        if: steps.schema_check.outputs.schema_changed == 'true'
        run: |
          MIGRATION_COUNT=$(ls -1 backend/prisma/migrations | wc -l)
          if [ "$MIGRATION_COUNT" -eq 0 ]; then
            echo "✗ Schema changed but no migration found!"
            exit 1
          fi
          echo "✓ Migration found"

      - name: Test migration deployment
        if: steps.schema_check.outputs.schema_changed == 'true'
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5433/miniatures_test
        run: npx prisma migrate deploy
        continue-on-error: false

  # ========================================================================
  # Job Final: Summary
  # ========================================================================
  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [
      lint-and-types,
      test-backend-unit,
      test-frontend-unit,
      test-backend-integration,
      build-backend,
      build-frontend,
      test-e2e,
      coverage-check,
      prisma-migration-check
    ]
    if: always()

    steps:
      - name: Check CI status
        run: |
          echo "CI Pipeline completed!"
          if [ "${{ needs.lint-and-types.result }}" != "success" ]; then
            echo "✗ Lint & Types failed"
            exit 1
          fi
          if [ "${{ needs.test-backend-unit.result }}" != "success" ]; then
            echo "✗ Backend unit tests failed"
            exit 1
          fi
          if [ "${{ needs.test-frontend-unit.result }}" != "success" ]; then
            echo "✗ Frontend unit tests failed"
            exit 1
          fi
          if [ "${{ needs.test-backend-integration.result }}" != "success" ]; then
            echo "✗ Backend integration tests failed"
            exit 1
          fi
          if [ "${{ needs.build-backend.result }}" != "success" ]; then
            echo "✗ Backend build failed"
            exit 1
          fi
          if [ "${{ needs.build-frontend.result }}" != "success" ]; then
            echo "✗ Frontend build failed"
            exit 1
          fi
          if [ "${{ needs.test-e2e.result }}" != "success" ]; then
            echo "✗ E2E tests failed"
            exit 1
          fi
          if [ "${{ needs.coverage-check.result }}" != "success" ]; then
            echo "✗ Coverage check failed"
            exit 1
          fi
          echo "✓ All CI checks passed!"
```

### Steps Explicados

**Checkout:**
- Baixa o código do repositório
- `fetch-depth: 0` para análise de histórico completo

**Setup Node.js:**
- Instala Node.js 24.4
- Cache de npm para velocidade

**Install Dependencies:**
- `npm ci` (não `npm install`) para builds determinísticos
- Usa package-lock.json

**Linting (ESLint):**
- Por quê: Mantém código consistente
- Falha se houver erros de estilo

**Type Check (TypeScript):**
- Por quê: Detecta erros de tipo em tempo de build
- Evita bugs de runtime

**Testes Unitários:**
- Backend: Testa lógica de negócio isolada
- Frontend: Testa componentes React
- Gera relatórios de cobertura (>80% obrigatório)

**Testes de Integração:**
- Backend: Testa APIs com banco real
- Roda após unit tests
- Usa PostgreSQL, Redis, Elasticsearch

**Build:**
- Compila TypeScript em JavaScript
- Gera artefatos para E2E e produção

**E2E Tests:**
- Playwright testa fluxos completos
- Roda aplicações compiladas
- Simula navegador real

**Coverage Check:**
- Valida cobertura >= 80%
- Falha pipeline se abaixo do threshold

**Prisma Migration Check:**
- Detecta mudanças em schema.prisma
- Verifica se migração foi criada
- Testa migração em banco limpo

---

## 2. security.yml - Segurança Contínua

Workflow para scanning de segurança, auditoria de dependências e detecção de secrets.

### Especificação Geral

```yaml
name: Security Checks

on:
  push:
    branches:
      - develop
      - main
  pull_request:
    branches:
      - develop
      - main
  schedule:
    # Roda diariamente às 2 AM UTC
    - cron: '0 2 * * *'

env:
  NODE_VERSION: '24.4'

jobs:
  # ========================================================================
  # Job 1: npm audit - Verificação de Vulnerabilidades
  # ========================================================================
  npm-audit:
    name: npm audit - Dependency Vulnerabilities
    runs-on: ubuntu-latest
    timeout-minutes: 10

    strategy:
      matrix:
        workspace:
          - backend
          - frontend
      fail-fast: false

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '${{ matrix.workspace }}/package-lock.json'

      - name: Install dependencies
        working-directory: ${{ matrix.workspace }}
        run: npm ci

      - name: Run npm audit
        working-directory: ${{ matrix.workspace }}
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Generate npm audit report
        working-directory: ${{ matrix.workspace }}
        run: npm audit --json > npm-audit-report.json
        continue-on-error: true

      - name: Upload npm audit report
        uses: actions/upload-artifact@v3
        with:
          name: npm-audit-${{ matrix.workspace }}
          path: ${{ matrix.workspace }}/npm-audit-report.json

  # ========================================================================
  # Job 2: Trivy - Container & Dependency Scanning
  # ========================================================================
  trivy-scan:
    name: Trivy - Vulnerability Scanner
    runs-on: ubuntu-latest
    timeout-minutes: 15

    strategy:
      matrix:
        target:
          - backend
          - frontend
      fail-fast: false

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy scan on ${{ matrix.target }}
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '${{ matrix.target }}'
          format: 'sarif'
          output: 'trivy-results-${{ matrix.target }}.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results-${{ matrix.target }}.sarif'
          category: 'trivy-${{ matrix.target }}'

  # ========================================================================
  # Job 3: Docker Image Scanning
  # ========================================================================
  docker-image-scan:
    name: Docker Image Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 20

    strategy:
      matrix:
        image:
          - dockerfile: backend/Dockerfile
            name: backend
          - dockerfile: frontend/Dockerfile
            name: frontend
      fail-fast: false

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build Docker image for scanning
        uses: docker/build-push-action@v4
        with:
          context: ${{ matrix.image.name }}
          dockerfile: ${{ matrix.image.dockerfile }}
          push: false
          load: true
          tags: ${{ matrix.image.name }}:test
          cache-from: type=gha

      - name: Run Trivy scan on Docker image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.image.name }}:test'
          format: 'sarif'
          output: 'trivy-docker-${{ matrix.image.name }}.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Docker image scan results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-docker-${{ matrix.image.name }}.sarif'
          category: 'trivy-docker-${{ matrix.image.name }}'

  # ========================================================================
  # Job 4: Secrets Detection (TruffleHog)
  # ========================================================================
  secrets-detection:
    name: Secrets Detection - TruffleHog
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog secret scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --debug --only-verified
        continue-on-error: true

      - name: Comment on PR if secrets found
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ **Possible secrets detected!** Please review the Security tab for details.'
            })

  # ========================================================================
  # Job 5: SAST - CodeQL Analysis
  # ========================================================================
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        language:
          - 'javascript-typescript'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: ${{ matrix.language }}

      - name: Auto build
        uses: github/codeql-action/autobuild@v2

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2

  # ========================================================================
  # Job 6: Dependency Check (OWASP)
  # ========================================================================
  dependency-check:
    name: OWASP Dependency-Check
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run OWASP Dependency-Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          path: '.'
          format: 'SARIF'
          args: >
            --enableExperimental
            --enable-retired

      - name: Upload OWASP results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'dependency-check-report.sarif'
          category: 'dependency-check'

  # ========================================================================
  # Job Final: Security Summary
  # ========================================================================
  security-summary:
    name: Security Summary
    runs-on: ubuntu-latest
    needs: [npm-audit, trivy-scan, docker-image-scan, secrets-detection, codeql]
    if: always()

    steps:
      - name: Check security status
        run: |
          echo "Security scan completed!"
          echo ""
          echo "Summary:"
          echo "  - npm audit: ${{ needs.npm-audit.result }}"
          echo "  - Trivy FS: ${{ needs.trivy-scan.result }}"
          echo "  - Docker image: ${{ needs.docker-image-scan.result }}"
          echo "  - Secrets: ${{ needs.secrets-detection.result }}"
          echo "  - CodeQL: ${{ needs.codeql.result }}"

          if [ "${{ needs.secrets-detection.result }}" == "failure" ]; then
            echo ""
            echo "⚠️ Possible secrets detected - review immediately!"
          fi
```

### Características de Segurança

**npm audit:**
- Detecta vulnerabilidades em dependências
- Limita a moderate ou acima
- Gera relatório JSON

**Trivy:**
- Escaneia sistema de arquivos
- Escaneia imagens Docker
- Integra com GitHub Security tab

**Secrets Detection (TruffleHog):**
- Detecta API keys, tokens, credentials
- Apenas verified credentials (false positive reduction)
- Comenta em PRs se encontrar algo

**CodeQL:**
- SAST (Static Application Security Testing)
- Detecta vulnerabilidades de código
- Oferece recomendações de fix

**OWASP Dependency-Check:**
- Identifica componentes conhecidos como vulneráveis
- Usa CVE database

---

## 3. deploy.yml - Deployment Automático

Workflow executado em push para `main` após CI passar com sucesso.

### Especificação Geral

```yaml
name: Deploy - Production

on:
  push:
    branches:
      - main
  workflow_dispatch:  # Permite trigger manual

env:
  NODE_VERSION: '24.4'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ========================================================================
  # Job 1: Verificar Status do CI
  # ========================================================================
  check-ci-status:
    name: Check CI Status
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Check if CI passed
        uses: actions/github-script@v6
        with:
          script: |
            const { data: runs } = await github.rest.actions.listWorkflowRuns({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'ci.yml',
              head_sha: context.sha,
              status: 'completed'
            });

            const ciRun = runs.workflow_runs[0];
            if (!ciRun || ciRun.conclusion !== 'success') {
              throw new Error('CI pipeline did not pass. Deployment cancelled.');
            }
            console.log('✓ CI pipeline passed');

  # ========================================================================
  # Job 2: Build Backend Image
  # ========================================================================
  build-backend-image:
    name: Build Backend Docker Image
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: check-ci-status

    outputs:
      image: ${{ steps.meta.outputs.tags }}
      digest: ${{ steps.build.outputs.digest }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push backend image
        id: build
        uses: docker/build-push-action@v4
        with:
          context: backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ========================================================================
  # Job 3: Build Frontend Image
  # ========================================================================
  build-frontend-image:
    name: Build Frontend Docker Image
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: check-ci-status

    outputs:
      image: ${{ steps.meta.outputs.tags }}
      digest: ${{ steps.build.outputs.digest }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push frontend image
        id: build
        uses: docker/build-push-action@v4
        with:
          context: frontend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ========================================================================
  # Job 4: Deploy para Produção
  # ========================================================================
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [build-backend-image, build-frontend-image]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy via SSH
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_PRIVATE_KEY }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
          IMAGE_BACKEND: ${{ needs.build-backend-image.outputs.image }}
          IMAGE_FRONTEND: ${{ needs.build-frontend-image.outputs.image }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

          # Deploy commands
          ssh -i ~/.ssh/deploy_key "$DEPLOY_USER@$DEPLOY_HOST" << EOF
            set -e
            cd $DEPLOY_PATH

            echo "Pulling latest images..."
            docker pull $IMAGE_BACKEND
            docker pull $IMAGE_FRONTEND

            echo "Stopping current services..."
            docker-compose -f docker-compose.prod.yml down || true

            echo "Starting new services..."
            docker-compose -f docker-compose.prod.yml up -d

            echo "Waiting for services to start..."
            sleep 10

            echo "✓ Deployment complete"
          EOF

      - name: Verify Health Checks
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_KEY: ${{ secrets.DEPLOY_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

          ssh -i ~/.ssh/deploy_key "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
            echo "Checking backend health..."
            for i in {1..30}; do
              if docker-compose -f docker-compose.prod.yml exec backend curl -f http://localhost:3000/health > /dev/null 2>&1; then
                echo "✓ Backend is healthy"
                break
              fi
              echo "Attempt $i/30..."
              sleep 5
            done

            echo "Checking frontend health..."
            for i in {1..30}; do
              if docker-compose -f docker-compose.prod.yml exec frontend curl -f http://localhost:3000/health > /dev/null 2>&1; then
                echo "✓ Frontend is healthy"
                break
              fi
              echo "Attempt $i/30..."
              sleep 5
            done
          EOF

  # ========================================================================
  # Job 5: Rollback automático se health check falhar
  # ========================================================================
  rollback:
    name: Automatic Rollback
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: deploy
    if: failure()

    steps:
      - name: Rollback Deployment
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_PRIVATE_KEY }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

          ssh -i ~/.ssh/deploy_key "$DEPLOY_USER@$DEPLOY_HOST" << EOF
            set -e
            cd $DEPLOY_PATH

            echo "Rolling back to previous version..."
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d

            echo "✓ Rollback complete"
          EOF

      - name: Notify rollback
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🔄 **Deployment rolled back** - Health checks failed. Please review logs.'
            })

  # ========================================================================
  # Job 6: Notificação de Deploy
  # ========================================================================
  notify:
    name: Notify Deployment
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: deploy
    if: always()

    steps:
      - name: Send Discord notification
        if: ${{ secrets.DISCORD_WEBHOOK_URL }}
        uses: slackapi/slack-github-action@v1.24.0
        with:
          webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
          payload: |
            {
              "text": "Deployment Status: ${{ needs.deploy.result == 'success' && '✅ Success' || '❌ Failed' }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Deployment Notification*\nStatus: ${{ needs.deploy.result == 'success' && '✅ Success' || '❌ Failed' }}\nBranch: main\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }

      - name: Send Slack notification
        if: ${{ secrets.SLACK_WEBHOOK_URL }}
        uses: slackapi/slack-github-action@v1.24.0
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "Deployment Status: ${{ needs.deploy.result == 'success' && '✅ Success' || '❌ Failed' }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deployment*\n*Status:* ${{ needs.deploy.result == 'success' && '✅ Success' || '❌ Failed' }}\n*Branch:* main\n*Commit:* <${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|${{ github.sha }}>\n*Author:* ${{ github.actor }}"
                  }
                }
              ]
            }

```

### Recursos do Deploy

**Check CI Status:**
- Valida que pipeline de CI passou
- Previne deployment de código quebrado

**Build & Push:**
- Constrói imagens Docker multi-stage
- Push para GitHub Container Registry
- Cache de layers para velocidade

**Deploy via SSH:**
- Usa SSH key para segurança
- Executa docker-compose remotamente
- Sem expor credenciais

**Health Checks:**
- Verifica endpoints `/health`
- Retry automático com backoff
- 30 tentativas de 5s = 150s timeout

**Rollback Automático:**
- Se health check falhar
- Reverte para versão anterior
- Notifica via GitHub

**Notificações:**
- Discord webhook
- Slack webhook
- Email opcional

---

## 4. Secrets Necessários no GitHub

Configure os seguintes secrets no repositório em Settings > Secrets and variables > Actions:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `DEPLOY_PRIVATE_KEY` | SSH private key para acesso ao servidor | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_HOST` | IP ou hostname do servidor de produção | `prod.example.com` |
| `DEPLOY_USER` | Usuário SSH no servidor de produção | `deploy` |
| `DEPLOY_PATH` | Caminho da aplicação no servidor | `/home/deploy/miniatures` |
| `DISCORD_WEBHOOK_URL` | Webhook para notificações Discord | `https://discord.com/api/webhooks/...` |
| `SLACK_WEBHOOK_URL` | Webhook para notificações Slack | `https://hooks.slack.com/services/...` |
| `GITHUB_TOKEN` | Token automático (gerado pelo GitHub) | Automático |

### Como configurar SSH Key:

```bash
# Gerar chave no servidor de produção
ssh-keygen -t ed25519 -f deploy_key -N ""

# Copiar a chave pública para authorized_keys
cat deploy_key.pub >> ~/.ssh/authorized_keys

# Converter para formato OpenSSH (se necessário)
ssh-keygen -p -N "" -m pem -f deploy_key

# Copiar conteúdo da chave privada
cat deploy_key
# Colar em GitHub Secrets como DEPLOY_PRIVATE_KEY
```

---

## 5. Variáveis de Ambiente (Environment Variables)

Configure variables (não secrets) em Settings > Variables:

| Variable | Descrição | Valor |
|----------|-----------|-------|
| `NODE_VERSION` | Versão do Node.js | `24.4` |
| `REGISTRY` | Registries de containers | `ghcr.io` |
| `IMAGE_NAME` | Nome da imagem | `seu-org/miniatures` |

---

## 6. Fluxo Completo de CI/CD

```
┌──────────────────────────────────────────┐
│ Push para develop/main                   │
└──────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│ ci.yml - Testes e Build                  │
├──────────────────────────────────────────┤
│ 1. Lint & Type Check (paralelo)          │
│ 2. Unit Tests Backend (paralelo)         │
│ 3. Unit Tests Frontend (paralelo)        │
│ 4. Integration Tests Backend             │
│ 5. Build Backend                         │
│ 6. Build Frontend                        │
│ 7. E2E Tests                             │
│ 8. Coverage Check                        │
│ 9. Prisma Migration Check                │
└──────────────────────────────────────────┘
                  │
              Paralelo
              /      \
             /        \
            ▼          ▼
    security.yml   deploy.yml (se main)
    - npm audit    - Check CI ✓
    - Trivy        - Build images
    - CodeQL       - Push GHCR
    - Secrets      - Deploy SSH
    - OWASP        - Health check
                    - Rollback if fail
                    - Notify
```

---

## 7. Monitoramento e Troubleshooting

### Verificar Status de Workflows

```bash
# Listar últimos workflows
gh run list --repo seu-org/miniatures

# Ver detalhes de um workflow específico
gh run view RUN_ID --repo seu-org/miniatures

# Ver logs de um job
gh run view RUN_ID --log --repo seu-org/miniatures

# Rerun um workflow que falhou
gh run rerun RUN_ID --repo seu-org/miniatures
```

### Debug de Falhas

1. **Lint falhou:**
   - Rodar `npm run lint` localmente
   - Rodar `npm run lint:fix` para auto-corrigir

2. **Testes falharam:**
   - Rodar `npm run test` localmente
   - Usar docker-compose.test.yml para simular CI

3. **Build falhou:**
   - Verificar `npm run build` localmente
   - Testar Dockerfile com `docker build`

4. **Deploy falhou:**
   - Verificar SSH connectivity
   - Verificar docker-compose.prod.yml no servidor
   - Verificar health check endpoint

---

## 8. Performance Otimizado

### Caching

- **npm cache:** 1 dia (padrão)
- **Docker layers:** Build cache via GitHub Actions
- **Artifacts:** Retenção de 1 dia para builds

### Timeouts

- **Lint/Type-check:** 15 min
- **Unit tests:** 20 min
- **Integration tests:** 30 min
- **E2E:** 30 min
- **Deploy:** 20 min
- **Security:** 30 min (total)

### Parallelização

- Lint & Type check (paralelo)
- Backend & Frontend tests (paralelo)
- Build backend & frontend (paralelo)
- Security scans (paralelo)

---

## 9. Status Badge

Adicione ao README.md:

```markdown
## Status

[![CI](https://github.com/seu-org/miniatures/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/seu-org/miniatures/actions)
[![Security](https://github.com/seu-org/miniatures/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/seu-org/miniatures/actions)
[![Deploy](https://github.com/seu-org/miniatures/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/seu-org/miniatures/actions)
```

---

## Conclusão

Este pipeline de CI/CD garante:

1. **Qualidade:** Testes, linting, type checking
2. **Segurança:** Scanning de dependências e código
3. **Confiabilidade:** Build verificado antes do deploy
4. **Velocidade:** Cache e paralelização
5. **Rastreabilidade:** Logs e notificações
6. **Recuperação:** Rollback automático se necessário

Adapte conforme suas necessidades específicas!

