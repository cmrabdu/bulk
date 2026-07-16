import { useAuth } from './auth'
import { css } from './css'
import Login from './Login'
import Home from './Home'

export default function App() {
  const { authed } = useAuth()

  if (authed === null) {
    return (
      <div style={css('min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#E4E4E0;font-family:Space Mono,monospace;letter-spacing:.35em;color:#0A0A0A;font-weight:700')}>
        BULK
      </div>
    )
  }
  return authed ? <Home /> : <Login />
}
