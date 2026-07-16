import { Navigate, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import { useAuth } from './auth'
import Login from './screens/Login'
import Today from './screens/Today'
import AddFood from './screens/AddFood'
import History from './screens/History'
import SettingsScreen from './screens/Settings'

export default function App() {
  const { authed } = useAuth()

  if (authed === null) {
    return <div className="splash">Bulk…</div>
  }
  if (!authed) {
    return <Login />
  }

  return (
    <div className="app">
      <div className="app-body">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/add" element={<AddFood />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </div>
  )
}
