#! /bin/bash
# Not working yet
7z a BOUDROUSS.zip cli/* lib/* pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tscondif.json .gitignore package.json -xr!lib/dist -xr!lib/node_modules -xr!cli/node_modules