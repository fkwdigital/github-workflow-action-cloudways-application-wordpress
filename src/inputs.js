const path = require('path');

const DEFAULT_ARGS = "-azvr --inplace --exclude='.*' --no-perms --no-times";
const DEFAULT_SOURCE = 'public/';

function fromEnv(key, fallback = '') {
  const has = Object.prototype.hasOwnProperty.call(process.env, key);
  const v = has ? process.env[key] : process.env[`INPUT_${key}`];
  return v === undefined || v === null || v === '' ? fallback : v;
}

function ensureSlash(p) {
  return p.endsWith('/') ? p : `${p}/`;
}

function getInputs() {
  return {
    host: fromEnv('REMOTE_HOST'),
    user: fromEnv('REMOTE_USER'),
    port: fromEnv('REMOTE_PORT', '22'),
    key: fromEnv('SSH_PRIVATE_KEY'),
    keyName: fromEnv('DEPLOY_KEY_NAME', 'deploy_key'),
    target: fromEnv('TARGET', ''),
    targetBase: fromEnv('TARGET_BASE', ''),
    folderName: fromEnv('FOLDER_NAME', ''),
    source: fromEnv('SOURCE', DEFAULT_SOURCE),
    rsyncArgs: fromEnv('ARGS') || fromEnv('RSYNC_ARGS', DEFAULT_ARGS),
    excludeFile: fromEnv('EXCLUDE_FILE', ''),
    extraExclude: fromEnv('EXTRA_EXCLUDE', '')
  };
}

function computeDest(cfg) {
  if (cfg.target) return ensureSlash(cfg.target);

  if (cfg.folderName && !cfg.targetBase) {
    return ensureSlash(`applications/${cfg.folderName}/public_html`);
  }

  if (cfg.targetBase) {
    const appended = cfg.folderName
      ? path.posix.join(cfg.targetBase, cfg.folderName)
      : cfg.targetBase;
    return ensureSlash(appended);
  }

  return ensureSlash(`/home/${cfg.user}/`);
}

function assertRequired(cfg) {
  const missing = [];
  if (!cfg.host) missing.push('REMOTE_HOST');
  if (!cfg.user) missing.push('REMOTE_USER');
  if (!cfg.key) missing.push('SSH_PRIVATE_KEY');
  if (missing.length) {
    throw new Error(`Missing required inputs: ${missing.join(', ')}`);
  }
}

module.exports = {
  getInputs,
  computeDest,
  assertRequired,
  ensureSlash,
  DEFAULT_ARGS,
  DEFAULT_SOURCE
};
