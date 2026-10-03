#!/bin/sh
set -eu

npm run build:release
node scripts/prepare-deployment.js
