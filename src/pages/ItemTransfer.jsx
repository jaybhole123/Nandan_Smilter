import { useState, useEffect } from 'react'
import { localDb } from '../services/localDb'
import { CsvDropzone } from '../components/CsvDropzone'
import OCRImageUploader from '../components/OCRImageUploader'
import { parseItemTransferOCR } from '../utils/ocrParsers'
import DateFilter from '../components/DateFilter'

const initialUnifiedForm = {
  type: 'incoming', // 'incoming' or 'outgoing'
  mainHeading: '',
  partyName: '',
  materialName: '',
  vehicleNo: '',
  qty: '',
  rate: '',
}

const initialIncomingForm = {
  mainHeading: '',
  partyName: '',
  materialName: '',
  vehicleNo: '',
  qty: '',
  rate: '',
}

const initialOutgoingForm = {
  mainHeading: '',
  partyName: '',
  materialName: '',
  vehicleNo: '',
  qty: '',
  rate: '',
}

const formatNumber = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.000'
  return Number(value).toFixed(3)
}

const ItemTransfer = () => {
  // --- State Management ---
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  const [incomingList, setIncomingList] = useState([])
  const [outgoingList, setOutgoingList] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTransfers = () => {
    setIsLoading(true)
    let data = []
    if (date !== '') {
      data = localDb.select('item_transfers', (item) => {
        if (!item.created_at) return false
        return item.created_at >= `${date}T00:00:00` && item.created_at <= `${date}T23:59:59`
      })
    } else {
      data = localDb.select('item_transfers')
    }

    const incoming = data.filter(d => d.entry_type === 'incoming').map(item => ({
      id: item.id,
      mainHeading: '',
      partyName: item.party_name,
      materialName: item.material_name,
      vehicleNo: item.vehicle_no,
      qty: item.qty,
      rate: item.rate
    }))
    const outgoing = data.filter(d => d.entry_type === 'outgoing').map(item => ({
      id: item.id,
      mainHeading: '',
      partyName: item.party_name,
      materialName: item.material_name,
      vehicleNo: item.vehicle_no,
      qty: item.qty,
      rate: item.rate
    }))
    setIncomingList(incoming)
    setOutgoingList(outgoing)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTransfers()
  }, [date])
  
  const [unifiedForm, setUnifiedForm] = useState(initialUnifiedForm)
  const [editingIncomingId, setEditingIncomingId] = useState(null)
  const [editingOutgoingId, setEditingOutgoingId] = useState(null)
  const [editIncomingForm, setEditIncomingForm] = useState(initialIncomingForm)
  const [editOutgoingForm, setEditOutgoingForm] = useState(initialOutgoingForm)
  const [editingId, setEditingId] = useState(null)

  const [toast, setToast] = useState(null)
  const [incomingCsvPreview, setIncomingCsvPreview] = useState([])
  const [outgoingCsvPreview, setOutgoingCsvPreview] = useState([])

  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)

  // --- Helper Functions ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const resetUnifiedForm = () => {
    setUnifiedForm(initialUnifiedForm)
    setEditingId(null)
  }

  const handleUnifiedSubmit = async (e) => {
    e.preventDefault()
    if (!unifiedForm.partyName.trim() || !unifiedForm.materialName.trim()) {
      showToast('Party Name and Material are required.', 'error')
      return
    }

    const payload = {
      report_date: date,
      entry_type: unifiedForm.type,
      party_name: unifiedForm.partyName,
      material_name: unifiedForm.materialName,
      vehicle_no: unifiedForm.vehicleNo || null,
      qty: Number(unifiedForm.qty) || 0,
      rate: Number(unifiedForm.rate) || 0
    }

    setIsLoading(true)
    if (editingId) {
      localDb.update('item_transfers', editingId, payload)
      showToast('Entry updated successfully.')
      fetchTransfers()
    } else {
      localDb.insert('item_transfers', payload)
      showToast(`${unifiedForm.type === 'incoming' ? 'Incoming' : 'Outgoing'} entry added successfully.`)
      fetchTransfers()
    }
    setIsLoading(false)
    
    setUnifiedForm(prev => ({ ...initialUnifiedForm, type: prev.type }))
    setEditingId(null)
    setIsUnifiedModalOpen(false)
  }

  // Manual date formatting to match "DD.MM.YY" exactly
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${day}.${month}.${year.slice(-2)}`
  }

  const handleEditIncoming = (id) => {
    const item = incomingList.find(i => i.id === id)
    if (item) {
      setUnifiedForm({
        type: 'incoming',
        mainHeading: item.mainHeading || '',
        partyName: item.partyName,
        materialName: item.materialName,
        vehicleNo: item.vehicleNo || '',
        qty: item.qty || '',
        rate: item.rate || '',
      })
      setEditingId(id)
      setIsUnifiedModalOpen(true)
    }
  }

  const handleDeleteIncoming = (id) => {
    if (window.confirm('Delete this incoming entry?')) {
      setIsLoading(true)
      localDb.delete('item_transfers', id)
      showToast('Incoming entry removed.')
      fetchTransfers()
      if (editingId === id) resetUnifiedForm()
      setIsLoading(false)
    }
  }

  const handleEditOutgoing = (id) => {
    const item = outgoingList.find(i => i.id === id)
    if (item) {
      setUnifiedForm({
        type: 'outgoing',
        mainHeading: item.mainHeading || '',
        partyName: item.partyName,
        materialName: item.materialName,
        vehicleNo: item.vehicleNo || '',
        qty: item.qty || '',
        rate: item.rate || '',
      })
      setEditingId(id)
      setIsUnifiedModalOpen(true)
    }
  }

  const handleDeleteOutgoing = (id) => {
    if (window.confirm('Delete this outgoing entry?')) {
      setIsLoading(true)
      localDb.delete('item_transfers', id)
      showToast('Outgoing entry removed.')
      fetchTransfers()
      if (editingId === id) resetUnifiedForm()
      setIsLoading(false)
    }
  }

  const handleCsvUpload = (e, fallbackType) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n')
      
      const newIncomingRows = []
      const newOutgoingRows = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        
        if (columns.length < 3) continue; 
        if (columns[0] && columns[0].toUpperCase() === 'ENTRY TYPE') continue;
        
        let typeVal = columns[0] ? columns[0].toUpperCase() : ''
        let isUnifiedFormat = typeVal === 'INCOMING' || typeVal === 'OUTGOING'
        
        let partyName, materialName, vehicleNo, qty, rate
        
        if (isUnifiedFormat) {
          partyName = columns[2] || ''
          materialName = columns[3] || ''
          vehicleNo = columns[4] || ''
          qty = columns[5] || '0'
          rate = columns[6] || '0'
        } else {
          if (columns[0].toUpperCase() === 'S.NO' || columns[1].toUpperCase() === 'PARTY NAME') continue;
          partyName = columns[1] || ''
          materialName = columns[2] || ''
          vehicleNo = columns[3] || ''
          qty = columns[4] || '0'
          rate = columns[5] || '0'
          typeVal = fallbackType.toUpperCase()
        }
        
        if (partyName && partyName.toUpperCase() !== 'PARTY NAME') {
          const entry = {
            id: Date.now() + i + Math.random(),
            mainHeading: '', 
            partyName: partyName,
            materialName: materialName,
            vehicleNo: vehicleNo,
            qty: qty,
            rate: rate,
          }
          if (typeVal === 'INCOMING') {
            newIncomingRows.push(entry)
          } else {
            newOutgoingRows.push(entry)
          }
        }
      }
      
      if (newIncomingRows.length > 0 || newOutgoingRows.length > 0) {
        if (newIncomingRows.length > 0) setIncomingCsvPreview(prev => [...prev, ...newIncomingRows])
        if (newOutgoingRows.length > 0) setOutgoingCsvPreview(prev => [...prev, ...newOutgoingRows])
        
        const msg = []
        if (newIncomingRows.length > 0) msg.push(`${newIncomingRows.length} incoming`)
        if (newOutgoingRows.length > 0) msg.push(`${newOutgoingRows.length} outgoing`)
        showToast(`Ready to preview: ${msg.join(' & ')} entries.`)
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
    const parsedData = parseItemTransferOCR(extractedText)
    const newRows = parsedData.map((row, index) => ({
      ...row,
      id: `${row.type}-${row.serialNo || index}-${Date.now()}`,
      mainHeading: '',
      vehicleNo: row.vehicleNo || '',
      qty: row.qty || '',
      rate: row.rate || ''
    }))
    const incomingRows = newRows.filter(row => row.type === 'incoming')
    const outgoingRows = newRows.filter(row => row.type === 'outgoing')

    if (incomingRows.length === 0 && outgoingRows.length === 0) {
      showToast('No transfer rows could be read from the image.', 'error')
      return
    }

    setIncomingCsvPreview(incomingRows)
    setOutgoingCsvPreview(outgoingRows)
    showToast(`OCR extracted ${newRows.length} transfer rows. Review and save each section.`)
  }

  // --- Render Table (Reusable) ---
  const renderTable = (type, list, onEdit, onDelete, isPreview = false) => {
    const title = type === 'incoming' ? 'INCOMING' : 'OUTGOING'
    return (
      <div className="mb-8">
        <div className="overflow-hidden bg-white border border-slate-400 rounded shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className={`px-6 py-4 border-b border-slate-400 flex items-center justify-between ${type === 'incoming' ? 'bg-blue-50/50' : 'bg-indigo-50/50'}`}>
            <h4 className={`font-bold text-xs uppercase tracking-wider ${type === 'incoming' ? 'text-blue-700' : 'text-indigo-700'}`}>
              {title}
            </h4>
            <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-400 shadow-sm">{list.length} Entries</span>
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="px-2 py-1.5 w-16 border border-slate-400">#</th>
                  <th className="px-2 py-1.5 min-w-[180px] border border-slate-400">Party Name</th>
                  <th className="px-2 py-1.5 min-w-[150px] border border-slate-400">Material Name</th>
                  <th className="px-2 py-1.5 w-24 border border-slate-400">Vehicle No</th>
                  <th className="px-2 py-1.5 w-24 text-right border border-slate-400">Qty.</th>
                  <th className="px-2 py-1.5 w-24 text-right border border-slate-400">RATE 18%</th>
                  <th className="px-2 py-1.5 w-28 text-center print:hidden border border-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 bg-white border border-slate-400">
                      <div className="flex flex-row justify-center items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        No {title.toLowerCase()} entries found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  list.map((item, index) => (
                    <tr key={item.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                          <td className="px-2 py-1.5 text-slate-400 font-medium border border-slate-400">{index + 1}</td>
                          <td className="px-2 py-1.5 text-slate-800 font-medium border border-slate-400">{item.partyName}</td>
                          <td className="px-2 py-1.5 text-slate-700 border border-slate-400">{item.materialName}</td>
                          <td className="px-2 py-1.5 text-slate-700 border border-slate-400">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-medium border border-slate-400">{item.vehicleNo || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-800 font-semibold border border-slate-400">{formatNumber(item.qty)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-700 border border-slate-400">{item.rate || '0'}</td>
                          <td className="px-2 py-1.5 text-center print:hidden border border-slate-400">
                            {!isPreview && (
                              <div className="flex justify-center gap-1 transition-opacity">
                                <button onClick={() => onEdit(item.id)} className="p-1.5 rounded transition-colors text-blue-500 hover:bg-blue-50" title="Edit">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => onDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12 pt-4 px-4 sm:px-6 max-w-7xl mx-auto text-slate-800">
      
      {/* Date Header (Modern Gradient Box) */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded p-4 md:px-8 md:py-5 shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-1">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-400 opacity-20 blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-baseline gap-1.5 sm:gap-2">
          <span className="text-blue-200 text-xs font-semibold tracking-[0.15em] uppercase">Module</span>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide drop-shadow-md">
            Item Transfers
          </h2>
        </div>
      </div>

      {/* Single Row: Action Buttons + Image Upload + Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsUnifiedModalOpen(true)}
            className="px-6 py-2.5 rounded-lg text-white font-bold shadow shadow-blue-500/30 active:Sale-[0.98] transition-all flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span>Add Transfer Entry</span>
          </button>
          
          <OCRImageUploader 
            onTextExtracted={handleOcrUpload} 
            className="px-4 h-10 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 font-bold rounded-lg" 
          />

          <button 
            onClick={() => setIsPromptModalOpen(true)}
            className="px-4 h-10 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 active:Sale-[0.98]"
            title="Get AI Prompt for CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">AI Prompt</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DateFilter date={date} onChange={setDate} />
        </div>
      </div>

      {isUnifiedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => { setIsUnifiedModalOpen(false); resetUnifiedForm(); }}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all relative z-10 border border-slate-100 flex flex-col">
            
            {/* Header */}
            <div className="px-8 py-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <h3 className="font-bold text-xl flex items-center gap-2.5 tracking-wide">
                {editingId ? 'Edit Transfer Entry' : 'Add Transfer Entry'}
              </h3>
              <button onClick={() => { setIsUnifiedModalOpen(false); resetUnifiedForm(); }} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-8 bg-slate-50/30">
              <form onSubmit={handleUnifiedSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-end">
                
                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Entry Type</label>
                  <select
                    value={unifiedForm.type}
                    onChange={(e) => setUnifiedForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-blue-400 focus:ring-blue-500/10 font-bold uppercase"
                  >
                    <option value="incoming">Incoming</option>
                    <option value="outgoing">Outgoing</option>
                  </select>
                </div>



                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Party Name</label>
                  <input
                    type="text"
                    value={unifiedForm.partyName}
                    onChange={(e) => setUnifiedForm(prev => ({ ...prev, partyName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-blue-400 focus:ring-blue-500/10"
                    placeholder="e.g. HINDUSTAN DHAATU LTD."
                  />
                </div>
                
                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Material Name</label>
                  <input
                    type="text"
                    value={unifiedForm.materialName}
                    onChange={(e) => setUnifiedForm(prev => ({ ...prev, materialName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-blue-400 focus:ring-blue-500/10"
                    placeholder="e.g. IRON ORE PELLET"
                  />
                </div>
                
                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Vehicle No</label>
                  <input
                    type="text"
                    inputMode="text"
                    value={unifiedForm.vehicleNo}
                    onChange={(e) => setUnifiedForm(prev => ({ ...prev, vehicleNo: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-blue-400 focus:ring-blue-500/10"
                    placeholder="e.g. MH 04 AB 1234"
                  />
                </div>
                
                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Qty.</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={unifiedForm.qty}
                      onChange={(e) => setUnifiedForm(prev => ({ ...prev, qty: e.target.value }))}
                      className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm text-right focus:border-blue-400 focus:ring-blue-500/10"
                      placeholder="0.000"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">MT</span>
                  </div>
                </div>
                
                <div className="group">
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-slate-500 group-focus-within:text-blue-600">Rate 18%</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
                    <input
                      type="number"
                      value={unifiedForm.rate}
                      onChange={(e) => setUnifiedForm(prev => ({ ...prev, rate: e.target.value }))}
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm text-right focus:border-blue-400 focus:ring-blue-500/10"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2 xl:col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setIsUnifiedModalOpen(false); resetUnifiedForm(); }} className="px-6 py-3 text-slate-600 bg-white hover:bg-slate-100 rounded-xl font-bold transition-all w-full xl:w-auto text-xs uppercase tracking-wider flex items-center justify-center border border-slate-200 shadow-sm active:Sale-95">
                    Cancel
                  </button>
                  <button type="submit" className="px-8 py-3 text-white rounded-xl font-bold transition-all w-full xl:w-auto text-xs uppercase tracking-wider flex items-center justify-center shadow-lg hover:shadow-xl active:Sale-95 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30">
                    {editingId ? 'Update Entry' : 'Add Row'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Incoming Section --- */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-2 mb-2">
          <h2 className="text-2xl font-bold text-slate-800">Incoming Setup</h2>
          <div className="h-px bg-slate-200 flex-1"></div>
          <CsvDropzone
            onUpload={(e) => handleCsvUpload(e, 'incoming')}
            disabled={incomingCsvPreview.length > 0}
            className={`px-5 py-2 border font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:Sale-[0.98] ${incomingCsvPreview.length > 0 ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 hover:border-emerald-300'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload CSV</span>
          </CsvDropzone>
        </div>
        
        {incomingCsvPreview.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded p-6 mb-6 shadow-sm print:hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="bg-emerald-500 text-white w-8 h-8 rounded-md flex items-center justify-center text-xs shadow-sm">{incomingCsvPreview.length}</span>
                Preview Incoming Data
              </h2>
              <div className="flex gap-1.5">
                <button onClick={() => { 
                  setIsLoading(true);
                  const payloads = incomingCsvPreview.map(r => ({
                    report_date: date,
                    entry_type: 'incoming',
                    party_name: r.partyName,
                    material_name: r.materialName,
                    vehicle_no: r.vehicleNo || null,
                    qty: Number(r.qty) || 0,
                    rate: Number(r.rate) || 0
                  }));
                  localDb.insert('item_transfers', payloads);
                  setIncomingCsvPreview([]); 
                  showToast('Data saved to incoming successfully.');
                  fetchTransfers();
                  setIsLoading(false);
                }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-all shadow-sm active:Sale-[0.98]">Save Data</button>
                <button onClick={() => setIncomingCsvPreview([])} className="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 font-medium rounded-md transition-all active:Sale-[0.98]">Cancel</button>
              </div>
            </div>
            {renderTable('incoming', incomingCsvPreview, null, null, true)}
          </div>
        )}

        {renderTable('incoming', incomingList, handleEditIncoming, handleDeleteIncoming, false)}
      </div>

      {/* --- Outgoing Section --- */}
      <div className="space-y-2 mt-12">
        <div className="flex items-center gap-1.5 px-2 mb-2">
          <h2 className="text-2xl font-bold text-slate-800">Outgoing Setup</h2>
          <div className="h-px bg-slate-200 flex-1"></div>
          <CsvDropzone
            onUpload={(e) => handleCsvUpload(e, 'outgoing')}
            disabled={outgoingCsvPreview.length > 0}
            className={`px-5 py-2 border font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:Sale-[0.98] ${outgoingCsvPreview.length > 0 ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 hover:border-emerald-300'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload CSV</span>
          </CsvDropzone>
        </div>
        
        {outgoingCsvPreview.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded p-6 mb-6 shadow-sm print:hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="bg-emerald-500 text-white w-8 h-8 rounded-md flex items-center justify-center text-xs shadow-sm">{outgoingCsvPreview.length}</span>
                Preview Outgoing Data
              </h2>
              <div className="flex gap-1.5">
                <button onClick={() => { 
                  setIsLoading(true);
                  const payloads = outgoingCsvPreview.map(r => ({
                    report_date: date,
                    entry_type: 'outgoing',
                    party_name: r.partyName,
                    material_name: r.materialName,
                    vehicle_no: r.vehicleNo || null,
                    qty: Number(r.qty) || 0,
                    rate: Number(r.rate) || 0
                  }));
                  localDb.insert('item_transfers', payloads);
                  setOutgoingCsvPreview([]); 
                  showToast('Data saved to outgoing successfully.');
                  fetchTransfers();
                  setIsLoading(false);
                }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-all shadow-sm active:Sale-[0.98]">Save Data</button>
                <button onClick={() => setOutgoingCsvPreview([])} className="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 font-medium rounded-md transition-all active:Sale-[0.98]">Cancel</button>
              </div>
            </div>
            {renderTable('outgoing', outgoingCsvPreview, null, null, true)}
          </div>
        )}

        {renderTable('outgoing', outgoingList, handleEditOutgoing, handleDeleteOutgoing, false)}
      </div>

      {/* AI Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsPromptModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all relative z-10 border border-slate-100 flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-600 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                AI Prompt for CSV Generation
              </h3>
              <button onClick={() => setIsPromptModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Copy the prompt below and paste it into ChatGPT, Claude, or any AI along with an image of your INCOMING or OUTGOING transfer table. It will generate a CSV file in the exact format required for upload.</p>
              
              <div className="relative group">
                <pre className="bg-slate-50 border border-slate-200 text-slate-800 text-sm p-4 rounded-xl whitespace-pre-wrap font-mono leading-relaxed h-[300px] overflow-y-auto">
{`Please extract the data from the attached image of the "INCOMING / OUTGOING" transfer table and convert it into a strictly formatted CSV.

Instructions:
1. Use EXACTLY these 6 column headers in this exact order for the first row:
S.NO, PARTY NAME, MATERIAL NAME, VEHICLE NO, QTY, RATE 18%

2. Ensure all values are separated by commas.
3. If a column is empty or has a hyphen (-) in the image, output an empty string for that field. 
4. Do not include any subtotal rows or main category headers (like "INCOMING" or "OUTGOING") as data rows. Only include the actual entry rows with the party names.
5. Make sure numeric values like quantities and rates do not have commas in them (e.g., use 1000.00 instead of 1,000.00).
6. Output ONLY the raw CSV text inside a code block, without any extra explanations or greetings.`}
                </pre>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`Please extract the data from the attached image of the "INCOMING / OUTGOING" transfer table and convert it into a strictly formatted CSV.\n\nInstructions:\n1. Use EXACTLY these 6 column headers in this exact order for the first row:\nS.NO, PARTY NAME, MATERIAL NAME, VEHICLE NO, QTY, RATE 18%\n\n2. Ensure all values are separated by commas.\n3. If a column is empty or has a hyphen (-) in the image, output an empty string for that field. \n4. Do not include any subtotal rows or main category headers (like "INCOMING" or "OUTGOING") as data rows. Only include the actual entry rows with the party names.\n5. Make sure numeric values like quantities and rates do not have commas in them (e.g., use 1000.00 instead of 1,000.00).\n6. Output ONLY the raw CSV text inside a code block, without any extra explanations or greetings.`);
                    showToast('Prompt copied to clipboard!');
                  }}
                  className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy Prompt
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setIsPromptModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification - Updated White Theme Colors */}
      {toast && (
        <div className={`fixed right-4 bottom-4 z-50 rounded-md px-2 py-1.5 shadow-lg border max-w-[90%] sm:max-w-md ${toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-600'}`}>
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}
    </div>
  )
}

export default ItemTransfer