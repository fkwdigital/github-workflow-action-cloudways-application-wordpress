# Cloudways Workflow Action for WordPress

GitHub workflow action specifically for WordPress deployments on Cloudways managed servers. Originally forked from [official Cloudways action](https://github.com/cloudways-lab/github-action-cloudways-deploy) that has not been updated in a long time.

Rsync‑over‑SSH deploy with:

- Always‑on WordPress excludes
- `public/` contents → remote root
- Optional `TARGET_BASE` + `FOLDER_NAME`

## Inputs

- `REMOTE_HOST` (required)
- `REMOTE_USER` (required)
- `SSH_PRIVATE_KEY` (required)
- `REMOTE_PORT` (default 22)
- `TARGET` | `TARGET_BASE` + `FOLDER_NAME`
- `SOURCE` (default `public/`)
- `ARGS` or `RSYNC_ARGS` (default `-azvr --inplace --exclude='.*' --no-perms --no-times`)
- `EXCLUDE_FILE` (optional)
- `EXTRA_EXCLUDE` (optional)

## Usage

See example in `.github/workflows/deploy.yml` and in this doc.
