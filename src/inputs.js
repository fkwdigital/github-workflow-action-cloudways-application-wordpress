const path = require('path');
const { DEFAULT_API_URL } = require('./cloudways');

const DEFAULT_ARGS = "-azvr --inplace --exclude='.*' --no-perms --no-times";
const DEFAULT_SOURCE = 'public/';

/**
 * Read an input value from the environment.
 * Looks for the bare key first, then `INPUT_<key>` (the convention GitHub Actions uses).
 *
 * @since 1.0.0
 * @param {string} key        - environment variable name
 * @param {string} [fallback] - value to return if the key is unset or empty
 * @returns {string}
 */
function fromEnv(key, fallback = '') {
  const has = Object.prototype.hasOwnProperty.call(process.env, key);
  const v = has ? process.env[key] : process.env[`INPUT_${key}`];
  return v === undefined || v === null || v === '' ? fallback : v;
}

/**
 * Append a trailing slash to a path if it does not already have one.
 *
 * @since 1.0.0
 * @param {string} p - path
 * @returns {string}
 */
function ensureSlash(p) {
  return p.endsWith('/') ? p : `${p}/`;
}

/**
 * Build the configuration object from action inputs.
 *
 * @since 1.0.0
 * @returns {object}
 */
function getInputs() {
  return {
    host: fromEnv('REMOTE_HOST'),
    user: fromEnv('REMOTE_USER'),
    port: fromEnv('REMOTE_PORT', '22'),
    key: fromEnv('SSH_PRIVATE_KEY'),
    passphrase: fromEnv('SSH_PASSPHRASE', ''),
    knownHosts: fromEnv('KNOWN_HOSTS', ''),
    keyName: fromEnv('DEPLOY_KEY_NAME', 'deploy_key'),
    target: fromEnv('TARGET', ''),
    targetBase: fromEnv('TARGET_BASE', ''),
    folderName: fromEnv('FOLDER_NAME', ''),
    source: fromEnv('SOURCE', DEFAULT_SOURCE),
    rsyncArgs: fromEnv('ARGS') || fromEnv('RSYNC_ARGS', DEFAULT_ARGS),
    excludeFile: fromEnv('EXCLUDE_FILE', ''),
    extraExclude: fromEnv('EXTRA_EXCLUDE', ''),
    apiToken: fromEnv('CLOUDWAYS_API_TOKEN', ''),
    apiUrl: fromEnv('CLOUDWAYS_API_URL', DEFAULT_API_URL),
    serverId: fromEnv('CLOUDWAYS_SERVER_ID', ''),
    appId: fromEnv('CLOUDWAYS_APP_ID', ''),
    permissionsOwnership: fromEnv('RESET_PERMISSIONS_OWNERSHIP', '')
  };
}

/**
 * Resolve the remote destination path from TARGET, TARGET_BASE and FOLDER_NAME.
 *
 * @since 1.0.0
 * @param {object} cfg - configuration object from getInputs()
 * @returns {string} remote path with a trailing slash
 */
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

/**
 * Validate required inputs. Throws if anything required is missing.
 *
 * @since 1.0.0
 * @param {object} cfg - configuration object from getInputs()
 * @returns {void}
 */
function assertRequired(cfg) {
  const missing = [];
  if (!cfg.host) missing.push('REMOTE_HOST');
  if (!cfg.user) missing.push('REMOTE_USER');
  if (!cfg.key) missing.push('SSH_PRIVATE_KEY');
  if (cfg.apiToken && !cfg.serverId) missing.push('CLOUDWAYS_SERVER_ID');
  if (cfg.apiToken && !cfg.appId) missing.push('CLOUDWAYS_APP_ID');
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
