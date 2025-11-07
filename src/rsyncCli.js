// src/rsyncCli.js
const { sync: commandExists } = require('command-exists');
const { exec } = require('child_process');

const validateRsync = (callback = () => {}) => {
  const rsyncCli = commandExists('rsync');
  if (!rsyncCli) {
    exec('sudo apt-get --no-install-recommends install -y rsync', (err, stdout, stderr) => {
      if (err) {
        console.log('⚠️ [CLI] Rsync installation failed. Aborting ... ', err.message);
        process.abort();
      } else {
        console.log('✅ [CLI] Rsync installed.\n', stdout || '', stderr || '');
        callback();
      }
    });
  } else {
    callback();
  }
};

const validateInputs = (inputs) => {
  const keys = Object.keys(inputs);
  const ok = keys.filter((k) => {
    const v = inputs[k];
    if (!v) console.error(`⚠️ [INPUTS] ${k} is mandatory`);
    return v;
  });
  if (ok.length !== keys.length) {
    console.error('⚠️ [INPUTS] Inputs not valid, aborting ...');
    process.abort();
  }
};

module.exports = { validateRsync, validateInputs };
