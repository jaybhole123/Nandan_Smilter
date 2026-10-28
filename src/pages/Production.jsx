import { useState, useMemo } from 'react'
import { useProductionStore } from '../store/useStore'
import { CsvDropzone } from '../components/CsvDropzone'
import OCRImageUploader from '../components/OCRImageUploader'
import { parseProductionOCR } from '../utils/ocrParsers'

const initialFormState = {
  metricName: 'Sponge Prod. (Mt)',
  percentValue: '',
  k1Value: '',
  k2Value: '',
  totalValue: '',
}

const defaultMetricOptions = [
  'Sponge Prod. (Mt)',
  '"A" GRADE',
  '"B" GRADE',
  'N.mag %',
  'CHAR(+6mm N.MAG)',
  'DOLO CHAR(-6mm)',
  'Esp Dust',
  'Bag filter dust',
]

const formatNumber = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.00'
  return Number(value).toFixed(2)
}

const Production = () => {
  const { entries, setEntries } = useProductionStore()
  const [rows, setRows] = useState([{ ...initialFormState, id: Date.now() }])
  const [editingId, setEditingId] = useState(null)
  const [editRows, setEditRows] = useState([])
  const [editDownTimeRemarks, setEditDownTimeRemarks] = useState("")
  const [toast, setToast] = useState(null)
  const [downTimeRemarks, setDownTimeRemarks] = useState('')

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const resetForm = () => {
    setRows([{ ...initialFormState, id: Date.now() }])
    setDownTimeRemarks('')
    setEditingId(null)
  }

  // --- Row Management ---
  const handleAddRow = () => {
    setRows(prev => [...prev, { ...initialFormState, id: Date.now() }])
  }

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      showToast('You must have at least one row.', 'error')
      return
    }
    setRows(prev => prev.filter(row => row.id !== id))
  }

  const handleRowChange = (id, field, value) => {
    setRows(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // --- Submit Handler ---
  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Prepare object dynamically from rows
    const formData = {}
    rows.forEach((row, index) => {
      // Map dynamic rows to flat keys like k1Row_0, k1Row_1 etc.
      formData[`k1Row_${index}`] = row.k1Value
      formData[`k2Row_${index}`] = row.k2Value
      formData[`metricRow_${index}`] = row.metricName
      formData[`percentRow_${index}`] = row.percentValue
      formData[`totalRow_${index}`] = row.totalValue
    })
    formData.downTimeRemarks = downTimeRemarks

    if (false) {
    } else {
      setEntries(prev => [...prev, { ...formData, id: Date.now() }])
      showToast('Production entry added successfully.')
    }
    resetForm()
  }

  const handleEdit = (id) => {
    const item = entries.find(i => i.id === id)
    if (item) {
      // Reconstruct rows from the stored flat object
      const loadedRows = []
      let index = 0
      while (item[`metricRow_${index}`] !== undefined) {
        loadedRows.push({
          id: Date.now() + index,
          metricName: item[`metricRow_${index}`] || '',
          percentValue: item[`percentRow_${index}`] || '',
          k1Value: item[`k1Row_${index}`] || '',
          k2Value: item[`k2Row_${index}`] || '',
          totalValue: item[`totalRow_${index}`] || '',
        })
        index++
      }
      setRows(loadedRows.length > 0 ? loadedRows : [{ ...initialFormState, id: Date.now() }])
      setDownTimeRemarks(item.downTimeRemarks || '')
      setEditingId(id)
    }
  }

  const handleEditRowChange = (index, field, value) => {
    setEditRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  const handleSaveInline = () => {
    const formData = {}
    editRows.forEach((row, index) => {
      formData[`k1Row_${index}`] = row.k1Value
      formData[`k2Row_${index}`] = row.k2Value
      formData[`metricRow_${index}`] = row.metricName
      formData[`percentRow_${index}`] = row.percentValue
      formData[`totalRow_${index}`] = row.totalValue
    })
    formData.downTimeRemarks = editDownTimeRemarks

    setEntries(prev => prev.map(item => item.id === editingId ? { ...item, ...formData } : item))
    showToast('Production entry updated.')
    setEditingId(null)
  }

  const handleCancelInline = () => setEditingId(null)

  const handleDelete = (id) => {
    if (window.confirm('Delete this production entry?')) {
      setEntries(prev => prev.filter(item => item.id !== id))
      showToast('Production entry removed.')
      if (editingId === id) resetForm()
    }
  }

  // --- CSV Upload Handler ---
  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      
      const newRows = []
      let parsedRemarks = ''
      
      for (let i = 0; i < lines.length; i++) {
        // Simple CSV parse splitting by comma, ignoring commas inside quotes could be complex but assuming standard format here.
        const columns = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        
        const metric = columns[0]
        if (!metric || metric.toUpperCase() === 'PRODUCTION' || metric.toUpperCase().includes('DOWN TIME REMARKS') || metric.toUpperCase().includes('METRIC / GRADE')) {
          continue
        }

        if (metric.toUpperCase().includes('REMARKS :') || metric.toUpperCase().includes('REMARKS:')) {
           parsedRemarks = columns[1] || ''
           continue
        }

        newRows.push({
          id: Date.now() + i,
          metricName: metric,
          percentValue: columns[1] || '',
          k1Value: columns[2] || '',
          k2Value: columns[3] || '',
          totalValue: columns[4] || '',
        })
      }
      
      if (newRows.length > 0) {
        setRows(newRows)
        if (parsedRemarks) setDownTimeRemarks(parsedRemarks)
        showToast(`Imported ${newRows.length} rows successfully. Click 'Add Entry' to save.`)
      } else {
        showToast('No valid data found in CSV.', 'error')
      }
    }
    reader.readAsText(file)
    if (e.target && e.target.value !== undefined) {
      e.target.value = '' 
    }
  }

  // --- OCR Upload Handler ---
  const handleOcrUpload = (extractedText) => {
    const { rows: ocrRows, remarks } = parseProductionOCR(extractedText)
    if (ocrRows && ocrRows.length > 0) {
      setRows(ocrRows)
      if (remarks) setDownTimeRemarks(remarks)
      showToast('OCR data extracted successfully. Please review the details.')
    } else {
      showToast('No valid production data found in OCR text.', 'error')
    }
  }

  // --- Render Form (Row-wise) ---
  const renderForm = () => (
    <div className="bg-white border border-slate-400 rounded-md p-1 sm:p-6 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mb-6 border-b border-slate-400 pb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          'Add New Production Entry'
        </h3>
        <div className="flex flex-wrap gap-1">
          <button type="submit" form="productionForm" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition shadow-sm">
            {editingId ? 'Update Entry' : 'Add Entry'}
          </button>
          
          <CsvDropzone
            onUpload={handleCsvUpload}
            className="px-6 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium rounded-md transition cursor-pointer flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CSV
          </CsvDropzone>

          <OCRImageUploader 
            onTextExtracted={handleOcrUpload} 
            className="px-6 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-medium rounded-md transition flex items-center gap-1"
          />

          <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-md transition">
            Reset
          </button>
        </div>
      </div>

      <form id="productionForm" onSubmit={handleSubmit} className="w-full">
        
        {/* Fixed Table Header */}
        <div className="grid grid-cols-5 gap-1 mb-2 px-2 font-bold text-xs text-slate-700 border-b-2 border-slate-400 pb-2">
          <div className="pl-2">METRIC / GRADE</div>
          <div className="text-center">%</div>
          <div className="text-center">K- 1</div>
          <div className="text-center">K- 2</div>
          <div className="text-center">TOTAL</div>
        </div>

        {/* Dynamic Rows */}
        <div className="space-y-3 mb-4 mt-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-5 gap-1 items-center">
              {/* Column 1: Metric Name (Dropdown + Custom Input allowed) */}
              <div>
                <input 
                  list={`metrics-${row.id}`}
                  value={row.metricName}
                  onChange={(e) => handleRowChange(row.id, 'metricName', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-400 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter or Select Metric"
                />
                <datalist id={`metrics-${row.id}`}>
                  {defaultMetricOptions.map(opt => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>

              {/* Column 2: Percent Value */}
              <div>
                <input 
                  type="text"
                  inputMode="decimal"
                  value={row.percentValue}
                  onChange={(e) => handleRowChange(row.id, 'percentValue', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-400 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="%"
                />
              </div>

              {/* Column 3: K1 Value */}
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={row.k1Value} 
                  onChange={(e) => handleRowChange(row.id, 'k1Value', e.target.value)} 
                  className="w-full px-3 py-2 bg-white border border-slate-400 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="0" 
                />
              </div>

              {/* Column 4: K2 Value */}
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={row.k2Value} 
                  onChange={(e) => handleRowChange(row.id, 'k2Value', e.target.value)} 
                  className="w-full px-3 py-2 bg-white border border-slate-400 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="0" 
                />
              </div>

              {/* Column 5: Total Value + Delete Button */}
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={row.totalValue} 
                  onChange={(e) => handleRowChange(row.id, 'totalValue', e.target.value)} 
                  className="w-full px-3 py-2 bg-white border border-slate-400 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="0" 
                />
                <button 
                  type="button" 
                  onClick={() => handleRemoveRow(row.id)}
                  className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Row Button */}
        <div className="mb-4">
          <button 
            type="button" 
            onClick={handleAddRow}
            className="flex items-center gap-1 px-4 py-2 border border-dashed border-blue-400 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 text-xs font-medium transition"
          >
            <span className="text-lg leading-none">+</span> Add Row
          </button>
        </div>

        {/* Remarks Row */}
        <div className="mt-3 border-t border-slate-400 pt-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Down Time Remarks</label>
          <textarea value={downTimeRemarks} onChange={(e) => setDownTimeRemarks(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-400 rounded-md text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Enter any down time remarks..."></textarea>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap gap-1 mt-6 justify-end">
          <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition shadow-sm">
            'Add Entry (Save to Table)'
          </button>
          <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-md transition">
            Reset
          </button>
        </div>
      </form>
    </div>
  )

  // --- Render Table ---
  const renderTable = () => {
    if (entries.length === 0) {
      return <p className="text-slate-500 text-center py-6 bg-slate-50 rounded-md border border-slate-400">No production entries added yet. Use the form above to add data.</p>
    }

    return (
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
            <th className="border border-slate-400 px-2 py-1.5 text-left w-1/4">Metric</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-[10%]">%</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-[15%]">K- 1</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-[15%]">K- 2</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-[15%]">Total</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-24 print:hidden">Actions</th>
          </tr>
        </thead>
        {entries.map(item => {
          // Extract dynamic rows dynamically
          const rowItems = []
          let index = 0
          while(item[`metricRow_${index}`] !== undefined) {
            rowItems.push({
              metric: item[`metricRow_${index}`],
              percent: item[`percentRow_${index}`] || '',
              k1: Number(item[`k1Row_${index}`]) || 0,
              k2: Number(item[`k2Row_${index}`]) || 0,
              total: item[`totalRow_${index}`] || ''
            })
            index++
          }

          return (
            
            <tbody key={item.id} className="text-slate-600 group">
              {editingId === item.id ? (
                <>
                  {editRows.map((r, i) => (
                    <tr key={i} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-400 px-2 py-1"><input type="text" value={r.metricName} onChange={e => handleEditRowChange(i, 'metricName', e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" /></td>
                      <td className="border border-slate-400 px-2 py-1"><input type="text" value={r.percentValue} onChange={e => handleEditRowChange(i, 'percentValue', e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-center" /></td>
                      <td className="border border-slate-400 px-2 py-1"><input type="number" value={r.k1Value} onChange={e => handleEditRowChange(i, 'k1Value', e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-center" /></td>
                      <td className="border border-slate-400 px-2 py-1"><input type="number" value={r.k2Value} onChange={e => handleEditRowChange(i, 'k2Value', e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-center" /></td>
                      <td className="border border-slate-400 px-2 py-1"><input type="number" value={r.totalValue} onChange={e => handleEditRowChange(i, 'totalValue', e.target.value)} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-center" /></td>
                      {i === 0 && (
                        <td rowSpan={editRows.length + 1} className="border border-slate-400 px-2 py-1.5 text-center align-middle bg-white">
                          <div className="flex flex-row justify-center items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={handleSaveInline} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </button>
                            <button onClick={handleCancelInline} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Cancel">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-orange-50/30">
                    <td colSpan="5" className="border border-slate-400 px-2 py-1.5 text-xs flex items-center gap-2">
                      <span className="font-semibold uppercase tracking-wider text-orange-600">Remarks:</span>
                      <input type="text" value={editDownTimeRemarks} onChange={e => setEditDownTimeRemarks(e.target.value)} className="flex-1 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-transparent" />
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  {rowItems.map((r, i) => (
                    <tr key={i} className="bg-white hover:bg-slate-50/80 transition-colors">
                      <td className="border border-slate-400 px-2 py-1.5 text-slate-800 font-medium">{r.metric}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center">{r.percent || '-'}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center">{formatNumber(r.k1)}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center">{formatNumber(r.k2)}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-800 font-semibold">{r.total || '-'}</td>
                      {i === 0 && (
                        <td rowSpan={rowItems.length + (item.downTimeRemarks ? 1 : 0)} className="border border-slate-400 px-2 py-1.5 text-center align-middle bg-white">
                          <div className="flex flex-row justify-center items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(item.id)} className="p-1.5 rounded transition-colors text-blue-500 hover:bg-blue-50" title="Edit">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {item.downTimeRemarks && (
                    <tr className="bg-orange-50/30">
                      <td colSpan="5" className="border border-slate-400 px-2 py-1.5 text-xs text-orange-800">
                        <span className="font-semibold uppercase tracking-wider text-orange-600 mr-2">Remarks:</span>
                        {item.downTimeRemarks}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>

          )
        })}
      </table>
    )
  }

  return (
    <div className="space-y-6 pb-10 px-2 sm:px-4 max-w-7xl mx-auto">
      
      {/* Production Form */}
      {renderForm()}

      {/* Production Table (White Theme) */}
      <div className="bg-white border border-slate-400 rounded p-1 sm:p-6 shadow-sm overflow-hidden">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Production Records</h2>
        {renderTable()}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed right-4 bottom-4 z-50 rounded-md px-2 py-1.5 shadow-lg border max-w-[90%] sm:max-w-md ${toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-600'}`}>
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}
    </div>
  )
} 

export default Production