#!/bin/sh
set -eu
if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  case "$CI_BUILD_NUMBER" in *[!0-9]*|'') echo "Invalid CI build number" >&2; exit 1;; esac
  cd "${CI_PRIMARY_REPOSITORY_PATH}/ios/Voicegram"
  agvtool new-version -all "$CI_BUILD_NUMBER"
fi
