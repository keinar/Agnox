#!/bin/sh

FOLDER=$1

if [ -f .env ]; then
  echo "Removing local .env to enforce injected configuration..."
  rm .env
fi

echo "Running against BASE_URL: $BASE_URL"

if [ -z "$FOLDER" ] || [ "$FOLDER" = "all" ]; then
  echo "Running ALL tests..."
  npx playwright test
elif [ -d "$FOLDER" ]; then
  echo "Running tests in folder: $FOLDER"
  npx playwright test "$FOLDER"
else
  echo "Target folder '$FOLDER' not found in container (likely running from within it). Falling back to running ALL tests..."
  npx playwright test
fi
