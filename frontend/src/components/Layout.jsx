import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, Users, Settings, LogOut, Shield, Upload } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { path: '/import', label: 'Імпорт', icon: Upload },
    { path: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { path: '/registry', label: 'Реєстр', icon: Users },
    { path: '/settings', label: 'Налаштування', icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            <h1 className="text-lg font-bold">Охорона праці</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Система обліку</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="mb-3 px-4">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-slate-400 capitalize">
              {user?.role === 'superadmin' ? 'Суперадмін' : 'Адміністратор'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Вийти</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
