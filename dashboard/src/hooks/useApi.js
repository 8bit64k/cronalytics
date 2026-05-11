import { useState, useEffect } from "../lib/sdk.js";

/**
 * Generic data-fetching hook.
 *
 * @param {string} path - API path (e.g. "/api/plugins/cronalytics/summary?days=30")
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Ingest fetchJSON from the SDK global at call time to avoid stale closure
    const { fetchJSON } = window.__HERMES_PLUGIN_SDK__;
    fetchJSON(path)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, reload]);

  return { data, loading, error, refetch: () => setReload((r) => r + 1) };
}

/**
 * Simple modal state toggle.
 *
 * @returns {{ isOpen: boolean, open: () => void, close: () => void }}
 */
export function useModal() {
  const [isOpen, setOpen] = useState(false);
  const open = () => setOpen(true);
  const close = () => setOpen(false);
  return { isOpen, open, close };
}
