#! /bin/bash
cp report/projet1/rapport.pdf ./DAAR-Projet1-Rapport-Boudrouss-Breton.pdf
7z a daar-projet-offline-BOUDROUSS-BRETON.zip report/* cli/* lib/* data/* pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json .gitignore package.json README.md egrep DAAR-Projet1-Rapport-Boudrouss-Breton.pdf -xr!lib/dist -xr!lib/node_modules -xr!cli/node_modules