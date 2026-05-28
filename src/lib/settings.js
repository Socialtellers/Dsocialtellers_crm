// Simple settings stored in browser localStorage
// (real app, not an artifact — localStorage is fine here)

export const settings = {
  getCalendly: () => {
    try { return localStorage.getItem('calendly_link') || ''; }
    catch { return ''; }
  },
  setCalendly: (link) => {
    try { localStorage.setItem('calendly_link', link); }
    catch {}
  }
};
