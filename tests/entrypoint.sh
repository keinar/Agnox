#!/bin/sh

FOLDER=$1

echo "Running against BASE_URL: $BASE_URL"

# Build reporter flag -- the platform injects PLAYWRIGHT_REPORTERS (e.g. line,html,allure-playwright,json)
# so that the JSON reporter always produces results.json for structured test result parsing.
# If the env var is absent (manual customer invocation), fall back to config defaults.
REPORTER_FLAG=""
if [ -n "$PLAYWRIGHT_REPORTERS" ]; then
  REPORTER_FLAG="--reporter=$PLAYWRIGHT_REPORTERS"
fi

export PLAYWRIGHT_JSON_OUTPUT_NAME=/app/test-results/results.json

if [ -z "$FOLDER" ] || [ "$FOLDER" = "all" ]; then
  echo "Running ALL tests..."
  npx playwright test $REPORTER_FLAG
elif [ -d "$FOLDER" ]; then
  echo "Running tests in folder: $FOLDER"
  npx playwright test "$FOLDER" $REPORTER_FLAG
else
  echo "Target folder '$FOLDER' not found in container (likely running from within it). Falling back to running ALL tests..."
  npx playwright test $REPORTER_FLAG
fi
