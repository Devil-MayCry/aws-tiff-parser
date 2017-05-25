#!/bin/sh

BIN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$BIN_DIR")"

# update dependencies
npm install --registry=http://npmjs.gagogroup.cn

# transpile to js
gulp ts
