GENERATE_SOURCEMAP=false npm run build
rm -rf ../deployed
mkdir ../deployed
echo "cubacadabra.com" > ../deployed/CNAME
echo "# deployed" > ../deployed/README.md
cp dist/index.html ../deployed
cp dist/index.html ../deployed/404.html
cp -r dist/* ../deployed/
cd ../deployed
git init
git add .
git commit -m "deploy"
git remote add origin git@github.com:cubacadabra/deployed.git
git push --force origin main
