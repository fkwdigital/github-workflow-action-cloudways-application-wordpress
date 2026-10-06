const path = require('path');

const { getInputs, computeDest, assertRequired } = require('./inputs');
const { ALWAYS_EXCLUDE } = require('./excludes');
const { readExcludeFile, splitList, splitArgsPreserveQuotes } = require('./helpers');
const { addSshKey, removePassphrase } = require('./sshKey');
const { ensureRsync, runRsync } = require('./rsyncCli');
const { resetPermissions } = require('./cloudways');

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

/**
 * Deploy the source folder over rsync + SSH, then run optional Cloudways API steps.
 *
 * @since 1.0.0
 * @returns {Promise<void>}
 */
async function main() {
  const cfg = getInputs();
  assertRequired(cfg);

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const remoteDest = `${cfg.user}@${cfg.host}:${computeDest(cfg)}`;
  const localSrc = path.posix.join(workspace, cfg.source.endsWith('/') ? cfg.source : `${cfg.source}/`);

  // merge excludes: always-on + file + extra
  const excludes = [...ALWAYS_EXCLUDE, ...readExcludeFile(workspace, cfg.excludeFile), ...splitList(cfg.extraExclude)];

  console.log(`[deploy] Source → ${localSrc}`);
  console.log(`[deploy] Dest → ${remoteDest}`);
  console.log(`[deploy] Rsync → ${cfg.rsyncArgs}`);
  console.log(`[deploy] Excludes → ${excludes.length}`);

  const keyPath = addSshKey(cfg.key, cfg.keyName);
  if (cfg.passphrase) {
    await removePassphrase(keyPath, cfg.passphrase);
  }

  await ensureRsync();

  const stdout = await runRsync({
    src: localSrc,
    dest: remoteDest,
    args: splitArgsPreserveQuotes(cfg.rsyncArgs),
    privateKey: keyPath,
    port: cfg.port,
    excludes
  });
  console.log('✅ [rsync] completed');
  if (stdout) console.log(stdout);

  await runPostDeploy(cfg);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('⚠️  [deploy] error:', e.message);
    process.exit(1);
  });
