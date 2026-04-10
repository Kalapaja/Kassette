#!/bin/sh
# Validates that v* tags match package.json version before push.
# Called from lefthook pre-push hook.
ZERO="0000000000000000000000000000000000000000"
while read local_ref local_sha remote_ref remote_sha; do
    case "$local_ref" in refs/tags/v*) ;; *) continue ;; esac
    [ "$local_sha" = "$ZERO" ] && continue
    tag_version="${local_ref#refs/tags/v}"
    pkg_version=$(node -p "require('./package.json').version")
    if [ "$tag_version" != "$pkg_version" ]; then
        echo >&2 "ERROR: Tag v${tag_version} does not match package.json version ${pkg_version}"
        echo >&2 "Either update package.json or delete the tag: git tag -d v${tag_version}"
        exit 1
    fi
done
exit 0
