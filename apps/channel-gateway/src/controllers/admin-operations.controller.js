function serviceError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function callService({ baseUrl, path, key, method = "GET", body }) {
  if (!baseUrl || !key) throw serviceError("Admin service integration is not configured", 503);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw serviceError("A required admin service is unavailable", 503);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw serviceError(result?.message || "A connected service returned an error", response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return result;
}

function makeHandler(options) {
  return async (req, res, next) => {
    try {
      const result = await options(req);
      return res.status(result.httpStatus || 200).json(result.body || result);
    } catch (error) {
      return next(error);
    }
  };
}

const identity = (path, method = "GET", bodyFromRequest) => req => callService({
  baseUrl: process.env.IDENTITY_SERVICE_URL,
  path,
  key: process.env.IDENTITY_INTERNAL_API_KEY,
  method,
  body: bodyFromRequest ? bodyFromRequest(req) : undefined
});
const config = (path, method = "GET", bodyFromRequest) => req => callService({
  baseUrl: process.env.CONFIG_SERVICE_URL,
  path,
  key: process.env.CONFIG_INTERNAL_API_KEY || process.env.INTERNAL_API_KEY,
  method,
  body: bodyFromRequest ? bodyFromRequest(req) : undefined
});
const conversation = (path, method = "GET", bodyFromRequest) => req => callService({
  baseUrl: process.env.CONVERSATION_SERVICE_URL || "http://127.0.0.1:3004",
  path,
  key: process.env.CONVERSATION_ADMIN_API_KEY,
  method,
  body: bodyFromRequest ? bodyFromRequest(req) : undefined
});
const sla = (path, method = "GET", bodyFromRequest) => req => callService({
  baseUrl: process.env.SLA_SERVICE_URL || "http://127.0.0.1:3005",
  path,
  key: process.env.GATEWAY_INTERNAL_API_KEY,
  method,
  body: bodyFromRequest ? bodyFromRequest(req) : undefined
});

const queryString = req => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

const handlers = {
  listEmployees: makeHandler(req => callService({
    baseUrl: process.env.IDENTITY_SERVICE_URL,
    path: `/api/employees${queryString(req)}`,
    key: process.env.IDENTITY_INTERNAL_API_KEY
  })),
  createEmployee: makeHandler(identity("/api/employees", "POST", req => req.body)),
  updateEmployeeStatus: makeHandler(req => identity(`/api/employees/${encodeURIComponent(req.params.id)}/status`, "PATCH", r => r.body)(req)),
  generateVerificationCode: makeHandler(req => identity("/api/verifications/codes", "POST", r => ({ employeeId: r.params.id }))(req)),
  generateOnboardingVerificationCode: makeHandler(req => identity("/api/verifications/codes", "POST", () => ({}))(req)),
  listGroups: makeHandler(req => config(`/internal/monitored-groups${queryString(req)}`)(req)),
  setGroupStatus: makeHandler(req => conversation(`/api/conversations/monitored-groups/${encodeURIComponent(req.params.id)}/status`, "PATCH", r => r.body)(req)),
  listConversations: makeHandler(req => conversation(`/api/conversations${queryString(req)}`)(req)),
  getOverview: makeHandler(req => sla(`/internal/admin/overview${queryString(req)}`)(req)),
  listSlas: makeHandler(req => sla(`/internal/admin/slas${queryString(req)}`)(req)),
  getReport: makeHandler(req => sla(`/internal/admin/reports/daily${queryString(req)}`)(req)),
  getResponseTimeReport: makeHandler(req => sla(`/internal/admin/reports/response-time${queryString(req)}`)(req)),
  getSettings: makeHandler(req => sla("/internal/admin/settings")(req)),
  updateSettings: makeHandler(req => sla("/internal/admin/settings", "PUT", r => r.body)(req))
};

module.exports = handlers;
