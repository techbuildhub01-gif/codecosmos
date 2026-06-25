// Talks to the Flask backend. The backend URL comes from VITE_API_URL
// (set in frontend/.env.local) and defaults to localhost:8000.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function fetchGalaxy(username) {
  const res = await fetch(`${API_URL}/api/galaxy/${encodeURIComponent(username)}`)
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('The backend returned an invalid response.')
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || `Request failed (${res.status}).`)
  }
  return data
}

export { API_URL }
