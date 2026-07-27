#!/bin/bash
cd /workspaces/Stellarlend-frontend
echo "Running quote property-based tests..."
npx vitest run --config vitest.server.config.ts lib/lending/quote.property.test.ts lib/lending/quote.test.ts --reporter=verbose
echo ""
echo "Running tests with coverage..."
npx vitest run --config vitest.server.config.ts lib/lending/quote.property.test.ts lib/lending/quote.test.ts --coverage
