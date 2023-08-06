
.SHELL := /usr/bin/bash

.PHONY: build
build:
	npx tsc --resolveJsonModule -p ./tsconfig.json --outDir ./dist --emitDeclarationOnly --declaration
	node esbuild.mjs
