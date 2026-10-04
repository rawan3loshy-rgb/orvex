/**
 * In-browser stand-in for the vendor's license server endpoint.
 *
 * In production an installation calls `POST https://license.orvex.io/v1/heartbeat`
 * during license validation and after updates. Only installation metadata crosses
 * the boundary — never orders, customers, resellers or credentials.
 */
export interface HeartbeatPayload {
  licenseId: string
  installationId: string
  domain: string
  version: string
  schemaVersion: string
  at: string
}

type Listener = (hb: HeartbeatPayload) => void

const listeners = new Set<Listener>()

export const licenseServer = {
  heartbeat(hb: Omit<HeartbeatPayload, 'at'>) {
    const payload = { ...hb, at: new Date().toISOString() }
    listeners.forEach((l) => l(payload))
    return payload
  },
  onHeartbeat(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
