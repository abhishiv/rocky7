
.SHELL := /usr/bin/bash

.PHONY: build
build:
	npx tsc --resolveJsonModule -p ./tsconfig.json --outDir ./dist --emitDeclarationOnly --declaration

	npx esbuild ./src/index.ts --bundle --format=esm --outfile=dist/index.js --packages=external --target=es2022 --sourcemap=true --minify=true
	npx esbuild ./src/core/index.ts --bundle --format=esm --outfile=dist/core/index.js --packages=external --target=es2022 --sourcemap=true --minify=true