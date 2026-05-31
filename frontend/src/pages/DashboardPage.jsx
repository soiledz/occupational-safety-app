import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { AlertTriangle, CheckCircle, AlertOctagon, Calendar } from 'lucide-react'

const categoryLabels = {
  instruction: 'Інструктаж',
  medical: 'Медогляд',
  extinguisher: 'Вогнегасники'
}

const categoryColors = {
  instruction: 'bg-blue-50 border-blue-200',
  medical: 'bg-purple-50 border-purple-200',
  extinguisher: 'bg-orange-50 border-orange-200'
}

export default function DashboardPage() {
  const { authFetch } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await authFetch('/api/dashboard')
      setData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Завантаження...</div>
  }

  if (!data) {
    return <div className="text-center py-12 text-red-500">Помилка завантаження даних</div>
  }

  const totalStats = Object.values(data.stats).reduce(
    (acc, cat) => ({
      overdue: acc.overdue + (cat?.overdue || 0),
      warning: acc.warning + (cat?.warning || 0),
      ok: acc.ok + (cat?.ok || 0)
    }),
    { overdue: 0, warning: 0, ok: 0 }
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Дашборд</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Просрочено</p>
              <p className="text-3xl font-bold text-red-600">{totalStats.overdue}</p>
            </div>
            <AlertOctagon className="w-10 h-10 text-red-200" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Увага (30 дн.)</p>
              <p className="text-3xl font-bold text-amber-600">{totalStats.warning}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-amber-200" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">В нормі</p>
              <p className="text-3xl font-bold text-emerald-600">{totalStats.ok}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-emerald-200" />
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Ближайші події (30 днів)
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.entries(data.upcoming).map(([category, records]) => (
          <div key={category} className={`rounded-xl border p-4 ${categoryColors[category]}`}>
            <h3 className="font-semibold text-slate-700 mb-3">
              {categoryLabels[category]} ({records.length})
            </h3>
            {records.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Немає подій на найближчі 30 днів</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {records.map(record => {
                  const isOverdue = new Date(record.next_date) < new Date()
                  return (
                    <div
                      key={record.id}
                      className={`p-3 rounded-lg text-sm ${
                        isOverdue ? 'bg-red-100 border border-red-200' : 'bg-white border border-slate-200'
                      }`}
                    >
                      <div className="font-medium text-slate-800">
                        {record.employee_name || record.object_name}
                      </div>
                      <div className="text-slate-500 text-xs mt-1">
                        {record.department_name && <span>{record.department_name} • </span>}
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                          {isOverdue ? 'Просрочено: ' : 'До: '}
                          {record.next_date}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
