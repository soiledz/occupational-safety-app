import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Clock, Save, AlertCircle } from 'lucide-react'

const categoryLabels = {
  instruction: 'Інструктаж з охорони праці',
  medical: 'Медичний огляд',
  extinguisher: 'Перевірка вогнегасників'
}

const categoryDescriptions = {
  instruction: 'Періодичність проведення інструктажів для співробітників',
  medical: 'Періодичність проходження медичних оглядів',
  extinguisher: 'Періодичність перевірки вогнегасників'
}

const categoryIcons = {
  instruction: 'bg-blue-100 text-blue-600',
  medical: 'bg-purple-100 text-purple-600',
  extinguisher: 'bg-orange-100 text-orange-600'
}

export default function SettingsPage() {
  const { authFetch, user } = useAuth()
  const [settings, setSettings] = useState([])
  const [formValues, setFormValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await authFetch('/api/settings')
      setSettings(data)
      const values = {}
      data.forEach(s => {
        values[s.category] = s.months_period
      })
      setFormValues(values)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (category) => {
    setSaving(prev => ({ ...prev, [category]: true }))
    setMessage('')
    try {
      await authFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          category,
          months_period: parseInt(formValues[category])
        })
      })
      setMessage(`Періодичність для «${categoryLabels[category]}» оновлено`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(prev => ({ ...prev, [category]: false }))
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Завантаження...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Налаштування періодичності</h1>
      <p className="text-slate-500 mb-6">
        Встановіть періодичність (в місяцях) для кожної категорії контролю.
        При зміні періодичності всі наступні дати будуть перераховані автоматично.
      </p>

      {message && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
          <AlertCircle className="w-5 h-5" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(categoryLabels).map(([category, label]) => {
          const setting = settings.find(s => s.category === category)
          const value = formValues[category] || 12

          return (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${categoryIcons[category]}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{label}</h3>
                  <p className="text-xs text-slate-400">{categoryDescriptions[category]}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Періодичність (місяців)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={value}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [category]: e.target.value }))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={value}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [category]: e.target.value }))}
                    className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                <span>Поточне значення: <strong className="text-slate-700">{setting?.months_period || 12} міс.</strong></span>
              </div>

              <button
                onClick={() => handleSave(category)}
                disabled={saving[category] || parseInt(value) === (setting?.months_period || 12)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving[category] ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          )
        })}
      </div>

      {user?.role === 'superadmin' && (
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>Примітка для суперадміна:</strong> Ви бачите налаштування всіх лікарень.
            Для звичайного адміністратора відображаються лише налаштування його лікарні.
          </p>
        </div>
      )}
    </div>
  )
}
