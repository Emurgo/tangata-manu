#! /bin/bash

function readPackageJSON() {
  echo $(cat package.json \
  | grep "$1" \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | sed 's/\ //g')
}
