import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import * as xlsx from 'xlsx'

export default function ImportPage() {
  const { authFetch } = useAuth()
  const [activeTab, setActiveTab] = useState('employees')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result)
      
      // ДОБАВИЛИ ОПЦИЮ: cellDates: true, чтобы даты парсились как объекты Date, а не числа
      const workbook = xlsx.read(data, { type: 'array', cellDates: true })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = xlsx.utils.sheet_to_json(firstSheet, { header: 1 })

      if (jsonData.length < 2) {
        setPreview([])
        return
      }

      const headers = jsonData[0]
      const rows = jsonData.slice(1, 6).map(row => {
        const obj = {}
        headers.forEach((h, i) => {
          let value = row[i]
          
          // Проверяем: если это объект даты, переводим его в строку YYYY-MM-DD для таблицы предпросмотра
          if (value instanceof Date && !isNaN(value.getTime())) {
            value = value.toISOString().split('T')[0]
          }
          
          obj[h] = value || ''
        })
        return obj
      })
      setPreview(rows)
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  const handleImport = async () => {
    if (!file) return

    setLoading(true)
    setResult(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        
        // ЗДЕСЬ ТОЖЕ ДОБАВИЛИ: cellDates: true, чтобы на бэкенд улетали ISO-строки дат вместо чисел
        const workbook = xlsx.read(data, { type: 'array', cellDates: true })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = xlsx.utils.sheet_to_json(firstSheet)

        const res = await authFetch(`/api/import/${activeTab}`, {
          method: 'POST',
          body: JSON.stringify({ data: jsonData })
        })

        setResult(res)
      } catch (err) {
        setResult({ error: err.message })
      } finally {
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const downloadTemplate = async (type) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = localStorage.getItem('token')

    const res = await fetch(`${API_URL}/api/import/template/${type}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) {
      alert('Failed to download template')
      return
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${type}.xls`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Імпорт даних з Excel</h1>
      <p className="text-slate-500 mb-6">
        Завантажуйте сотрудників та записи журналу з Excel-файлів.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab('employees'); setFile(null); setPreview([]); setResult(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'employees'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Сотрудники
        </button>
        <button
          onClick={() => { setActiveTab('records'); setFile(null); setPreview([]); setResult(null) }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'records'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Записи журналу
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Завантаження файлу
          </h3>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
          >
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              {file ? file.name : 'Натисніть або перетягніть Excel-файл'}
            </p>
            <p className="text-xs text-slate-400 mt-1">.xls, .xlsx</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {preview.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Попередній перегляд (перші 5 рядків):</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(preview[0]).map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-slate-700">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full mt-4 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {loading ? 'Імпорт...' : 'Імпортувати'}
          </button>
        </div>

        {/* Template & Results */}
        <div className="space-y-6">
          {/* Template download */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Шаблон для завантаження
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {activeTab === 'employees'
                ? 'Файл повинен містити колонки: ПІБ, Посада, Відділення'
                : 'Файл повинен містити колонки: ПІБ (або Об\'єкт), Категорія, Остання дата'}
            </p>
            <button
              onClick={() => downloadTemplate(activeTab)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачати шаблон
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className={`rounded-xl border p-6 ${result.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                {result.error ? (
                  <><AlertCircle className="w-5 h-5 text-red-600" /><span className="text-red-800">Помилка</span></>
                ) : (
                  <><CheckCircle className="w-5 h-5 text-emerald-600" /><span className="text-emerald-800">Результат імпорту</span></>
                )}
              </h3>

              {result.error ? (
                <p className="text-red-700 text-sm">{result.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-emerald-700">
                    <strong>Імпортовано:</strong> {result.imported} записів
                  </p>
                  {result.createdDepartments?.length > 0 && (
                    <p className="text-emerald-700">
                      <strong>Створено відділень:</strong> {result.createdDepartments.join(', ')}
                    </p>
                  )}
                  {result.errors?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-amber-700 font-medium mb-1">Помилки ({result.errors.length}):</p>
                      <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-amber-200 p-2">
                        {result.errors.map((err, i) => (
                          <div key={i} className="text-xs text-amber-800 py-1 border-b border-amber-100 last:border-0">
                            {err.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}