const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const rsync = require('rsyncwrapper');
const { sync: commandExists } = require('command-exists');

const { getInputs, computeDest, assertRequired } = require('./inputs');
const { ALWAYS_EXCLUDE } = require('./excludes');
const { resetPermissions } = require('./cloudways');

function ensureRsync() {
  return new Promise((resolve, reject) => {
    if (commandExists('rsync')) {
      resolve();
      return;
    }
    exec('sudo apt-get update && sudo apt-get --no-install-recommends install -y rsync', (err) => {
      if (err) {
        reject(new Error(`rsync install failed: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Strip the passphrase from a private key file in-place so rsync can use it
 * directly with -i. Uses spawn to avoid shell injection with special characters.
 *
 * @since 1.1.0
 * @param {string} keyPath    - absolute path to the private key file
 * @param {string} passphrase - current passphrase protecting the key
 * @returns {Promise<void>}
 */
function removePassphrase(keyPath, passphrase) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ssh-keygen', ['-p', '-P', passphrase, '-N', '', '-f', keyPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh-keygen failed (exit ${code}): ${stderr}`));
        return;
      }
      console.log('[SSH] Key unlocked for deployment');
      resolve();
    });
  });
}

// Read an rsync --exclude-from file (if provided)
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

function splitArgsPreserveQuotes(str) {
  const tokens = (str || '').match(/(?:[^\s'"]+|'[^']*'|"[^"]*")+/g) || [];
  return tokens.map((t) => t.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1'));
}

function validateDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', { encoding: 'utf8', mode: 0o600 });
}
function addSshKey(key, name) {
  const home = process.env.HOME || os.homedir();
  const sshDir = path.join(home, '.ssh');
  validateDir(sshDir);
  validateFile(path.join(sshDir, 'known_hosts'));
  const filePath = path.join(sshDir, name || 'deploy_key');
  fs.writeFileSync(filePath, key, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

/**
 * Run optional Cloudways API steps after a successful rsync. Skipped when no access token is set.
 *
 * @since 1.2.0
 * @param {object} cfg - parsed action inputs
 * @returns {Promise<void>}
 */
async function runPostDeploy(cfg) {
  if (!cfg.apiToken) return;

  console.log(`[cloudways] Resetting permissions for app ${cfg.appId} on server ${cfg.serverId}`);
  await resetPermissions({
    token: cfg.apiToken,
    serverId: cfg.serverId,
    appId: cfg.appId,
    ownership: cfg.permissionsOwnership,
    apiUrl: cfg.apiUrl
  });
  console.log('✅ [cloudways] Permissions reset');
}

async function main() {
  const cfg = getInputs();
  assertRequired(cfg);

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const remoteDest = `${cfg.user}@${cfg.host}:${computeDest(cfg)}`;
  const localSrc = path.posix.join(
    workspace,
    cfg.source.endsWith('/') ? cfg.source : `${cfg.source}/`
  );

  // Merge excludes: always-on + file + extra (lint-friendly)
  const fileEx = readExcludeFile(workspace, cfg.excludeFile);
  const extra = (cfg.extraExclude || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const EXCLUDES = [...ALWAYS_EXCLUDE, ...fileEx, ...extra];

  console.log(`[deploy] Source → ${localSrc}`);
  console.log(`[deploy] Dest → ${remoteDest}`);
  console.log(`[deploy] Rsync → ${cfg.rsyncArgs}`);
  console.log(`[deploy] Excludes → ${EXCLUDES.length}`);

  const keyPath = addSshKey(cfg.key, cfg.keyName);
  const home = process.env.HOME || os.homedir();
  validateDir(path.join(home, '.ssh'));
  validateFile(path.join(home, '.ssh', 'known_hosts'));

  if (cfg.passphrase) {
    await removePassphrase(keyPath, cfg.passphrase);
  }

  await ensureRsync();

  rsync(
    {
      src: localSrc,
      dest: remoteDest,
      args: splitArgsPreserveQuotes(cfg.rsyncArgs), // pass your exact args
      privateKey: keyPath,
      port: cfg.port,
      excludeFirst: EXCLUDES,
      ssh: true,
      sshCmdArgs: ['-o', 'StrictHostKeyChecking=no'],
      recursive: true
    },
    (error, stdout, stderr, cmd) => {
      if (error) {
        console.error('⚠️  [rsync] error:', error.message);
        console.error('stderr:', stderr || '');
        console.error('cmd:', cmd || '');
        process.abort();
        return;
      }
      console.log('✅ [rsync] completed');
      if (stdout) console.log(stdout);
      runPostDeploy(cfg)
        .then(() => process.exit(0))
        .catch((e) => {
          console.error('⚠️  [cloudways] error:', e.message);
          process.exit(1);
        });
    }
  );
}

main();
