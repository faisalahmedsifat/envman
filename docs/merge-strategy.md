# Merge Strategy

This document will define key-level merge behavior for `envman fetch`.

v1 direction:

- merge by env key, not by raw file text
- preserve local-only keys
- block conflicting key overwrites by default
- rewrite merged files in normalized format
