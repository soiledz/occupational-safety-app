import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CheckCircle, Filter, Plus, Trash2, Edit3, X } from 'lucide-react'

const categoryLabels = {
  instruction: 'Інструктаж',
  medical: 'Медогляд',
  extinguisher: 'Вогнегасник'
}

const categoryBadgeColors = {
  instruction: 'bg-blue-100 text-blue-700',
  medical: 'bg-purple-100 text-purple-700',
  extinguisher: 'bg-orange-100 text-orange-700'
}

// Вспомогательная функция для очистки даты от ISO-хвоста PostgreSQL
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return dateStr.split('T')[0]
}

export default function RegistryPage() {
  const { authFetch } = useAuth()
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    employee_id: '',
    object_name: '',
    category: 'instruction',
    last_date: ''
  })

  useEffect(() => {
    loadData()
  }, [filterCategory, filterDept])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.append('category', filterCategory)
      if (filterDept) params.append('department_id', filterDept)

      const [recordsData, employeesData] = await Promise.all([
        authFetch(`/api/records?${params}`),
        authFetch('/api/employees')
      ])

      setRecords(recordsData)
      setEmployees(employeesData)

      // Extract unique departments
      const depts = [...new Map(employeesData.map(e => [e.department_id, { id: e.department_id, name: e.department_name }])).values()]
      setDepartments(depts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (id) => {
    try {
      await authFetch(`/api/records/${id}/complete`, { method: 'POST' })
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Видалити запис?')) return
    try {
      await authFetch(`/api/records/${id}`, { method: 'DELETE' })
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        employee_id: formData.category === 'extinguisher' ? null : parseInt(formData.employee_id)
      }
      if (editingRecord) {
        await authFetch(`/api/records/${editingRecord.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await authFetch('/api/records', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      setShowAddModal(false)
      setEditingRecord(null)
      setFormData({ employee_id: '', object_name: '', category: 'instruction', last_date: '' })
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const openEdit = (record) => {
    setEditingRecord(record)
    setFormData({
      employee_id: record.employee_id || '',
      object_name: record.object_name || '',
      category: record.category,
      // Форматируем для <input type="date">, которому нужен строгий формат YYYY-MM-DD
      last_date: record.last_date ? record.last_date.split('T')[0] : ''
    })
    setShowAddModal(true)
  }

  const getStatusColor = (nextDate) => {
    if (!nextDate) return 'text-slate-400'
    const today = new Date()
    const next = new Date(nextDate)
    const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'text-red-600 font-semibold'
    if (diffDays <= 30) return 'text-amber-600 font-semibold'
    return 'text-emerald-600'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Реєстр сотрудників та об'єктів</h1>
        <button
          onClick={() => {
            setEditingRecord(null)
            setFormData({ employee_id: '', object_name: '', category: 'instruction', last_date: '' })
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Додати запис
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <Filter className="w-5 h-5 text-slate-400" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="">Всі категорії</option>
          <option value="instruction">Інструктаж</option>
          <option value="medical">Медогляд</option>
          <option value="extinguisher">Вогнегасники</option>
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="">Всі відділення</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {(filterCategory || filterDept) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterDept('') }}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Скинути
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Категорія</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">ПІБ / Об'єкт</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Відділення</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Остання дата</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Наступна дата</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Завантаження...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Немає записів</td></tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${categoryBadgeColors[record.category]}`}>
                        {categoryLabels[record.category]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800">
                      {record.employee_name || record.object_name}
                      {record.position && <div className="text-xs text-slate-400">{record.position}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{record.department_name || '—'}</td>
                    {/* Применяем форматирование для Остання дата */}
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(record.last_date)}</td>
                    {/* Применяем форматирование для Наступна дата */}
                    <td className="px-6 py-4 text-sm">
                      <span className={getStatusColor(record.next_date)}>
                        {formatDate(record.next_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleComplete(record.id)}
                          title="Пройдено"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(record)}
                          title="Редагувати"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          title="Видалити"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingRecord ? 'Редагувати запис' : 'Новий запис'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категорія</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="instruction">Інструктаж</option>
                  <option value="medical">Медогляд</option>
                  <option value="extinguisher">Вогнегасник</option>
                </select>
              </div>

              {formData.category === 'extinguisher' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Назва об'єкта</label>
                  <input
                    type="text"
                    value={formData.object_name}
                    onChange={(e) => setFormData({ ...formData, object_name: e.target.value })}
                    placeholder="Вогнегасник №12"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Співробітник</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  >
                    <option value="">Оберіть співробітника</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} — {emp.department_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Остання дата</label>
                <input
                  type="date"
                  value={formData.last_date}
                  onChange={(e) => setFormData({ ...formData, last_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  {editingRecord ? 'Зберегти' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}