const PYTHON_API_BASE = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export const apiClient = {
  async get(path: string) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async post(path: string, body: unknown) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async put(path: string, body: unknown) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async delete(path: string) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};
