#!/usr/bin/env node
require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 888:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = __nccwpck_require__(610);


/***/ }),

/***/ 610:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


var exec = (__nccwpck_require__(317).exec);
var execSync = (__nccwpck_require__(317).execSync);
var fs = __nccwpck_require__(896);
var path = __nccwpck_require__(928);
var access = fs.access;
var accessSync = fs.accessSync;
var constants = fs.constants || fs;

var isUsingWindows = process.platform == 'win32'

var fileNotExists = function(commandName, callback){
    access(commandName, constants.F_OK,
    function(err){
        callback(!err);
    });
};

var fileNotExistsSync = function(commandName){
    try{
        accessSync(commandName, constants.F_OK);
        return false;
    }catch(e){
        return true;
    }
};

var localExecutable = function(commandName, callback){
    access(commandName, constants.F_OK | constants.X_OK,
        function(err){
        callback(null, !err);
    });
};

var localExecutableSync = function(commandName){
    try{
        accessSync(commandName, constants.F_OK | constants.X_OK);
        return true;
    }catch(e){
        return false;
    }
}

var commandExistsUnix = function(commandName, cleanedCommandName, callback) {

    fileNotExists(commandName, function(isFile){

        if(!isFile){
            var child = exec('command -v ' + cleanedCommandName +
                  ' 2>/dev/null' +
                  ' && { echo >&1 ' + cleanedCommandName + '; exit 0; }',
                  function (error, stdout, stderr) {
                      callback(null, !!stdout);
                  });
            return;
        }

        localExecutable(commandName, callback);
    });

}

var commandExistsWindows = function(commandName, cleanedCommandName, callback) {
  // Regex from Julio from: https://stackoverflow.com/questions/51494579/regex-windows-path-validator
  if (!(/^(?!(?:.*\s|.*\.|\W+)$)(?:[a-zA-Z]:)?(?:(?:[^<>:"\|\?\*\n])+(?:\/\/|\/|\\\\|\\)?)+$/m.test(commandName))) {
    callback(null, false);
    return;
  }
  var child = exec('where ' + cleanedCommandName,
    function (error) {
      if (error !== null){
        callback(null, false);
      } else {
        callback(null, true);
      }
    }
  )
}

var commandExistsUnixSync = function(commandName, cleanedCommandName) {
  if(fileNotExistsSync(commandName)){
      try {
        var stdout = execSync('command -v ' + cleanedCommandName +
              ' 2>/dev/null' +
              ' && { echo >&1 ' + cleanedCommandName + '; exit 0; }'
              );
        return !!stdout;
      } catch (error) {
        return false;
      }
  }
  return localExecutableSync(commandName);
}

var commandExistsWindowsSync = function(commandName, cleanedCommandName, callback) {
  // Regex from Julio from: https://stackoverflow.com/questions/51494579/regex-windows-path-validator
  if (!(/^(?!(?:.*\s|.*\.|\W+)$)(?:[a-zA-Z]:)?(?:(?:[^<>:"\|\?\*\n])+(?:\/\/|\/|\\\\|\\)?)+$/m.test(commandName))) {
    return false;
  }
  try {
      var stdout = execSync('where ' + cleanedCommandName, {stdio: []});
      return !!stdout;
  } catch (error) {
      return false;
  }
}

var cleanInput = function(s) {
  if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
    s = "'"+s.replace(/'/g,"'\\''")+"'";
    s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
      .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
  }
  return s;
}

if (isUsingWindows) {
  cleanInput = function(s) {
    var isPathName = /[\\]/.test(s);
    if (isPathName) {
      var dirname = '"' + path.dirname(s) + '"';
      var basename = '"' + path.basename(s) + '"';
      return dirname + ':' + basename;
    }
    return '"' + s + '"';
  }
}

module.exports = function commandExists(commandName, callback) {
  var cleanedCommandName = cleanInput(commandName);
  if (!callback && typeof Promise !== 'undefined') {
    return new Promise(function(resolve, reject){
      commandExists(commandName, function(error, output) {
        if (output) {
          resolve(commandName);
        } else {
          reject(error);
        }
      });
    });
  }
  if (isUsingWindows) {
    commandExistsWindows(commandName, cleanedCommandName, callback);
  } else {
    commandExistsUnix(commandName, cleanedCommandName, callback);
  }
};

module.exports.sync = function(commandName) {
  var cleanedCommandName = cleanInput(commandName);
  if (isUsingWindows) {
    return commandExistsWindowsSync(commandName, cleanedCommandName);
  } else {
    return commandExistsUnixSync(commandName, cleanedCommandName);
  }
};


/***/ }),

/***/ 346:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


var spawn = (__nccwpck_require__(317).spawn)

var escapeSpaces = function(path) {
  if (typeof path === 'string') {
    return path.replace(/\b\s/g, '\\ ')
  } else {
    return path
  }
}

var escapeSpacesInOptions = function(options) {
  // Escape paths in the src, dest, include, exclude, and excludeFirst arguments
  ;['src', 'dest', 'include', 'exclude', 'excludeFirst'].forEach(function(
    optionKey
  ) {
    var option = options[optionKey]
    if (typeof option === 'string') {
      options[optionKey] = escapeSpaces(option)
    } else if (Array.isArray(option) === true) {
      options[optionKey] = option.map(escapeSpaces)
    }
  })

  return options
}

module.exports = function(options, callback) {
  options = options || {}
  options = Object.assign({}, options)
  options = escapeSpacesInOptions(options)

  var platform = options.platform || process.platform // Enable process.platform to be mocked in options for testing
  var isWin = platform === 'win32'

  if (typeof options.src === 'undefined') {
    throw new Error("'src' directory is missing from options")
  }

  if (typeof options.dest === 'undefined') {
    throw new Error("'dest' directory is missing from options")
  }

  var dest = options.dest

  if (typeof options.host !== 'undefined') {
    dest = options.host + ':' + options.dest
  }

  if (!Array.isArray(options.src)) {
    options.src = [options.src]
  }

  var args = [].concat(options.src)

  args.push(dest)

  // [rsync failed on windows, copying persmissions](https://github.com/jedrichards/rsyncwrapper/issues/28)
  // [set chmod flag by default on Windows](https://github.com/jedrichards/rsyncwrapper/pull/29)
  var chmodArg = (options.args || []).find(function(arg) {
    return arg.match(/--chmod=/)
  })
  if (isWin && !chmodArg) {
    args.push('--chmod=ugo=rwX')
  }

  if (typeof options.host !== 'undefined' || options.ssh) {
    args.push('--rsh')
    var rshCmd = 'ssh'
    if (typeof options.port !== 'undefined') {
      rshCmd += ' -p ' + options.port
    }
    if (typeof options.privateKey !== 'undefined') {
      rshCmd += ' -i ' + options.privateKey
    }
    if (typeof options.sshCmdArgs !== 'undefined') {
      rshCmd += ' ' + options.sshCmdArgs.join(' ')
    }
    args.push(rshCmd)
  }

  if (options.recursive === true) {
    args.push('--recursive')
  }

  if (options.times === true) {
    args.push('--times')
  }

  if (options.syncDest === true || options.deleteAll === true) {
    args.push('--delete')
    args.push('--delete-excluded')
  }

  if (options.syncDestIgnoreExcl === true || options.delete === true) {
    args.push('--delete')
  }

  if (options.dryRun === true) {
    args.push('--dry-run')
    args.push('--verbose')
  }

  if (
    typeof options.excludeFirst !== 'undefined' &&
    Array.isArray(options.excludeFirst)
  ) {
    options.excludeFirst.forEach(function(value, index) {
      args.push('--exclude=' + value)
    })
  }

  if (typeof options.include !== 'undefined' && Array.isArray(options.include)) {
    options.include.forEach(function(value, index) {
      args.push('--include=' + value)
    })
  }

  if (typeof options.exclude !== 'undefined' && Array.isArray(options.exclude)) {
    options.exclude.forEach(function(value, index) {
      args.push('--exclude=' + value)
    })
  }

  switch (options.compareMode) {
    case 'sizeOnly':
      args.push('--size-only')
      break
    case 'checksum':
      args.push('--checksum')
      break
  }

  if (typeof options.args !== 'undefined' && Array.isArray(options.args)) {
    args = [...new Set([...args, ...options.args])]
  }

  args = [...new Set(args)]

  var noop = function() {}
  var onStdout = options.onStdout || noop
  var onStderr = options.onStderr || noop

  var cmd = 'rsync '
  args.forEach(function(arg) {
    if (arg.substr(0, 4) === 'ssh ') {
      arg = '"' + arg + '"'
    }
    cmd += arg + ' '
  })
  cmd = cmd.trim()

  if (options.noExec) {
    callback(null, null, null, cmd)
    return
  }

  try {
    var stdout = ''
    var stderr = ''
    // Launch cmd in a shell just like Node's child_process.exec() does:
    // see https://github.com/joyent/node/blob/937e2e351b2450cf1e9c4d8b3e1a4e2a2def58bb/lib/child_process.js#L589
    var child
    if (isWin) {
      child = spawn('cmd.exe', ['/s', '/c', '"' + cmd + '"'], {
        windowsVerbatimArguments: true,
        stdio: [process.stdin, 'pipe', 'pipe'],
      })
    } else {
      child = spawn('/bin/sh', ['-c', cmd])
    }

    child.stdout.on('data', function(data) {
      onStdout(data)
      stdout += data
    })

    child.stderr.on('data', function(data) {
      onStderr(data)
      stderr += data
    })

    child.on('exit', function(code) {
      var err = null
      if (code !== 0) {
        err = new Error('rsync exited with code ' + code)
        err.code = code
      }
      callback(err, stdout, stderr, cmd)
    })
  } catch (err) {
    callback(err, null, null, cmd)
  }
}


/***/ }),

/***/ 317:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 857:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 928:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";


const path = __nccwpck_require__(928);
const fs = __nccwpck_require__(896);
const { exec } = __nccwpck_require__(317);
const rsync = __nccwpck_require__(346);
const { sync: commandExists } = __nccwpck_require__(888);

/* ----------------- helpers ----------------- */
function validateDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', { encoding: 'utf8', mode: 0o600 });
}
function addSshKey(key, name) {
  const home = process.env.HOME || (__nccwpck_require__(857).homedir)();
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
  const home = env.HOME || (__nccwpck_require__(857).homedir)();
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

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map