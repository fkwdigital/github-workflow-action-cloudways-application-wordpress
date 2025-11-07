#!/usr/bin/env node
// Compute destination
function computeDest() {
  if (cfg.target) return cfg.target; // explicit wins
  if (!cfg.targetBase) return `/home/${cfg.user}/`; // sensible fallback
  const appended = cfg.folderName
    ? path.posix.join(cfg.targetBase, cfg.folderName)
    : cfg.targetBase;
  return appended.endsWith('/') ? appended : `${appended}/`;
}

const remoteDest = `${cfg.user}@${cfg.host}:${computeDest()}`;

// Build exclude list
const extra = cfg.extraExclude
  ? cfg.extraExclude
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];
const EXCLUDES = [...ALWAYS_EXCLUDE, ...extra];

// Ensure trailing slash for "copy contents" when using public/
function withTrailingSlash(p) {
  return p && !p.endsWith('/') ? `${p}/` : p;
}

const localSrc = path.posix.join(GITHUB_WORKSPACE, withTrailingSlash(cfg.source || ''));

console.log(`[general] GITHUB_WORKSPACE: ${GITHUB_WORKSPACE}`);
console.log(`[deploy] Local source → ${localSrc}`);
console.log(`[deploy] Remote dest → ${remoteDest}`);
console.log(`[deploy] Rsync args → ${cfg.rsyncArgs}`);
console.log(`[deploy] Always-excluding (${EXCLUDES.length}) patterns.`);

function runRsync(privateKeyPath) {
  validateRsync(() => {
    try {
      nodeRsync(
        {
          src: localSrc,
          dest: remoteDest,
          args: cfg.rsyncArgs.split(' ').filter(Boolean),
          privateKey: privateKeyPath,
          port: cfg.port,
          excludeFirst: EXCLUDES,
          ssh: true,
          sshCmdArgs: ['-o StrictHostKeyChecking=no'],
          recursive: true,
        },
        (error, stdout, stderr, cmd) => {
          if (error) {
            console.error('⚠️ [Rsync] error: ', error.message);
            console.log('⚠️ [Rsync] stderr: ', stderr);
            console.log('⚠️ [Rsync] stdout: ', stdout);
            console.log('⚠️ [Rsync] cmd: ', cmd);
            process.abort();
          } else {
            console.log('✅ [Rsync] finished.', stdout);
          }
        }
      );
    } catch (err) {
      console.error('⚠️ [Rsync] command error: ', err.message, err.stack);
      process.abort();
    }
  });
}

(function main() {
  // Prepare temp key
  const privateKeyPath = addSshKey(cfg.key, cfg.keyName);
  // Make sure ~/.ssh/known_hosts exists (idempotent)
  const osHome = process.env.HOME || require('os').homedir();
  validateDir(path.join(osHome, '.ssh'));
  validateFile(path.join(osHome, '.ssh', 'known_hosts'));
  // Rsync
  runRsync(privateKeyPath);
})();
