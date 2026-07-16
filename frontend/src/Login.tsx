import { useState, type FormEvent } from 'react'
import { useAuth } from './auth'
import { ApiError } from './api'
import { css } from './css'

// Écran de connexion néobrutaliste (créé pour matcher le design Claude Design,
// qui ne l'incluait pas). Mécanisme = cookie de session via useAuth().
export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setBusy(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(true)
      setShakeKey((k) => k + 1)
      if (!(err instanceof ApiError)) console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={css('min-height:100dvh;background:#E4E4E0;display:flex;align-items:center;justify-content:center;padding:22px')}>
      <form
        key={shakeKey}
        onSubmit={onSubmit}
        style={{
          ...css('width:340px;max-width:100%;background:#FAFAFA;border:3px solid #0A0A0A;border-radius:3px;padding:28px 22px 24px;box-shadow:12px 12px 0 rgba(10,10,10,.14)'),
          animation: error ? 'shake .5s ease' : undefined,
        }}
      >
        <div style={css('display:flex;align-items:center;gap:9px;margin-bottom:4px')}>
          <div style={css('width:18px;height:18px;background:#C6FF00;border:2px solid #0A0A0A')} />
          <span style={css('font-family:Anton;font-size:34px;letter-spacing:.5px;line-height:1')}>BULK</span>
        </div>
        <div style={css("font-family:Space Mono,monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#8A8A85;margin-bottom:24px")}>
          PRISE DE MASSE · SOUS CONTRÔLE
        </div>

        <div style={css('font-family:Space Mono,monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#0A0A0A;margin-bottom:6px')}>IDENTIFIANT</div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="identifiant"
          style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:12px;font-size:15px;font-weight:600;border-radius:2px;margin-bottom:14px')}
        />

        <div style={css('font-family:Space Mono,monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#0A0A0A;margin-bottom:6px')}>MOT DE PASSE</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:12px;font-size:15px;font-weight:600;border-radius:2px;margin-bottom:6px')}
        />

        <div style={{ ...css('height:18px;font-family:Space Mono,monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:#E10600;margin-bottom:8px'), visibility: error ? 'visible' : 'hidden' }}>
          IDENTIFIANTS INVALIDES
        </div>

        <button
          type="submit"
          disabled={busy || !username || !password}
          className="press-shadow"
          style={{
            ...css('width:100%;background:#0A0A0A;border:3px solid #0A0A0A;border-radius:2px;padding:15px;cursor:pointer;box-shadow:4px 4px 0 rgba(10,10,10,.2)'),
            opacity: busy || !username || !password ? 0.5 : 1,
          }}
        >
          <span style={css('font-family:Anton;font-size:21px;color:#C6FF00;letter-spacing:1px')}>{busy ? '…' : 'SE CONNECTER'}</span>
        </button>
      </form>
    </div>
  )
}
