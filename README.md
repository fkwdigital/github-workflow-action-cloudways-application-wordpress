# Cloudways Workflow Action for WordPress

GitHub workflow action specifically for WordPress deployments on Cloudways managed servers. Originally forked from [official Cloudways action](https://github.com/cloudways-lab/github-action-cloudways-deploy) that has not been updated in a long time.

## Inputs

### Required

#### `REMOTE_HOST`

This should match the `Public IP` field under `Master Credentials` in the dashboard for the server where your application is deployed.

#### `REMOTE_USER`

This should match the `Username` field under `Master Credentials` in the dashboard for the server where your application is deployed.

#### `SSH_PRIVATE_KEY`

This should match your private key that matches with the key loaded into `SSH Public Keys` in the dashboard for the server where your application is deployed.

#### `FOLDER_NAME` | `TARGET` | `TARGET_BASE` + `FOLDER_NAME`

One of these combinations must be specified.

- `TARGET` - provide the entire remote path.
- `TARGET_BASE` - provide the base path to come before the folder name.
- `FOLDER_NAME` - provide the value from `Folder` for your application in `Application Settings` in Cloudways.

### Optional

- `KNOWN_HOSTS` - Known hosts entry for the server. Strongly recommended — omitting disables host key verification. See [KNOWN_HOSTS](#known_hosts) below.
- `SSH_PASSPHRASE` - Passphrase for the SSH private key (required by some managed hosts)
- `REMOTE_PORT` (defaults to 22)
- `SOURCE` (defaults to `public/`)
- `ARGS` or `RSYNC_ARGS` (default `-azvr --inplace --exclude='.*' --no-perms --no-times`)
- `EXCLUDE_FILE` (see below on handling excludes)
- `EXTRA_EXCLUDE` (see below on handling excludes)
- `CLOUDWAYS_API_TOKEN` (see below on resetting permissions)
- `CLOUDWAYS_SERVER_ID` (required when `CLOUDWAYS_API_TOKEN` is set)
- `CLOUDWAYS_APP_ID` (required when `CLOUDWAYS_API_TOKEN` is set)
- `RESET_PERMISSIONS_OWNERSHIP` (`master_user` or `sys_user`; omit to use the Cloudways default)
- `CLOUDWAYS_API_URL` (defaults to `https://api.cloudways.com/api/v1`)

## KNOWN_HOSTS

Without a `KNOWN_HOSTS` value the action connects with `StrictHostKeyChecking=no`, which disables host key verification and leaves the deploy vulnerable to MITM attacks. Setting this input enables `StrictHostKeyChecking=yes`.

**Get the value from your server (run this once locally):**

```bash
ssh-keyscan -H your-server-public-ip
```

Copy the output and store it as a GitHub secret, then pass it to the action:

```yaml
- name: Deploy to Cloudways
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    KNOWN_HOSTS: ${{ secrets.KNOWN_HOSTS }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    FOLDER_NAME: ${{ secrets.FOLDER_NAME }}
```

The private key file is deleted from the runner when the action exits.

## Reset Permissions via Cloudways API (Optional)

The deploy itself uses only SSH and rsync. It does not need the Cloudways API, so the retirement of the legacy
Cloudways API key (October 15, 2026) does not affect it.

If you also set `CLOUDWAYS_API_TOKEN`, the action resets the application's file and folder permissions after a
successful rsync, then waits for Cloudways to finish. Skip `CLOUDWAYS_API_TOKEN` to keep the SSH-only behavior.

The action uses a Cloudways **API access token**, not the legacy email + API key. The token goes in the
`Authorization: Bearer` header.

### Creating the Access Token

Only the primary Cloudways account owner can create access tokens. Team member accounts do not see the
**API Integration** menu.

1. Log in to the Cloudways Platform. From the profile dropdown (top right), click **API Integration**.
2. In the **Access Token Details** section, click **Create Access Token**.
3. **Access Token Name**: use a name that identifies the repository, e.g. `GitHub Deploy - mysite`. The name does
   not affect permissions.
4. **Expiration**: choose `1 day`, `1 month`, `3 months`, `6 months`, `1 year` or `Never`. Pick the shortest period
   you are willing to rotate on. When the token expires, the API step fails with HTTP 401 until you update the
   secret.
5. **Scope**: choose **Limited Access**, then expand each category and select only these two endpoints rather
   than ticking a whole category:

| Endpoint | Category | Purpose |
|---|---|---|
| `POST /app/manage/reset_permissions` | App Management | Reset file and folder permissions for the application |
| `GET /operation/{id}` | Operation | Check the status of the queued reset until it completes |

   Do not choose **Read-Only Access**, because it only covers `GET` requests and cannot run the reset. Do not choose
   **Full Access**, because it grants far more than this action needs. Limited Access is marked Beta by Cloudways,
   so the category names on screen may change.
6. Click **Create Access Token** and copy the token right away. Cloudways shows it **only once**. It cannot be viewed
   or regenerated later; if you lose it, revoke it and create a new one.
7. Save the token as a repository secret, e.g. `CLOUDWAYS_API_TOKEN`. Never commit it or paste it into logs,
   issues or screenshots.

To check the permissions later, open the token's three-dot menu in **Access Token Details** and choose
**View Scopes**. To stop the token working immediately, choose **Revoke**.

You can test the token before using it in a workflow. In the Cloudways API Playground, click **Authorize**, open the
**Access Token** tab, paste the token, and try `POST /app/manage/reset_permissions`.

### Finding the Server and Application IDs

Open the application in the Cloudways Platform. The URL looks like
`https://platform.cloudways.com/server/<SERVER_ID>/application/<APP_ID>/...`. Store both values as secrets or
variables.

### Troubleshooting the API Step

- **HTTP 401**: token is wrong, expired or revoked, or the secret name is misspelled.
- **HTTP 403**: token is missing one of the permissions listed above. Check them with **View Scopes**.
- **HTTP 400/422**: `CLOUDWAYS_SERVER_ID` or `CLOUDWAYS_APP_ID` is wrong.

If the API step fails, the files are already deployed. Only the permission reset failed, and the job fails so you
notice.

## Usage

See example in `examples/deploy.yml` and in this doc. Copy it into `.github/workflows/` of the repository you
deploy from, not this action's repository.

## Default Excludes

These files are **excluded by default** from deployment to protect your live WordPress installation. You can override this list with `EXCLUDE_FILE`, or append to this list with `EXTRA_EXCLUDE`

```javascript
const ALWAYS_EXCLUDE = [
  '*~',
  '.git',
  '.github',
  '.gitignore',
  '.DS_Store',
  '.svn',
  '.cvs',
  '*.bak',
  '*.swp',
  'Thumbs.db',
  '*.log',
  '.env',
  '.smushit-status',
  '.gitattributes',
  '/db-config.php',
  '/index.php',
  '/wp-activate.php',
  '/wp-admin/',
  '/wp-app.php',
  '/wp-atom.php',
  '/wp-blog-header.php',
  '/wp-comments-post.php',
  '/wp-commentsrss2.php',
  '/wp-config.php',
  '/wp-content/advanced-cache.php',
  '/wp-content/backup-db/',
  '/wp-content/blogs.dir/',
  '/wp-content/breeze-config/',
  '/wp-content/cache/',
  '/wp-content/drop-ins/',
  '/wp-content/index.php',
  '/wp-content/mu-plugins/',
  '/wp-content/mysql.sql',
  '/wp-content/object-cache.php',
  '/wp-content/plugins/',
  '/wp-content/themes/index.php',
  '/wp-content/themes/twenty*',
  '/wp-content/themes/variations/',
  '/wp-content/upgrade*',
  '/wp-content/uploads/',
  '/wp-content/webp-express',
  '/wp-content/wp-cache-config.php',
  '/wp-cron.php',
  '/wp-feed.php',
  '/wp-includes/',
  '/wp-links-opml.php',
  '/wp-load.php',
  '/wp-login.php',
  '/wp-mail.php',
  '/wp-pass.php',
  '/wp-rdf.php',
  '/wp-register.php',
  '/wp-rss.php',
  '/wp-rss2.php',
  '/wp-salt.php',
  '/wp-settings.php',
  '/wp-signup.php',
  '/wp-trackback.php',
  '/xmlrpc.php'
];
```

## Customizing Excludes

### Add to Default Excludes

Keep all default excludes and add more:

```yaml
EXTRA_EXCLUDE: 'custom-config.php,/wp-content/custom-cache/'
```

### Replace Default Excludes

Provide your own exclude file (replaces ALL defaults):

```yaml
EXCLUDE_FILE: './deploy/excludes.txt'
```

Create `excludes.txt` with one pattern per line:

```text
*.log
.env
/wp-config.php
node_modules/
```

### WARNING!
When specifying excludes, **be sure that the path matches exactly to the file you are looking to exclude**. Vague lines will create unintended consequences! For example, adding `index.php` will also exclude the `index.php` file in your theme folders. Use `/index.php` to specify the root index file only.

## Usage Examples

### Basic Deployment to a Cloudways Application folder

```yaml
name: Deploy to Ubuntu Server
on:
  push:
    branches: [prd]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Deploy to Server
        uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          REMOTE_USER: ${{ secrets.REMOTE_USER }}
          SOURCE: "./public/"
          FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
```

### Deploy with Custom Excludes

```yaml
- name: Deploy with Additional Excludes
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    SOURCE: "./public/"
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
    EXTRA_EXCLUDE: '/wp-content/custom-cache/,debug.log,*.tmp'
```

### Deploy without Delete After

```yaml
- name: Deploy with Delete After
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    SOURCE: "./public/"
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
    ARGS: "-azvr --inplace --exclude='.*' --no-perms --no-times"
```

### Deploy Using Base Path + Folder Name

```yaml
- name: Deploy to Specific Folder
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    TARGET_BASE: '/var/www'
    FOLDER_NAME: 'mysite'
    SOURCE: './public/'
```

### Deploy to User Home Directory

```yaml
- name: Deploy to User Directory
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    TARGET: '/home/username/public_html'
    SOURCE: './public/'
```

### Deploy with Custom Exclude File

```yaml
- name: Deploy with Custom Exclude File
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    SOURCE: "./public/"
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
    EXCLUDE_FILE: './deploy/excludes.txt'
```

### Deploy with Custom Port

```yaml
- name: Deploy with Custom SSH Port
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    REMOTE_PORT: 2222
    SOURCE: "./public/"
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
```

### Deploy with SSH Passphrase

```yaml
- name: Deploy with SSH Passphrase
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    SSH_PASSPHRASE: ${{ secrets.SSH_PASSPHRASE }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    SOURCE: './public/'
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
```

### Deploy and Reset Permissions

```yaml
- name: Deploy and Reset Permissions
  uses: fkwdigital/github-workflow-action-cloudways-application-wordpress@v1
  with:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
    REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
    REMOTE_USER: ${{ secrets.REMOTE_USER }}
    SOURCE: './public/'
    FOLDER_NAME: ${{ env.CLOUDWAYS_REMOTE_FOLDER }}
    CLOUDWAYS_API_TOKEN: ${{ secrets.CLOUDWAYS_API_TOKEN }}
    CLOUDWAYS_SERVER_ID: ${{ secrets.CLOUDWAYS_SERVER_ID }}
    CLOUDWAYS_APP_ID: ${{ secrets.CLOUDWAYS_APP_ID }}
```

## Troubleshooting

### rsync: failed to set times

This is expected with `--no-times` flag. Files are deployed successfully.

### No space left on device

Check available disk space on remote server. If you added your own rsync flags, consider using `--delete-after` flag to remove old files.

### Wrong directory deployed

Verify your `TARGET`, `TARGET_BASE`, and/or `FOLDER_NAME` is correct. `FOLDER_NAME` needs to match the `Folder` field provided in the Cloudways `Application Settings` exactly.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

## Support

- **Action Issues**: Open an issue on this repository
- **Cloudways API**: [Cloudways Support](https://support.cloudways.com)
- **Documentation**: [Cloudways API Docs](https://developers.cloudways.com/docs/)
