const LOCATION_STORAGE_KEY = 'pf_user_location'

export function saveUserLocation(lat, lng) {
  const payload = {
    lat: Number(lat),
    lng: Number(lng),
    updatedAt: Date.now(),
  }
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function readUserLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null
    return { lat: parsed.lat, lng: parsed.lng, updatedAt: parsed.updatedAt || null }
  } catch {
    return null
  }
}

export function getBrowserLocation(options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        saveUserLocation(coords.lat, coords.lng)
        resolve(coords)
      },
      (err) => reject(err),
      options
    )
  })
}
