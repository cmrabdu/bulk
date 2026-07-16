import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Aujourd’hui', icon: '🏠' },
  { to: '/history', label: 'Historique', icon: '📅' },
  { to: '/settings', label: 'Réglages', icon: '⚙️' },
]

export default function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
