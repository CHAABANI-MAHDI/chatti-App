const DEFAULT_API_BASE_URL = "http://localhost:5001";

const normalizeApiBaseUrl = (value) => {
  const raw = String(value || "").trim();
  const sanitized = raw.replace(/^['"]+|['"]+$/g, "");

  if (!sanitized) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\/localhost:5000\/?$/i.test(sanitized)) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\//i.test(sanitized)) {
    return sanitized.replace(/\/+$/, "");
  }

  if (/^:\d+$/i.test(sanitized)) {
    return `http://localhost${sanitized}`;
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);
