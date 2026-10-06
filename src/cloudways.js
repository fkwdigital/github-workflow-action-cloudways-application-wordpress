const DEFAULT_API_URL = 'https://api.cloudways.com/api/v1';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_TIMEOUT_MS = 300000;

/**
 * Wait for the given number of milliseconds.
 *
 * @since 1.2.0
 * @param {number} ms - milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Send an authenticated request to the Cloudways API using an access token.
 *
 * @since 1.2.0
 * @param {object} opts
 * @param {string} opts.apiUrl - API base URL
 * @param {string} opts.token  - Cloudways API access token
 * @param {string} opts.method - HTTP method
 * @param {string} opts.path   - endpoint path, starting with /
 * @param {object} [opts.body] - form fields for POST requests
 * @returns {Promise<object>}
 */
async function request({ apiUrl, token, method, path, body }) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: body ? new URLSearchParams(body).toString() : undefined
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { raw: text };
  }

  if (!res.ok) {
    const hints = {
      401: 'token is invalid, expired or revoked',
      403: 'token lacks the required permission'
    };
    const hint = hints[res.status] ? ` (${hints[res.status]})` : '';
    throw new Error(`Cloudways API ${method} ${path} failed: HTTP ${res.status}${hint} ${text}`);
  }

  return data;
}

/**
 * Poll a Cloudways background operation until it completes or times out.
 *
 * @since 1.2.0
 * @param {object} opts
 * @param {string} opts.apiUrl      - API base URL
 * @param {string} opts.token       - Cloudways API access token
 * @param {string|number} opts.id   - operation id
 * @param {number} [opts.intervalMs] - delay between polls
 * @param {number} [opts.timeoutMs]  - max total wait
 * @returns {Promise<object>}
 */
async function waitForOperation({
  apiUrl,
  token,
  id,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const data = await request({ apiUrl, token, method: 'GET', path: `/operation/${id}` });
    const op = data.operation || {};

    if (String(op.is_completed) === '1' || op.is_completed === true) {
      if (String(op.status) === '-1') {
        throw new Error(`Cloudways operation ${id} failed: ${op.message || 'no message'}`);
      }
      return op;
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }

  throw new Error(`Cloudways operation ${id} did not complete within ${timeoutMs / 1000}s`);
}

/**
 * Reset file and folder permissions for a Cloudways application and wait for it to finish.
 *
 * @since 1.2.0
 * @param {object} opts
 * @param {string} opts.token       - Cloudways API access token
 * @param {string} opts.serverId    - Cloudways server id
 * @param {string} opts.appId       - Cloudways application id
 * @param {string} [opts.ownership] - optional ownership value (master_user or sys_user)
 * @param {string} [opts.apiUrl]    - API base URL
 * @returns {Promise<object>}
 */
async function resetPermissions({ token, serverId, appId, ownership = '', apiUrl = DEFAULT_API_URL }) {
  const body = { server_id: serverId, app_id: appId };
  if (ownership) body.ownership = ownership;

  const data = await request({ apiUrl, token, method: 'POST', path: '/app/manage/reset_permissions', body });

  if (!data.operation_id) return data;

  console.log(`[cloudways] Reset permissions queued (operation ${data.operation_id})`);
  return waitForOperation({ apiUrl, token, id: data.operation_id });
}

module.exports = {
  resetPermissions,
  waitForOperation,
  DEFAULT_API_URL
};
