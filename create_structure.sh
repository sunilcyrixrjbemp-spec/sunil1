#!/bin/bash

# Create frontend directories
mkdir -p frontend/src/components/{common,auth,expense,dashboard,approval,admin,profile}
mkdir -p frontend/src/pages
mkdir -p frontend/src/hooks
mkdir -p frontend/src/context
mkdir -p frontend/src/services
mkdir -p frontend/src/utils
mkdir -p frontend/src/types
mkdir -p frontend/src/styles
mkdir -p frontend/src/assets/{images,icons,fonts}
mkdir -p frontend/public

# Create backend directories
mkdir -p backend/app/api/routes
mkdir -p backend/app/models
mkdir -p backend/app/schemas
mkdir -p backend/app/services
mkdir -p backend/app/utils
mkdir -p backend/app/config
mkdir -p backend/app/middleware
mkdir -p backend/app/core
mkdir -p backend/migrations/versions
mkdir -p backend/tests

# Create CI/CD
mkdir -p .github/workflows

echo "✅ Folder structure created successfully!"
