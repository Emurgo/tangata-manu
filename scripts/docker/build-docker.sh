#! /bin/bash

MY_DIR="$(dirname "$0")"
source "$MY_DIR/helper.sh";

# Version key/value should be on his own line
PACKAGE_VERSION=$(readPackageJSON 'version');
NAME=$(readPackageJSON 'name');

docker build -t "yoroi/$NAME:$PACKAGE_VERSION" -f ./docker/Dockerfile .
