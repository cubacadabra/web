#!/bin/sh
set -eu

GENERATE_SOURCEMAP=false npm run build:release
rm -rf ../deployed
mkdir ../deployed
cp -R dist/. ../deployed/
cd ../deployed
git init
git add .
git commit -m "deploy"
git remote add origin git@github.com:cubacadabra/deployed.git
git push --force origin main
