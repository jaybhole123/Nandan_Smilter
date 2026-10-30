import React, { useEffect, useMemo, useState } from 'react'
import { useStockStore } from '../store/useStore'
import { FileUploader } from '../components/FileUploader'
import { CsvDropzone } from '../components/CsvDropzone'
import OCRImageUploader from '../components/OCRImageUploader'
import { clean } from '../utils/aiOcr'
import { localDb } from '../services/localDb'
import DateFilter from '../components/DateFilter'

const initialForm = {
  category: '',
  material: '',
  openingStock: '',
  inward: '',
  consumption: '',
  crushing: '',
  fines3: '',
  fines3Qty: '',
  production: '',
  dispatch: '',
  closingStock: '',
  unit: 'ton',
  remarks: '',
}

const categoryOptions = [
  { value: '', label: 'RAW IRON ORE' },
  { value: 'rawPelletOre', label: 'RAW PELLET ORE' },
  { value: 'processedIronOre', label: 'PROCESSED IRON ORE (3-18)' },
  { value: 'ironFines', label: 'IRON FINES (0-3)' },
]

const unitOptions = ['kg', 'ton', 'mt', 'pcs', 'bag', 'packet']

const validateForm = ({ material, openingStock, unit }) => {
  if (!material.trim()) return 'Material name is required.'
  if (!openingStock || Number(openingStock) < 0) return 'Opening stock must be 0 or greater.'
  if (!unit) return 'Unit is required.'
  return ''
}

const formatNumber = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.000'
  return Number(value).toFixed(3)
}

const parsePercentValue = (value) => {
  if (value === undefined || value === null) return 0
  const stringValue = String(value).replace('%', '').trim()
  return stringValue === '' ? 0 : Number(stringValue) || 0
}

const formatPercentValue = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0%'
  return `${Number(value).toFixed(3)}%`
}

const getCategoryLabel = (category) => {
  const found = categoryOptions.find(opt => opt.value === category)
  return found ? found.label : category
}

// Maps a sheet group heading to the category value this page stores ('' = RAW IRON ORE)
const categoryFromHeading = (heading, fallback) => {
  const h = clean(heading)
  if (!h) return fallback
  if (/pellet/i.test(h)) return 'rawPelletOre'
  if (/processed/i.test(h)) return 'processedIronOre'
  if (/fines/i.test(h)) return 'ironFines'
  if (/irons*ore/i.test(h)) return ''
  return h
}

const Stock = () => {
  const storeItems = useStockStore((state) => state.items)
  const storeAddItem = useStockStore((state) => state.addItem)
  const storeUpdateItem = useStockStore((state) => state.updateItem)
  const storeDeleteItem = useStockStore((state) => state.deleteItem)

  const [dbItems, setDbItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDbItems = () => {
    setIsLoading(true);
    const fetchErrors = []
    try {
      const rawRows = localDb.select('raw_material_stock')
      const coalRows = localDb.select('coal_stock')

      const sortItems = (arr) => arr.sort((a, b) => {
        const cat = (b.created_at || '').localeCompare(a.created_at || '')
        if (cat !== 0) return cat
        return (a.material || '').localeCompare(b.material || '')
      })

      const mappedRaw = sortItems(rawRows).map(item => ({
        id: item.id,
        type: 'raw_material',
        category: item.category,
        material: item.material,
        openingStock: Number(item.opening_stock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        crushing: item.crushing || '0%',
        fines3: Number(item.fines3) || 0,
        fines3Qty: Number(item.fines3_qty) || 0,
        production: Number(item.production) || 0,
        dispatch: Number(item.dispatch) || 0,
        closingStock: Number(item.closing_stock) || 0,
        unit: item.unit || 'ton',
        remarks: item.remarks || '',
        reportDate: item.report_date,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      const mappedCoal = sortItems(coalRows).map(item => ({
        id: item.id,
        type: 'coal_detail',
        category: item.category,
        material: item.material,
        openingStock: Number(item.opening_stock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        fc: item.fc || '',
        moistLossPct: item.moist_loss_pct || '',
        moistLossQty: Number(item.moist_loss_qty) || 0,
        landedCost: Number(item.landed_cost) || 0,
        dispatch: Number(item.dispatch) || 0,
        closingStock: Number(item.closing_stock) || 0,
        remarks: item.remarks || '',
        reportDate: item.report_date,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      setDbItems([...mappedRaw, ...mappedCoal]);
      return []
    } catch (err) {
      console.error('[Stock] Failed to fetch rows:', err)
      return [err.message]
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDbItems();
  }, []);

  const items = useMemo(() => {
    return dbItems;
  }, [dbItems]);

  const addItem = async (item) => {
    if (item.type === 'coal_detail') {
      const payload = {
        category: item.category || 'COAL DETAILS',
        material: item.material,
        opening_stock: Number(item.openingStock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        fc: item.fc || '',
        moist_loss_pct: item.moistLossPct || '',
        moist_loss_qty: Number(item.moistLossQty) || 0,
        landed_cost: Number(item.landedCost) || 0,
        dispatch: Number(item.dispatch) || 0,
        closing_stock: Number(item.closingStock) || 0,
        remarks: item.remarks || '',
        report_date: item.reportDate || new Date().toISOString().split('T')[0]
      };
      localDb.insert('coal_stock', payload);
      fetchDbItems();
    } else {
      const payload = {
        category: item.category || '',
        material: item.material,
        opening_stock: Number(item.openingStock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        crushing: item.crushing || '0%',
        fines3: parsePercentValue(item.fines3) || 0,
        fines3_qty: Number(item.fines3Qty) || 0,
        production: Number(item.production) || 0,
        dispatch: Number(item.dispatch) || 0,
        closing_stock: Number(item.closingStock) || 0,
        unit: item.unit || 'ton',
        remarks: item.remarks || '',
        report_date: item.reportDate || new Date().toISOString().split('T')[0]
      };
      localDb.insert('raw_material_stock', payload);
      fetchDbItems();
    }
  }

  const updateItem = (id, item) => {
    const isCoal = dbItems.some(i => i.id === id && i.type === 'coal_detail') || item.type === 'coal_detail';
    if (isCoal) {
      const payload = {
        category: item.category || 'COAL DETAILS',
        material: item.material,
        opening_stock: Number(item.openingStock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        fc: item.fc || '',
        moist_loss_pct: item.moistLossPct || '',
        moist_loss_qty: Number(item.moistLossQty) || 0,
        landed_cost: Number(item.landedCost) || 0,
        dispatch: Number(item.dispatch) || 0,
        closing_stock: Number(item.closingStock) || 0,
        remarks: item.remarks || '',
        report_date: item.reportDate || new Date().toISOString().split('T')[0]
      };
      localDb.update('coal_stock', id, payload);
      fetchDbItems();
    } else {
      const payload = {
        category: item.category || '',
        material: item.material,
        opening_stock: Number(item.openingStock) || 0,
        inward: Number(item.inward) || 0,
        consumption: Number(item.consumption) || 0,
        crushing: item.crushing || '0%',
        fines3: parsePercentValue(item.fines3) || 0,
        fines3_qty: Number(item.fines3Qty) || 0,
        production: Number(item.production) || 0,
        dispatch: Number(item.dispatch) || 0,
        closing_stock: Number(item.closingStock) || 0,
        unit: item.unit || 'ton',
        remarks: item.remarks || '',
        report_date: item.reportDate || new Date().toISOString().split('T')[0]
      };
      localDb.update('raw_material_stock', id, payload);
      fetchDbItems();
    }
  }

  const deleteItem = (id) => {
    const isCoal = dbItems.some(i => i.id === id && i.type === 'coal_detail');
    if (isCoal) {
      localDb.delete('coal_stock', id);
      fetchDbItems();
    } else {
      localDb.delete('raw_material_stock', id);
      fetchDbItems();
    }
  }

  const [form, setForm] = useState(initialForm)
  const [rows, setRows] = useState([initialForm])
  const [rowsCategory, setRowsCategory] = useState('')
  const [attachments, setAttachments] = useState([])
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('raw_material')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [coalRows, setCoalRows] = useState([{ material: '', openingStock: '', inward: '', consumption: '', fc: '', moistLossPct: '', dispatch: '', landedCost: '', closingStock: '' }])
  const [coalCategory, setCoalCategory] = useState('COAL DETAILS')

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Filter items based on search
  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    let filtered = items.filter((item) => {
      const isCoal = item.type === 'coal_detail'
      if (activeTab === 'coal_detail' && !isCoal) return false
      if (activeTab === 'raw_material' && isCoal) return false

      if (reportDate) {
        const createdDate = new Date(item.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        if (createdDate !== reportDate) return false
      }

      return item.material.toLowerCase().includes(normalized) ||
             item.category.toLowerCase().includes(normalized)
    })
    return filtered;
  }, [items, search, activeTab, reportDate])

  const resetForm = () => {
    setForm(initialForm)
    setAttachments([])
    setSelectedId(null)
    setError('')
    setCoalRows([{ material: '', openingStock: '', inward: '', consumption: '', fc: '', moistLossPct: '', dispatch: '', landedCost: '', closingStock: '' }])
  }

  const resetRows = () => {
    setRows([initialForm])
    setAttachments([])
    setError('')
  }

  const addRow = () => setRows((s) => ([...s, { ...initialForm, category: rowsCategory }]))

  const removeRow = (idx) => setRows((s) => s.filter((_, i) => i !== idx))

  const updateRow = (idx, key, value) => {
    setRows((s) => s.map((r, i) => {
      if (i !== idx) return r
      const newRow = { ...r, [key]: value }
      
      // Auto-calculation for Fines Qty and Closing Stock
      if (['openingStock', 'inward', 'consumption', 'fines3', 'fines3Qty', 'production', 'dispatch'].includes(key)) {
        let op = Number(newRow.openingStock) || 0
        let inw = Number(newRow.inward) || 0
        let cons = Number(newRow.consumption) || 0
        let finesPct = parsePercentValue(newRow.fines3) / 100
        let finesQ = Number(newRow.fines3Qty) || 0
        let prod = Number(newRow.production) || 0
        let dis = Number(newRow.dispatch) || 0

        if ((key === 'fines3' || key === 'consumption') && finesPct > 0 && finesPct < 1 && cons > 0) {
            finesQ = (cons / (1 - finesPct)) * finesPct
            newRow.fines3Qty = finesQ.toFixed(3)
        } else if (key === 'fines3Qty') {
            finesQ = Number(value) || 0
        }

        let closing = op + inw - cons - finesQ + prod - dis
        newRow.closingStock = closing.toFixed(3)
      }

      return newRow
    }))
  }

  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      
      const newRows = []
      let currentCategory = rowsCategory || ''

      let startIndex = 0
      if (lines.length > 0 && lines[0].toLowerCase().includes('material')) {
        startIndex = 1
      }

      for (let i = startIndex; i < lines.length; i++) {
        // Handle basic CSV splitting
        const columns = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        
        // If row is a TOTAL row, skip it
        if (columns[0] && columns[0].toLowerCase().includes('total')) {
           continue
        }

        // Subheading detection: If only the first column has text and others are empty/zero
        const hasDataInOtherCols = columns.slice(1).some(c => c && c !== '0' && c !== '0.00' && c !== '0.000')
        if (columns[0] && !hasDataInOtherCols && !columns[0].match(/^[0-9.-]+$/)) {
           currentCategory = columns[0]
           continue
        }
        
        if (columns.length >= 2 && columns[0]) {
          newRows.push({
            ...initialForm,
            category: currentCategory,
            material: columns[0] || '',
            openingStock: columns[1] || '0',
            inward: columns[2] || '0',
            consumption: columns[3] || '0',
            crushing: columns[4] || '0%',
            fines3: columns[5] || '0%',
            fines3Qty: columns[6] || '0',
            production: columns[7] || '0',
            dispatch: columns[8] || '0',
            closingStock: columns[9] || '0',
          })
        }
      }
      
      if (newRows.length > 0) {
        setRows(newRows)
        setToast({ type: 'success', message: `Imported ${newRows.length} rows from CSV.` })
      } else {
        setToast({ type: 'error', message: 'No valid data found in CSV.' })
      }
    }
    reader.readAsText(file)
    e.target.value = '' 
  }

  const handleCoalCsvUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n')
      
      const newRows = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        
        // Skip header and totals
        if (columns[0] && (columns[0].toUpperCase() === 'MATERIAL' || columns[0].toUpperCase().includes('TOTAL'))) {
          continue
        }
        
        if (columns[0]) {
          newRows.push({
            material: columns[0] || '',
            openingStock: columns[1] || '0',
            inward: columns[2] || '0',
            consumption: columns[3] || '0',
            fc: columns[4] || '-',
            moistLossPct: columns[5] || '0%',
            landedCost: columns[6] || '0',
            dispatch: columns[7] || '0',
            closingStock: columns[8] || '0',
          })
        }
      }
      
      if (newRows.length > 0) {
        setCoalRows(newRows)
        setToast({ type: 'success', message: `Imported ${newRows.length} coal rows from CSV.` })
      } else {
        setToast({ type: 'error', message: 'No valid data found in CSV.' })
      }
    }
    reader.readAsText(file)
    e.target.value = '' 
  }

  // --- OCR Upload Handlers ---
  // The sheet's date ("AS ON DATE" when printed) becomes the report date the rows are saved under
  const applyAiReportDate = (data) => {
    if (/^d{4}-d{2}-d{2}$/.test(clean(data.reportDate))) setReportDate(clean(data.reportDate))
  }

  const handleRawMaterialAi = (data) => {
    const newRows = (data.rows || [])
      .filter((row) => clean(row.material))
      .map((row) => ({
        ...initialForm,
        category: categoryFromHeading(row.category, rowsCategory || ''),
        material: clean(row.material),
        openingStock: clean(row.openingStock) || '0',
        inward: clean(row.inward) || '0',
        consumption: clean(row.consumption) || '0',
        crushing: clean(row.crushing) || '0%',
        fines3: clean(row.fines3) || '0%',
        fines3Qty: clean(row.fines3Qty) || '0',
        production: clean(row.production) || '0',
        dispatch: clean(row.dispatch) || '0',
        closingStock: clean(row.closingStock) || '0',
      }))

    if (newRows.length === 0) {
      setToast({ type: 'error', message: 'No raw material rows could be read from the image.' })
      return
    }

    applyAiReportDate(data)
    setRows(newRows)
    setActiveTab('raw_material')
    setIsModalOpen(true)
    setToast({ type: 'success', message: `Read ${newRows.length} raw material rows from the image. Review and save them.` })
  }

  const handleCoalAi = (data) => {
    const newRows = (data.rows || [])
      .filter((row) => clean(row.material))
      .map((row) => ({
        category: coalCategory || 'COAL DETAILS',
        material: clean(row.material),
        openingStock: clean(row.openingStock) || '0',
        inward: clean(row.inward) || '0',
        consumption: clean(row.consumption) || '0',
        fc: clean(row.fc) || '-',
        moistLossPct: clean(row.moistLossPct) || '0%',
        landedCost: clean(row.landedCost) || '0',
        dispatch: clean(row.dispatch) || '0',
        closingStock: clean(row.closingStock) || '0',
        remarks: '',
      }))

    if (newRows.length === 0) {
      setToast({ type: 'error', message: 'No coal rows could be read from the image.' })
      return
    }

    applyAiReportDate(data)
    setSelectedId(null)
    setCoalRows(newRows)
    setActiveTab('coal_detail')
    setIsModalOpen(true)
    setToast({ type: 'success', message: `Read ${newRows.length} coal rows from the image. Review and save them.` })
  }

  const addCoalRow = () => setCoalRows((s) => ([...s, { material: '', openingStock: '', inward: '', consumption: '', fc: '', moistLossPct: '', dispatch: '', landedCost: '', closingStock: '' }]))
  const removeCoalRow = (idx) => setCoalRows((s) => s.filter((_, i) => i !== idx))
  
  const updateCoalRow = (idx, key, value) => {
    setCoalRows((s) => s.map((r, i) => {
      if (i !== idx) return r
      const newRow = { ...r, [key]: value }
      if (['openingStock', 'inward', 'consumption'].includes(key)) {
        let op = Number(newRow.openingStock) || 0
        let inw = Number(newRow.inward) || 0
        let cons = Number(newRow.consumption) || 0
        let closing = op + inw - cons
        newRow.closingStock = closing.toFixed(3)
      }
      return newRow
    }))
  }

  const handleSaveCoalRows = async (e) => {
    e.preventDefault()
    const validRows = coalRows.filter(r => r.material && r.material.trim() !== '')
    
    if (validRows.length === 0) {
      setError('Please enter at least one material.')
      return
    }

    const payloads = validRows.map((r) => ({
      category: coalCategory || 'COAL DETAILS',
      material: r.material,
      opening_stock: Number(r.openingStock) || 0,
      inward: Number(r.inward) || 0,
      consumption: Number(r.consumption) || 0,
      fc: r.fc || '',
      moist_loss_pct: r.moistLossPct || '',
      moist_loss_qty: Number(r.moistLossQty) || 0,
      landed_cost: Number(r.landedCost) || 0,
      dispatch: Number(r.dispatch) || 0,
      closing_stock: Number(r.closingStock) || 0,
      remarks: r.remarks || '',
      report_date: reportDate || new Date().toISOString().split('T')[0]
    }));

    setIsSaving(true);
    let savedSuccessfully = false
    if (selectedId && payloads.length === 1) {
      localDb.update('coal_stock', selectedId, payloads[0]);
      setToast({ type: 'success', message: 'Coal entry updated successfully.' });
    } else {
      localDb.insert('coal_stock', payloads);
      setToast({ type: 'success', message: `${validRows.length} coal row(s) added.` });
    }
    fetchDbItems();
    setIsSaving(false);
    setCoalRows([{ material: '', openingStock: '', inward: '', consumption: '', fc: '', moistLossPct: '', dispatch: '', landedCost: '', closingStock: '' }]);
    setIsModalOpen(false);
  }

  const handleSaveRows = (e) => {
    e.preventDefault()
    
    // Filter out rows that have no material name (empty rows)
    const validRows = rows.filter(r => r.material && r.material.trim() !== '')
    
    if (validRows.length === 0) {
      setError('Please enter at least one material.')
      return
    }

    for (let i = 0; i < validRows.length; i++) {
      const validationError = validateForm(validRows[i])
      if (validationError) {
        setError(`Row ${i + 1}: ${validationError}`)
        return
      }
    }

    const payloads = validRows.map((r) => ({
      category: r.category || rowsCategory || '',
      material: r.material.trim(),
      opening_stock: Number(r.openingStock) || 0,
      inward: Number(r.inward) || 0,
      consumption: Number(r.consumption) || 0,
      crushing: r.crushing || '0%',
      fines3: parsePercentValue(r.fines3) || 0,
      fines3_qty: Number(r.fines3Qty) || 0,
      production: Number(r.production) || 0,
      dispatch: Number(r.dispatch) || 0,
      closing_stock: Number(r.closingStock) || 0,
      unit: r.unit,
      remarks: r.remarks ? r.remarks.trim() : '',
      report_date: reportDate || new Date().toISOString().split('T')[0]
    }));

    setIsSaving(true);
    localDb.insert('raw_material_stock', payloads);
    fetchDbItems();
    setToast({ type: 'success', message: `${validRows.length} stock row(s) added.` });
    setIsSaving(false);
    resetRows();
    setIsModalOpen(false);
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    const preparedItem = {
      category: form.category,
      material: form.material.trim(),
      openingStock: Number(form.openingStock) || 0,
      inward: Number(form.inward) || 0,
      consumption: Number(form.consumption) || 0,
      crushing: form.crushing || '0%',
      fines3: parsePercentValue(form.fines3),
      fines3Qty: Number(form.fines3Qty) || 0,
      production: Number(form.production) || 0,
      dispatch: Number(form.dispatch) || 0,
      closingStock: Number(form.closingStock) || 0,
      unit: form.unit,
      remarks: form.remarks.trim(),
      attachments,
      reportDate,
      updatedAt: new Date().toISOString(),
    }

    if (selectedId) {
      updateItem(selectedId, preparedItem)
      setToast({ type: 'success', message: 'Stock entry updated successfully.' })
    } else {
      addItem(preparedItem)
      setToast({ type: 'success', message: 'Stock entry added successfully.' })
    }

    resetForm()
    setIsModalOpen(false)
  }

  const handleEdit = (item) => {
    setForm(item)
    setSelectedId(item.id)
    if (item.type === 'coal_detail') {
      setCoalCategory(item.category || 'COAL DETAILS')
      setCoalRows([{
        material: item.material,
        openingStock: item.openingStock || '',
        inward: item.inward || '',
        consumption: item.consumption || '',
        fc: item.fc || '',
        moistLossPct: item.moistLossPct || '',
        landedCost: item.landedCost || '',
        dispatch: item.dispatch || '',
        closingStock: item.closingStock || '',
        remarks: item.remarks || ''
      }])
    }
    setIsModalOpen(true)
    setError('')
  }

  const handleSaveInline = () => {
    if (!editForm.material.trim()) return showToast('Material name is required', 'error')
    
    // Auto calculate closing
    let op = Number(editForm.openingStock) || 0
    let inw = Number(editForm.inward) || 0
    let cons = Number(editForm.consumption) || 0
    let finesPct = parsePercentValue(editForm.fines3) / 100
    let finesQ = Number(editForm.fines3Qty) || 0
    let prod = Number(editForm.production) || 0
    let dis = Number(editForm.dispatch) || 0
    if (finesPct > 0 && finesPct < 1 && cons > 0 && !editForm.fines3Qty) {
        finesQ = (cons / (1 - finesPct)) * finesPct
        editForm.fines3Qty = finesQ.toFixed(3)
    }
    let closing = op + inw - cons - finesQ + prod - dis
    editForm.closingStock = closing.toFixed(3)

    updateItem(editingId, editForm)
    setToast({ type: 'success', message: 'Stock entry updated inline.' })
    setEditingId(null)
  }
  const handleCancelInline = () => setEditingId(null)

  const handleDelete = (id) => {
    if (window.confirm('Delete this stock entry?')) {
      deleteItem(id)
      setToast({ type: 'success', message: 'Stock entry removed.' })
    }
  }

  // --- Helper to Group and Calculate Totals ---
  const groupedAndTotals = useMemo(() => {
    const groups = {}
    filteredItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = {
          label: getCategoryLabel(item.category),
          rows: [],
          totals: { opening: 0, inward: 0, consumption: 0, fines3: 0, fines3Qty: 0, production: 0, dispatch: 0, closing: 0, moistLossQty: 0, landedCost: 0 }
        }
      }
      groups[item.category].rows.push(item)
      
      // Aggregate totals for the Category
      groups[item.category].totals.opening += Number(item.openingStock) || 0
      groups[item.category].totals.inward += Number(item.inward) || 0
      groups[item.category].totals.consumption += Number(item.consumption) || 0
      groups[item.category].totals.fines3 += Number(item.fines3) || 0
      groups[item.category].totals.fines3Qty += Number(item.fines3Qty) || 0
      groups[item.category].totals.production += Number(item.production) || 0
      groups[item.category].totals.dispatch += Number(item.dispatch) || 0
      groups[item.category].totals.closing += Number(item.closingStock) || 0
      
      groups[item.category].totals.moistLossQty += Number(item.moistLossQty) || 0
      groups[item.category].totals.landedCost += Number(item.landedCost) || 0
    })
    return groups
  }, [filteredItems])

  return (
    <div className="space-y-6 pb-10 px-2 sm:px-4 w-full max-w-[1200px] mx-auto text-slate-800">
      
      {/* Top Banner (Modern Gradient) */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded p-4 sm:p-5 mb-6 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center justify-between text-white">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-28 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-28 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
          <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1 flex items-center gap-1">Module</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Management</h2>
          </div>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 border-b border-slate-400 pt-2 pb-3 justify-between items-center">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('raw_material')}
            className={`pb-3 px-1 text-[15px] font-semibold border-b-2 transition-colors ${activeTab === 'raw_material' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-400'}`}
          >
            Raw Material Stock (NSPL)
          </button>
          <button 
            onClick={() => setActiveTab('coal_detail')}
            className={`pb-3 px-1 text-[15px] font-semibold border-b-2 transition-colors ${activeTab === 'coal_detail' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-400'}`}
          >
            Coal Detail
          </button>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter date={reportDate} onChange={setReportDate} />

          {/* Front Image Upload / OCR Button */}
          <OCRImageUploader 
            aiPage={activeTab === 'raw_material' ? 'stock_raw' : 'stock_coal'}
            onAiResult={activeTab === 'raw_material' ? handleRawMaterialAi : handleCoalAi}
            buttonLabel={activeTab === 'raw_material' ? 'Scan Raw Material' : 'Scan Coal Detail'}
            className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 h-10 active:Sale-95"
          />

          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow shadow-indigo-500/30 transition-all flex items-center gap-2 h-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Stock Entry
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all relative z-10 border border-slate-100 flex flex-col">
            <div className={`px-8 py-5 border-b flex justify-between items-center text-white sticky top-0 z-20 ${activeTab === 'raw_material' ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-gradient-to-r from-emerald-600 to-teal-500'}`}>
              <h3 className="font-bold text-xl flex items-center gap-2.5 tracking-wide">
                {selectedId ? `Edit Stock Entry: ${form.material || 'Item'}` : (activeTab === 'raw_material' ? 'Add Raw Material Stock' : 'Add Coal Detail')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-4 sm:p-6 bg-slate-50/30">
              {activeTab === 'raw_material' ? (
                <>
              <div className="w-full flex flex-col gap-2">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-200 pb-4">
          <div>
             <h4 className="text-sm font-semibold text-slate-700">Stock Details</h4>
             <p className="text-xs text-slate-500">Update the inventory values below</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 transition-all">
              <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Report Date:</label>
              <input 
                type="date" 
                value={reportDate} 
                onChange={(e) => setReportDate(e.target.value)} 
                className="bg-transparent text-slate-800 text-sm font-semibold focus:outline-none cursor-pointer" 
              />
            </div>
            {selectedId && (
              <button
                onClick={resetForm}
                className="px-5 py-2.5 text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all shadow-sm flex items-center gap-2"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {selectedId ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="category">Category (Main Heading)</label>
                <input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="Enter category"
                />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="material">Material Name</label>
                <input
                  id="material"
                  value={form.material}
                  onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="Ex. Iron Ore (10-40)"
                />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="unit">Unit</label>
                <select
                  id="unit"
                  value={form.unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="openingStock">Opening</label>
                <input
                  id="openingStock"
                  type="text"
                  inputMode="decimal"
                  value={form.openingStock}
                  onChange={(e) => setForm((prev) => ({ ...prev, openingStock: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="inward">Inward</label>
                <input
                  id="inward"
                  type="text"
                  inputMode="decimal"
                  value={form.inward}
                  onChange={(e) => setForm((prev) => ({ ...prev, inward: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="consumption">Cons.</label>
                <input
                  id="consumption"
                  type="text"
                  inputMode="decimal"
                  value={form.consumption}
                  onChange={(e) => setForm((prev) => ({ ...prev, consumption: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="crushing">Crushing (+3)</label>
                <input
                  id="crushing"
                  value={form.crushing}
                  onChange={(e) => setForm((prev) => ({ ...prev, crushing: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0%"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="fines3">Fines(-3%)</label>
                <input
                  id="fines3"
                  type="text"
                  inputMode="decimal"
                  value={form.fines3}
                  onChange={(e) => setForm((prev) => ({ ...prev, fines3: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0%"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="fines3Qty">Fines(-3)Qty</label>
                <input
                  id="fines3Qty"
                  type="text"
                  inputMode="decimal"
                  value={form.fines3Qty}
                  onChange={(e) => setForm((prev) => ({ ...prev, fines3Qty: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="production">Prod.</label>
                <input
                  id="production"
                  type="text"
                  inputMode="decimal"
                  value={form.production}
                  onChange={(e) => setForm((prev) => ({ ...prev, production: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="dispatch">Dis.</label>
                <input
                  id="dispatch"
                  type="text"
                  inputMode="decimal"
                  value={form.dispatch}
                  onChange={(e) => setForm((prev) => ({ ...prev, dispatch: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
              <div className="group col-span-2 sm:col-span-4 lg:col-span-2">
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1.5 transition-colors" htmlFor="closingStock">Closing Stock</label>
                <input
                  id="closingStock"
                  type="text"
                  inputMode="decimal"
                  value={form.closingStock}
                  onChange={(e) => setForm((prev) => ({ ...prev, closingStock: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-bold text-right focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="w-full">
              <div className="group">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 transition-colors group-focus-within:text-indigo-600" htmlFor="remarks">Remarks</label>
                <textarea
                  id="remarks"
                  rows="3"
                  value={form.remarks}
                  onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  className="w-full h-[100px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm resize-none"
                  placeholder="Optional notes or context..."
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all duration-300 shadow-sm active:Sale-95">
                  Reset
                </button>
                <button type="submit" className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:Sale-95 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {selectedId ? 'Update Stock Entry' : 'Add Stock Entry'}
                </button>
            </div>
          </div>
        </form>
        ) : (
        <form onSubmit={handleSaveRows} className="space-y-6">
          {/* Multi-row layout for adding many rows */}
          <div className="group mb-2 border-b border-indigo-100 pb-4 w-full mx-auto flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-indigo-900/60 group-focus-within:text-indigo-600">Category (Main Heading)</label>
              <input type="text" value={rowsCategory} onChange={(e) => setRowsCategory(e.target.value)} className="w-full px-4 py-3 bg-indigo-50/50 border border-indigo-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-indigo-400 focus:ring-indigo-500/10 font-bold" placeholder="e.g. RAW IRON ORE" />
            </div>
            <button type="button" onClick={() => setRows((s) => s.map(r => ({ ...r, category: rowsCategory })))} className="px-6 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold rounded-xl transition-all duration-300 shadow-sm active:Sale-95 border border-indigo-200 whitespace-nowrap">Apply to all rows</button>
          </div>
          
          <div className="overflow-hidden pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="w-full mx-auto flex flex-col gap-1.5 mt-4">
              
              {/* Rows */}
              <div className="space-y-4 w-full">
                {rows.map((r, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group/card">
                    {rows.length > 1 && (
                      <div className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <button type="button" onClick={() => removeRow(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove Row">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                    
                    <h4 className="text-xs font-bold text-indigo-400 mb-4 uppercase tracking-wider">Row Item #{idx + 1}</h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 items-end">
                      
                      <div className="group md:col-span-2 lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Material Name</label>
                        <input value={r.material} onChange={(e) => updateRow(idx, 'material', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-indigo-400 focus:ring-indigo-500/10" placeholder="e.g. IRON ORE" />
                      </div>
                      
                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Opening</label>
                        <input value={r.openingStock} onChange={(e) => updateRow(idx, 'openingStock', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>
                      
                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Inward</label>
                        <input value={r.inward} onChange={(e) => updateRow(idx, 'inward', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Cons</label>
                        <input value={r.consumption} onChange={(e) => updateRow(idx, 'consumption', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Crushing</label>
                        <input value={r.crushing} onChange={(e) => updateRow(idx, 'crushing', e.target.value)} placeholder="0%" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Fines%</label>
                        <input value={r.fines3} onChange={(e) => updateRow(idx, 'fines3', e.target.value)} placeholder="0%" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">FinesQty</label>
                        <input value={r.fines3Qty} onChange={(e) => updateRow(idx, 'fines3Qty', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>
                      
                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Prod</label>
                        <input value={r.production} onChange={(e) => updateRow(idx, 'production', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Dis</label>
                        <input value={r.dispatch} onChange={(e) => updateRow(idx, 'dispatch', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>

                      <div className="group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-indigo-600">Closing</label>
                        <input value={r.closingStock} onChange={(e) => updateRow(idx, 'closingStock', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-bold text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/10 text-right" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-2 w-full mx-auto">
            <button type="button" onClick={addRow} className="px-5 py-2.5 bg-white border border-slate-400 shadow-sm hover:shadow hover:border-slate-400 text-slate-700 font-medium rounded-md transition-all duration-300 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Row
            </button>
            
            <CsvDropzone
              onUpload={handleCsvUpload}
              className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-sm text-emerald-700 font-medium rounded-md transition-all duration-300 flex items-center gap-1 active:Sale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Upload CSV
            </CsvDropzone>

            <OCRImageUploader 
              aiPage="stock_raw"
              onAiResult={handleRawMaterialAi} 
              className="px-5 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 shadow-sm font-medium rounded-md flex items-center gap-1 active:Sale-95" 
            />
            
            <button
              type="button"
              onClick={() => setIsPromptModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-medium rounded-md shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap active:Sale-95"
              title="Get AI Prompt for CSV"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="hidden sm:inline">AI Prompt</span>
            </button>

            <button type="submit" className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg font-medium rounded-md transition-all duration-300 transform hover:-translate-y-0.5 ml-auto">Save All</button>
            <button type="button" onClick={resetRows} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-md transition-all duration-300">Reset</button>
          </div>
        </form>
        )}

          {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
      </div>
      </>
      ) : (
        <div className="w-full flex flex-col gap-2">
          
          <form onSubmit={handleSaveCoalRows} className="space-y-4">
            <div className="group mb-2 border-b border-emerald-100 pb-4 w-full mx-auto flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block transition-colors text-emerald-900/60 group-focus-within:text-emerald-600">Category (Main Heading)</label>
                <input type="text" value={coalCategory} onChange={(e) => setCoalCategory(e.target.value)} className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-emerald-400 focus:ring-emerald-500/10 font-bold" placeholder="e.g. COAL DETAILS" />
              </div>
              <button type="button" onClick={() => setCoalRows((s) => s.map(r => ({ ...r, category: coalCategory })))} className="px-6 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl transition-all duration-300 shadow-sm active:Sale-95 border border-emerald-200 whitespace-nowrap">Apply to all rows</button>
            </div>

            <div className="overflow-hidden pb-4 -mx-4 sm:mx-0 px-4 sm:px-0 mt-4">
              <div className="w-full mx-auto flex flex-col gap-1.5">
                <div className="space-y-4 w-full">
                  {coalRows.map((r, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group/card">
                      {coalRows.length > 1 && (
                        <div className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <button type="button" onClick={() => removeCoalRow(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove Row">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      )}
                      
                      <h4 className="text-xs font-bold text-emerald-500 mb-4 uppercase tracking-wider">Coal Item #{idx + 1}</h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 items-end">
                        
                        <div className="group md:col-span-2 lg:col-span-2">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Material Name</label>
                          <input value={r.material} onChange={(e) => updateCoalRow(idx, 'material', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm uppercase focus:border-emerald-400 focus:ring-emerald-500/10" placeholder="e.g. COAL" />
                        </div>
                        
                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Opening</label>
                          <input value={r.openingStock} onChange={(e) => updateCoalRow(idx, 'openingStock', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>
                        
                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Inward</label>
                          <input value={r.inward} onChange={(e) => updateCoalRow(idx, 'inward', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>

                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Cons</label>
                          <input value={r.consumption} onChange={(e) => updateCoalRow(idx, 'consumption', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>

                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">F/C</label>
                          <input value={r.fc} onChange={(e) => updateCoalRow(idx, 'fc', e.target.value)} placeholder="-" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>

                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Moist%</label>
                          <input value={r.moistLossPct} onChange={(e) => updateCoalRow(idx, 'moistLossPct', e.target.value)} placeholder="0%" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>
                        
                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">LandedCost</label>
                          <input value={r.landedCost} onChange={(e) => updateCoalRow(idx, 'landedCost', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>

                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Discount</label>
                          <input value={r.dispatch} onChange={(e) => updateCoalRow(idx, 'dispatch', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>

                        <div className="group">
                          <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Closing</label>
                          <input value={r.closingStock} onChange={(e) => updateCoalRow(idx, 'closingStock', e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10 text-right" />
                        </div>
                      </div>
                      <div className="mt-4 group">
                        <label className="text-[10px] uppercase tracking-wider font-bold mb-1.5 block transition-colors text-slate-500 group-focus-within:text-emerald-600">Remarks</label>
                        <input value={r.remarks || ''} onChange={(e) => updateCoalRow(idx, 'remarks', e.target.value)} placeholder="Optional notes..." className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-4 transition-all duration-200 shadow-sm focus:border-emerald-400 focus:ring-emerald-500/10" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 pt-2 w-full mx-auto">
              {!selectedId && (
                <>
                  <button type="button" onClick={addCoalRow} className="px-5 py-2.5 bg-white border border-slate-400 shadow-sm hover:shadow hover:border-slate-400 text-slate-700 font-medium rounded-md transition-all duration-300 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Row
                  </button>
                  
                  <CsvDropzone
                    onUpload={handleCoalCsvUpload}
                    className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-sm text-emerald-700 font-medium rounded-md transition-all duration-300 flex items-center gap-1 active:Sale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Upload CSV
                  </CsvDropzone>

                  <OCRImageUploader 
                    aiPage="stock_coal"
                    onAiResult={handleCoalAi} 
                    className="px-5 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 shadow-sm font-medium rounded-md flex items-center gap-1 active:Sale-95" 
                  />
                </>
              )}
              
              <button
                type="button"
                onClick={() => setIsPromptModalOpen(true)}
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium rounded-md shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap active:Sale-95"
                title="Get AI Prompt for CSV"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="hidden sm:inline">AI Prompt</span>
              </button>

              <button type="submit" disabled={isSaving} className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md hover:shadow-lg font-medium rounded-md transition-all duration-300 transform hover:-translate-y-0.5 ml-auto disabled:opacity-60 disabled:cursor-wait">
                {isSaving ? 'Saving...' : selectedId ? 'Update Stock Entry' : `Save ${coalRows.length > 1 ? `${coalRows.length} Coal Rows` : 'Coal Detail'}`}
              </button>
              <button type="button" onClick={() => setCoalRows([{ material: '', openingStock: '', inward: '', consumption: '', fc: '', moistLossPct: '', dispatch: '', landedCost: '', closingStock: '' }])} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-md transition-all duration-300">Reset</button>
            </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

      {/* Table Section - Exact Grid Layout with Category Headers */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-indigo-500 font-bold uppercase tracking-[0.24em] mb-1">Inventory List</p>
            <h2 className="text-2xl font-bold text-slate-800">Stock Items</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">

            </div>
            
            <div className="relative w-full sm:w-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory..."
                className="pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm w-full sm:w-72 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-xs text-left border-collapse relative">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-4 py-3 break-words">Material</th>
                <th className="px-4 py-3 text-right break-words">Opening Stock</th>
                <th className="px-4 py-3 text-right break-words">Inward</th>
                <th className="px-4 py-3 text-right break-words">Cons.</th>
                {activeTab === 'raw_material' ? (
                  <>
                    <th className="px-4 py-3 text-right break-words">Crushing (+3)</th>
                    <th className="px-4 py-3 text-right break-words">Fines %</th>
                    <th className="px-4 py-3 text-right break-words">Fines Qty.</th>
                    <th className="px-4 py-3 text-right break-words">Prod.</th>
                    <th className="px-4 py-3 text-right break-words">Dis.</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right break-words">F/C</th>
                    <th className="px-4 py-3 text-right break-words">Moist.%</th>
                    <th className="px-4 py-3 text-right break-words">Landed Cost</th>
                    <th className="px-4 py-3 text-right break-words">Discount</th>
                  </>
                )}
                <th className="px-4 py-3 text-right break-words text-indigo-500">Closing Stock</th>
                <th className="px-4 py-3 text-left break-words">Remarks</th>
                <th className="px-4 py-3 text-center break-words">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {Object.keys(groupedAndTotals).length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'raw_material' ? "12" : "11"} className="text-center py-16 bg-slate-50/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    <p className="text-slate-500 font-medium text-sm">No stock items found.</p>
                    <p className="text-slate-400 text-xs mt-1">Use the form above to add new inventory data.</p>
                  </td>
                </tr>
              ) : (
                Object.keys(groupedAndTotals).map((categoryKey) => {
                  const group = groupedAndTotals[categoryKey]
                  return (
                    <React.Fragment key={categoryKey}>
                      {/* 1. CATEGORY MAIN HEADER */}
                      <tr className="bg-indigo-50/50 border-y border-indigo-100">
                        <td colSpan={activeTab === 'raw_material' ? "12" : "11"} className="px-6 py-4 font-bold text-slate-800 text-xs uppercase tracking-widest text-indigo-700">
                          {group.label}
                        </td>
                      </tr>

                      {/* 2. DATA ROWS */}
                      {group.rows.map((item) => (
                        
                        <tr key={item.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                          {editingId === item.id ? (
                            <>
                              <td className="px-4 py-3 text-slate-800 font-medium break-words">
                                <input value={editForm.material} onChange={e => setEditForm({...editForm, material: e.target.value})} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                              </td>
                              <td className="px-4 py-3"><input type="number" value={editForm.openingStock} onChange={e => setEditForm({...editForm, openingStock: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                              <td className="px-4 py-3"><input type="number" value={editForm.inward} onChange={e => setEditForm({...editForm, inward: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                              <td className="px-4 py-3"><input type="number" value={editForm.consumption} onChange={e => setEditForm({...editForm, consumption: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                              {activeTab === 'raw_material' ? (
                                <>
                                  <td className="px-4 py-3"><input type="text" value={editForm.crushing} onChange={e => setEditForm({...editForm, crushing: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="text" value={editForm.fines3} onChange={e => setEditForm({...editForm, fines3: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="number" value={editForm.fines3Qty} onChange={e => setEditForm({...editForm, fines3Qty: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="number" value={editForm.production} onChange={e => setEditForm({...editForm, production: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="number" value={editForm.dispatch} onChange={e => setEditForm({...editForm, dispatch: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3"><input type="text" value={editForm.fc} onChange={e => setEditForm({...editForm, fc: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="text" value={editForm.moistLossPct} onChange={e => setEditForm({...editForm, moistLossPct: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="number" value={editForm.landedCost} onChange={e => setEditForm({...editForm, landedCost: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                  <td className="px-4 py-3"><input type="number" value={editForm.dispatch} onChange={e => setEditForm({...editForm, dispatch: e.target.value})} className="w-full text-right border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></td>
                                </>
                              )}
                              <td className="px-4 py-3 text-indigo-700 text-right font-bold bg-indigo-50/50 rounded-md">{formatNumber(((Number(editForm.openingStock)||0) + (Number(editForm.inward)||0) - (Number(editForm.consumption)||0) - (Number(editForm.fines3Qty)||0) + (Number(editForm.production)||0) - (Number(editForm.dispatch)||0)))}</td>
                              <td className="px-4 py-3"><input type="text" value={editForm.remarks || ''} onChange={e => setEditForm({...editForm, remarks: e.target.value})} className="w-full border border-indigo-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Notes..." /></td>
                              <td className="px-4 py-3 text-center align-middle bg-white">
                                <div className="flex flex-row justify-center items-center gap-1.5 transition-opacity">
                                  <button onClick={handleSaveInline} className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md shadow-sm transition-colors" title="Save">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                  <button onClick={handleCancelInline} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md shadow-sm transition-colors" title="Cancel">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-slate-800 font-semibold break-words">
                                {item.material}
                              </td>
                              <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.openingStock)}</td>
                              <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.inward)}</td>
                              <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.consumption)}</td>
                              {activeTab === 'raw_material' ? (
                                <>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{item.crushing || '0%'}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatPercentValue(item.fines3)}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.fines3Qty)}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.production)}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.dispatch)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium whitespace-nowrap">{item.fc || '-'}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{item.moistLossPct || '0%'}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.landedCost)}</td>
                                  <td className="px-4 py-3 text-slate-600 text-right font-medium">{formatNumber(item.dispatch)}</td>
                                </>
                              )}
                              <td className="px-4 py-3 text-indigo-700 bg-indigo-50/30 text-right font-bold">{formatNumber(item.closingStock)}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[150px]" title={item.remarks}>{item.remarks || '-'}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center gap-1 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-1.5 rounded transition-colors text-blue-500 hover:bg-blue-50" title="Edit">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors" title="Delete">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}

                      {/* 3. CATEGORY TOTALS ROW */}
                      <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.02)]">
                        <td className="px-4 py-4 break-words text-[11px] uppercase tracking-wider text-indigo-600">Total {group.label}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(group.totals.opening)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(group.totals.inward)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(group.totals.consumption)}</td>
                        {activeTab === 'raw_material' ? (
                          <>
                            <td className="px-4 py-4 text-right"></td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.fines3)}</td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.fines3Qty)}</td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.production)}</td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.dispatch)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-4 text-right"></td>
                            <td className="px-4 py-4 text-right"></td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.landedCost)}</td>
                            <td className="px-4 py-4 text-right">{formatNumber(group.totals.dispatch)}</td>
                          </>
                        )}
                        <td className="px-4 py-4 text-right text-indigo-700 bg-indigo-50/50">{formatNumber(group.totals.closing)}</td>
                        <td className="px-4 py-4 text-center"></td>
                        <td className="px-4 py-4 text-center"></td>
                      </tr>

                      {/* Verification Row */}
                      {(() => {
                        let expectedClosing = 0;
                        if (activeTab === 'raw_material') {
                          expectedClosing = group.totals.opening + group.totals.inward - group.totals.consumption - group.totals.fines3Qty + group.totals.production - group.totals.dispatch;
                        } else {
                          expectedClosing = group.totals.opening + group.totals.inward - group.totals.consumption - group.totals.moistLossQty - group.totals.dispatch;
                        }
                        const isCorrect = Math.abs(expectedClosing - group.totals.closing) < 0.001;
                        const colSpan1 = activeTab === 'raw_material' ? 9 : 8;
                        return (
                          <tr className={isCorrect ? "bg-emerald-50/40" : "bg-rose-50/40"}>
                            <td colSpan={colSpan1} className={`px-4 py-1.5 text-right text-[10px] font-semibold italic ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isCorrect ? 'Calculation Verified' : 'Calculation Mismatch'}
                            </td>
                            <td className={`px-4 py-1.5 text-right font-bold text-[10px] ${isCorrect ? 'text-emerald-700 bg-emerald-100/50' : 'text-rose-600 bg-rose-100/50'}`}>
                              {isCorrect ? 'Correct' : `Expected: ${formatNumber(expectedClosing)}`}
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-center"></td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsPromptModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A12.014 12.014 0 0010 1a12.014 12.014 0 00-1.3.046l-.515.088A12.046 12.046 0 005.15 2.502l-.371.242a12.049 12.049 0 00-2.479 3.016l-.216.386a11.967 11.967 0 00-.776 2.062 11.972 11.972 0 00-.097 2.115l.08.572c.162 1.15.584 2.253 1.233 3.218l.245.364a12.043 12.043 0 002.825 2.72l.432.274a12.052 12.052 0 003.585 1.34l.583.1c.42.072.846.108 1.272.108a12.01 12.01 0 001.271-.108l.584-.1a12.053 12.053 0 003.585-1.34l.431-.274a12.043 12.043 0 002.825-2.72l.245-.364c.649-.965 1.07-2.068 1.233-3.218l.08-.572a11.973 11.973 0 00-.097-2.115 11.968 11.968 0 00-.776-2.062l-.216-.386a12.05 12.05 0 00-2.479-3.016l-.371-.242a12.047 12.047 0 00-3.036-1.368l-.515-.088z" clipRule="evenodd" />
                </svg>
                AI Prompt for CSV Generation
              </h3>
              <button onClick={() => setIsPromptModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <p className="text-sm text-slate-600 mb-4">Copy the prompt below and paste it into ChatGPT, Claude, or any AI along with an image of your {activeTab === 'raw_material' ? 'Raw Material Stock' : 'Coal Details'} table. It will generate a CSV file in the exact format required for upload.</p>
              
              <div className="bg-slate-900 rounded-lg p-4 relative group">
                <button 
                  onClick={() => {
                    const promptText = activeTab === 'raw_material' 
                      ? `I have an image of a Raw Material Stock table. Please extract the data and provide it in a CSV format exactly matching the following columns:

MATERIAL, OPENING STOCK, INWARD, CONS., CRUSHING (+3), FINES(-3) %, FINES(-3) QTY., PROD., DIS., CLOSING STOCK

Rules:
1. ONLY output the raw CSV data inside a code block. No explanations, no markdown formatting other than the code block.
2. If there are Category Headers (like "RAW IRON ORE", "RAW PELLET ORE"), output them in the MATERIAL column, with all other columns empty for that row.
3. Ignore rows that say "TOTAL" or "AS ON DATE".
4. Ensure all percentages and decimals are preserved exactly as shown.
5. Maintain the EXACT top-to-bottom row sequence as shown in the image. DO NOT sort the rows alphabetically.`
                      : `I have an image of a Coal Details stock table. Please extract the data and provide it in a CSV format exactly matching the following 9 columns:

MATERIAL, OPENING STOCK, INWARD, CONS., F/C, MOIST. %, LANDED COST, DISCOUNT, CLOSING STOCK

Rules:
1. ONLY output the raw CSV data inside a code block. No explanations, no markdown formatting other than the code block.
2. If there are Category Headers (like "COAL DETAILS"), output them in the MATERIAL column, with all other columns empty for that row.
3. IMPORTANT: The second last column (before Closing Stock) is DISCOUNT, even if its heading is empty in the image!
4. The column before DISCOUNT is LANDED COST.
5. Ignore rows that say "TOTAL COAL".
6. Ensure all percentages and decimals are preserved exactly as shown.
7. Maintain the EXACT top-to-bottom row sequence as shown in the image. DO NOT sort the rows alphabetically.`;
                    
                    navigator.clipboard.writeText(promptText);
                    setToast({ type: 'success', message: 'Prompt copied to clipboard!' });
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 flex items-center gap-1.5 text-xs font-medium"
                  title="Copy Prompt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy Prompt
                </button>
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
{activeTab === 'raw_material' ? `I have an image of a Raw Material Stock table. Please extract the data and provide it in a CSV format exactly matching the following columns:

MATERIAL, OPENING STOCK, INWARD, CONS., CRUSHING (+3), FINES(-3) %, FINES(-3) QTY., PROD., DIS., CLOSING STOCK

Rules:
1. ONLY output the raw CSV data inside a code block. No explanations, no markdown formatting other than the code block.
2. If there are Category Headers (like "RAW IRON ORE", "RAW PELLET ORE"), output them in the MATERIAL column, with all other columns empty for that row.
3. Ignore rows that say "TOTAL" or "AS ON DATE".
4. Ensure all percentages and decimals are preserved exactly as shown.
5. Maintain the EXACT top-to-bottom row sequence as shown in the image. DO NOT sort the rows alphabetically.` : `I have an image of a Coal Details stock table. Please extract the data and provide it in a CSV format exactly matching the following 9 columns:

MATERIAL, OPENING STOCK, INWARD, CONS., F/C, MOIST. %, LANDED COST, DISCOUNT, CLOSING STOCK

Rules:
1. ONLY output the raw CSV data inside a code block. No explanations, no markdown formatting other than the code block.
2. If there are Category Headers (like "COAL DETAILS"), output them in the MATERIAL column, with all other columns empty for that row.
3. IMPORTANT: The second last column (before Closing Stock) is DISCOUNT, even if its heading is empty in the image!
4. The column before DISCOUNT is LANDED COST.
5. Ignore rows that say "TOTAL COAL".
6. Ensure all percentages and decimals are preserved exactly as shown.
7. Maintain the EXACT top-to-bottom row sequence as shown in the image. DO NOT sort the rows alphabetically.`}
                </pre>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsPromptModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed right-4 bottom-4 z-50 rounded px-2 py-1.5 sm:px-5 sm:py-4 shadow-lg border max-w-[90%] sm:max-w-md ${toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-600'}`}>
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}
    </div>
  )
}

export default Stock
