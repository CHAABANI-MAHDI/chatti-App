const DEFAULT_API_BASE_URL = "http://localhost:5001";

const normalizeApiBaseUrl = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\/localhost:5000\/?$/i.test(raw)) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }

  if (/^:\d+$/i.test(raw)) {
    return `http://localhost${raw}`;
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
);
