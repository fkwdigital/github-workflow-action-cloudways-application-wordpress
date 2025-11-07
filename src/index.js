#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const rsync = require('rsyncwrapper');
const { sync: commandExists } = require('command-exists');

/* ----------------- helpers ----------------- */
function validateDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', { encoding: 'utf8', mode: 0o600 });
}
function addSshKey(key, name) {
  const home = process.env.HOME || require('os').homedir();
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  validateFile(path.join(sshDir, 'known_hosts'));
  const filePath = path.join(sshDir, name || 'deploy_key');
  fs.writeFileSync(filePath, key, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}
function ensureRsync(cb) {
  if (commandExists('rsync')) return cb();
  exec('sudo apt-get update && sudo apt-get --no-install-recommends install -y rsync', (err) => {
    if (err) {
      console.error('⚠️  [CLI] rsync install failed:', err.message);
      process.abort();
    }
    console.log('✅ [CLI] rsync installed');
    cb();
  });
}
function readExcludeFile(workspace, relPath) {
  if (!relPath) return [];
  const p = path.isAbsolute(relPath) ? relPath : path.join(workspace, relPath);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}
function withTrailingSlash(p) {
  return p && !p.endsWith('/') ? `${p}/` : p;
}
function splitArgs(argStr) {
  // turn "--exclude='.*' --no-perms" into ["--exclude=.*","--no-perms"]
  return (argStr || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((a) => a.replace(/^['"]|['"]$/g, ''))
    .map((a) => a.replace(/=(['"])(.*)\1$/, '=$2'));
}

/* --------- enforced WP/core excludes ---------- */
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
  'db-config.php',
  'index.php',
  'wp-activate.php',
  'wp-admin/',
  'wp-app.php',
  'wp-atom.php',
  'wp-blog-header.php',
  'wp-comments-post.php',
  'wp-commentsrss2.php',
  'wp-config.php',
  'wp-content/advanced-cache.php',
  'wp-content/backup-db/',
  'wp-content/blogs.dir/',
  'wp-content/breeze-config/',
  'wp-content/cache/',
  'wp-content/drop-ins/',
  'wp-content/index.php',
  'wp-content/mu-plugins/',
  'wp-content/mysql.sql',
  'wp-content/object-cache.php',
  'wp-content/plugins/',
  'wp-content/themes/index.php',
  'wp-content/themes/twenty*',
  'wp-content/themes/variations/',
  'wp-content/upgrade*',
  'wp-content/uploads/',
  'wp-content/webp-express',
  'wp-content/wp-cache-config.php',
  'wp-cron.php',
  'wp-feed.php',
  'wp-includes/',
  'wp-links-opml.php',
  'wp-load.php',
  'wp-login.php',
  'wp-mail.php',
  'wp-pass.php',
  'wp-rdf.php',
  'wp-register.php',
  'wp-rss.php',
  'wp-rss2.php',
  'wp-salt.php',
  'wp-settings.php',
  'wp-signup.php',
  'wp-trackback.php',
  'xmlrpc.php',
];

/* -------------------- main -------------------- */
function main() {
  const env = process.env;
  const IN = (k, d = '') => env[k] || env[`INPUT_${k}`] || d;
  const WORKSPACE = env.GITHUB_WORKSPACE || process.cwd();

  const cfg = {
    host: IN('REMOTE_HOST'),
    user: IN('REMOTE_USER'),
    port: IN('REMOTE_PORT', '22'),
    key: IN('SSH_PRIVATE_KEY'),
    keyName: IN('DEPLOY_KEY_NAME', 'deploy_key'),

    // you won’t set TARGET or TARGET_BASE in your flow; kept for fallback/compat
    target: IN('TARGET'),
    targetBase: IN('TARGET_BASE', ''),
    folderName: IN('FOLDER_NAME', ''),

    source: IN('SOURCE', 'public/'),
    rsyncArgs:
      IN('ARGS') || IN('RSYNC_ARGS', "-azvr --inplace --exclude='.*' --no-perms --no-times"),
    extraExclude: IN('EXTRA_EXCLUDE', ''),
    excludeFile: IN('EXCLUDE_FILE', ''),
  };

  // required inputs
  [
    ['host', 'REMOTE_HOST'],
    ['user', 'REMOTE_USER'],
    ['key', 'SSH_PRIVATE_KEY'],
  ].forEach(([k, label]) => {
    if (!cfg[k]) {
      console.error(`⚠️  [INPUTS] Missing required input: ${label}`);
      process.abort();
    }
  });

  // compute remote destination
  function computeDest() {
    // 1) explicit TARGET wins if provided
    if (cfg.target) return cfg.target.endsWith('/') ? cfg.target : `${cfg.target}/`;
    // 2) your desired default from FOLDER_NAME
    if (cfg.folderName) {
      const p = `applications/${cfg.folderName}/public_html`;
      return p.endsWith('/') ? p : `${p}/`;
    }
    // 3) (optional) TARGET_BASE + FOLDER_NAME if someone uses it
    if (cfg.targetBase) {
      const appended = cfg.folderName
        ? path.posix.join(cfg.targetBase, cfg.folderName)
        : cfg.targetBase;
      return appended.endsWith('/') ? appended : `${appended}/`;
    }
    // 4) fallback
    return `/home/${cfg.user}/`;
  }

  const remoteDest = `${cfg.user}@${cfg.host}:${computeDest()}`;
  const localSrc = path.posix.join(WORKSPACE, withTrailingSlash(cfg.source || ''));

  // build excludes
  const fileEx = readExcludeFile(WORKSPACE, cfg.excludeFile);
  const extra = cfg.extraExclude
    ? cfg.extraExclude
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const EXCLUDES = [...ALWAYS_EXCLUDE, ...fileEx, ...extra];

  console.log(`[deploy] Source   → ${localSrc}`);
  console.log(`[deploy] Dest     → ${remoteDest}`);
  console.log(`[deploy] Rsync    → ${cfg.rsyncArgs}`);
  console.log(`[deploy] Excludes → ${EXCLUDES.length} (always + file + extra)`);

  const keyPath = addSshKey(cfg.key, cfg.keyName);
  const home = env.HOME || require('os').homedir();
  validateDir(path.join(home, '.ssh'));
  validateFile(path.join(home, '.ssh', 'known_hosts'));

  ensureRsync(() => {
    try {
      rsync(
        {
          src: localSrc,
          dest: remoteDest,
          args: splitArgs(cfg.rsyncArgs),
          privateKey: keyPath,
          port: cfg.port,
          excludeFirst: EXCLUDES,
          ssh: true,
          sshCmdArgs: ['-o', 'StrictHostKeyChecking=no'],
          recursive: true,
        },
        (error, stdout, stderr, cmd) => {
          if (error) {
            console.error('⚠️  [rsync] error:', error.message);
            console.error('stderr:', stderr || '');
            console.error('cmd:', cmd || '');
            process.abort();
          } else {
            console.log('✅ [rsync] completed\n', stdout || '');
          }
        }
      );
    } catch (e) {
      console.error('⚠️  [rsync] threw:', e.message);
      process.abort();
    }
  });
}

main();
