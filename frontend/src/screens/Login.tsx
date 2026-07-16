import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { ApiError } from '../api'

// Écran de connexion de RÉFÉRENCE. Le mécanisme (cookie de session) est complet ;
// le design final sera fourni par Claude Design.
export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Identifiants invalides' : 'Erreur de connexion')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="brand">BULK</h1>
        <p className="brand-sub">Prise de masse, sous contrôle.</p>
        <input
          className="field"
          placeholder="Identifiant"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="form-error">{error}</div>}
        <button className="btn-primary" disabled={busy || !username || !password}>
          {busy ? '…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
