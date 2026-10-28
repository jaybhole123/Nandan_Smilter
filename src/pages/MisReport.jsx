import React, { useState, useMemo, useRef, useEffect } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  useStockStore,
  useProductionStore,
  useProduction2Store
} from '../store/useStore'
import { localDb } from '../services/localDb'
import DateFilter from '../components/DateFilter'

const formatNumber = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0.000'
  return Number(value).toFixed(3)
}

const MisReport = () => {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [isDownloading, setIsDownloading] = useState(false)
  const reportRef = useRef(null)

  const [hiddenRows, setHiddenRows] = useState(new Set())
  const handleHideRow = (key) => setHiddenRows(prev => new Set([...prev, key]))

  const HideButton = ({ rowKey }) => (
    <button 
      onClick={() => handleHideRow(rowKey)} 
      className="absolute right-1 top-1/2 -translate-y-1/2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden cursor-pointer z-10"
      title="Hide Row"
      data-html2canvas-ignore="true"
      contentEditable={false}
    >
      ✕
    </button>
  )

  // Get data from all stores
  const [stockItems, setStockItems] = useState([])
  
  const [incomingList, setIncomingList] = useState([])
  const [outgoingList, setOutgoingList] = useState([])
  const [saudaSaleEntries, setSaudaSaleEntries] = useState([])
  const [saudaPurchaseEntries, setSaudaPurchaseEntries] = useState([])

  useEffect(() => {
    const fetchData = () => {
      // Fetch Raw Material Stock
      const rawData = localDb.select('raw_material_stock', (item) => {
        if (!item.created_at) return false
        return item.created_at >= `${reportDate}T00:00:00` && item.created_at <= `${reportDate}T23:59:59`
      })

      // Fetch Coal Stock
      const coalData = localDb.select('coal_stock', (item) => {
        if (!item.created_at) return false
        return item.created_at >= `${reportDate}T00:00:00` && item.created_at <= `${reportDate}T23:59:59`
      })

      let mappedStocks = []
      if (rawData && rawData.length > 0) {
        mappedStocks = [...mappedStocks, ...rawData.map(item => ({
          type: 'raw_material',
          category: item.category,
          material: item.material,
          closingStock: item.closing_stock
        }))]
      }
      if (coalData && coalData.length > 0) {
        mappedStocks = [...mappedStocks, ...coalData.map(item => ({
          type: 'coal_detail',
          category: item.category,
          material: item.material,
          closingStock: item.closing_stock
        }))]
      }
      setStockItems(mappedStocks)

      // Fetch item transfers
      const transfers = localDb.select('item_transfers', (item) => {
        if (!item.created_at) return false
        return item.created_at >= `${reportDate}T00:00:00` && item.created_at <= `${reportDate}T23:59:59`
      })

      if (transfers && transfers.length > 0) {
        const incoming = transfers.filter(d => d.entry_type === 'incoming').map(item => ({
          id: item.id,
          partyName: item.party_name,
          materialName: item.material_name,
          vehicleNo: item.vehicle_no,
          qty: item.qty,
          rate: item.rate
        }))
        const outgoing = transfers.filter(d => d.entry_type === 'outgoing').map(item => ({
          id: item.id,
          partyName: item.party_name,
          materialName: item.material_name,
          vehicleNo: item.vehicle_no,
          qty: item.qty,
          rate: item.rate
        }))
        setIncomingList(incoming)
        setOutgoingList(outgoing)
      } else {
        setIncomingList([])
        setOutgoingList([])
      }

      // Fetch Sauda Sale
      const saleData = localDb.select('sauda_sale')
      if (saleData) {
        setSaudaSaleEntries(saleData.map(item => ({
          mainHeading: item.main_heading,
          itemName: item.item_name,
          balPending: item.bal_pending
        })))
      }

      // Fetch Sauda Purchase
      const purchaseData = localDb.select('sauda_purchase')
      if (purchaseData) {
        setSaudaPurchaseEntries(purchaseData.map(item => ({
          mainHeading: item.main_heading,
          itemName: item.item_name,
          balPending: item.bal_pending
        })))
      }
    }
    fetchData()
  }, [reportDate])

  const production2FilesData = useProduction2Store(state => state.filesData)

  // 1. STOCK AGGREGATION — split into Raw Material and Coal Detail
  const rawMaterialSummary = useMemo(() => {
    const summary = {}
    const categoryLabels = {
      '': 'RAW IRON ORE',
      'rawPelletOre': 'RAW PELLET ORE',
      'processedIronOre': 'PROCESSED IRON ORE (3-18)',
      'ironFines': 'IRON FINES (0-3)'
    }
    stockItems.forEach(item => {
      if (item.type === 'coal_detail') return // skip coal
      let cat = item.category === undefined ? 'UNKNOWN' : item.category
      if (categoryLabels[cat] !== undefined) cat = categoryLabels[cat]
      let key = cat.toUpperCase().trim() || 'RAW IRON ORE'
      if (key.includes('NMDC BACHELI')) {
        key = 'IRON FINES (0-3)'
      }
      summary[key] = (summary[key] || 0) + (Number(item.closingStock) || 0)
    })
    return summary
  }, [stockItems])

  const coalStockSummary = useMemo(() => {
    const summary = {}
    stockItems.forEach(item => {
      if (item.type !== 'coal_detail') return // only coal
      const key = item.material?.toUpperCase().trim() || 'COAL MATERIAL'
      summary[key] = (summary[key] || 0) + (Number(item.closingStock) || 0)
    })

    let coalTotal = 0
    const finalSummary = {}
    
    const coalIdentifiers = [
      'COAL',
      'KOHINOOR',
      'LOYAL TRADING',
      'JBT(JAGANNATHPUR)',
      'SUNSHINE ENTE'
    ];

    Object.entries(summary).forEach(([key, val]) => {
      const isCoalType = coalIdentifiers.some(identifier => key.includes(identifier));
      if (isCoalType) {
        if (val > 0) {
          coalTotal += val
        }
      } else {
        finalSummary[key] = val
      }
    })
    
    const orderedSummary = {}
    if (coalTotal > 0) {
      orderedSummary['COAL'] = coalTotal
    }
    Object.assign(orderedSummary, finalSummary)

    return orderedSummary
  }, [stockItems])

  // 2. INCOMING AGGREGATION
  const incomingSummary = useMemo(() => {
    const summary = {}
    incomingList.forEach(item => {
      const material = item.materialName?.toUpperCase().trim() || 'UNKNOWN'
      summary[material] = (summary[material] || 0) + (Number(item.qty) || 0)
    })
    return summary
  }, [incomingList])

  // 3. OUTGOING AGGREGATION
  const outgoingSummary = useMemo(() => {
    const summary = {}
    outgoingList.forEach(item => {
      const material = item.materialName?.toUpperCase().trim() || 'UNKNOWN'
      summary[material] = (summary[material] || 0) + (Number(item.qty) || 0)
    })
    return summary
  }, [outgoingList])

  // 4. PRODUCTION AGGREGATION
  const productionSummary = useMemo(() => {
    // Track raw totals and the most recent percent per grade key
    const rawData = {
      '"A" GRADE': { k1: 0, k2: 0, total: 0, percent: null },
      '"B" GRADE': { k1: 0, k2: 0, total: 0, percent: null },
    }

    production2FilesData.forEach(f => {
      f.items.forEach(item => {
        const label = item.label.toUpperCase().trim()
        let gradeKey = null
        if (label.includes('"A" GRADE')) gradeKey = '"A" GRADE'
        else if (label.includes('"B" GRADE')) gradeKey = '"B" GRADE'

        if (gradeKey) {
          rawData[gradeKey].k1 += Number(item.kiln1) || 0
          rawData[gradeKey].k2 += Number(item.kiln2) || 0
          rawData[gradeKey].total += Number(item.total) || 0
          // Use most recent percent (overwrite each file so last file wins)
          if (item.percent !== null && item.percent !== undefined) {
            rawData[gradeKey].percent = item.percent
          }
        }
      })
    })

    // Build final summary with dynamic percentage label
    const summary = {}
    Object.entries(rawData).forEach(([gradeKey, val]) => {
      if (val.total > 0 || val.k1 > 0 || val.k2 > 0) {
        const pct = val.percent !== null ? `${val.percent}%` : ''
        const finalLabel = pct ? `${gradeKey} (${pct})` : gradeKey
        summary[finalLabel] = { k1: val.k1, k2: val.k2, total: val.total }
      }
    })

    return summary
  }, [production2FilesData])

  // Calculate totals for production
  const prodTotalK1 = Object.values(productionSummary).reduce((sum, val) => sum + val.k1, 0)
  const prodTotalK2 = Object.values(productionSummary).reduce((sum, val) => sum + val.k2, 0)
  const prodTotalAll = Object.values(productionSummary).reduce((sum, val) => sum + val.total, 0)


  // 5. SAUDA SALE AGGREGATION
  const saudaSaleSummary = useMemo(() => {
    const summary = {}
    saudaSaleEntries.forEach(item => {
      const material = (item.mainHeading || item.itemName)?.toUpperCase().trim() || 'UNKNOWN'
      summary[material] = (summary[material] || 0) + (Number(item.balPending) || 0)
    })
    // Convert object to array for easier rendering
    return Object.entries(summary).map(([itemName, balPending]) => ({
      itemName,
      balPending
    }))
  }, [saudaSaleEntries])

  // 6. SAUDA PURCHASE AGGREGATION
  const saudaPurchaseSummary = useMemo(() => {
    const summary = {}
    saudaPurchaseEntries.forEach(item => {
      const material = (item.mainHeading || item.itemName)?.toUpperCase().trim() || 'UNKNOWN'
      if (!summary[material]) summary[material] = 0
      summary[material] += Number(item.balPending) || 0
    })

    // Merge all COAL variants into a single "COAL" row
    let coalTotal = 0
    const nonCoalSummary = {}
    Object.entries(summary).forEach(([key, val]) => {
      if (key.includes('COAL')) {
        coalTotal += val
      } else {
        nonCoalSummary[key] = val
      }
    })
    if (coalTotal > 0) {
      nonCoalSummary['COAL'] = coalTotal
    }
    
    // Convert object to array for easier rendering
    return Object.entries(nonCoalSummary).map(([itemName, balPending]) => ({
      itemName,
      balPending
    }))
  }, [saudaPurchaseEntries])

  // Filtered Lists for Hiding Rows
  const filteredRawStock = Object.entries(rawMaterialSummary).filter(([m]) => !hiddenRows.has(`rawstock-${m}`))
  const filteredCoalStock = Object.entries(coalStockSummary).filter(([m]) => !hiddenRows.has(`coalstock-${m}`))
  const filteredIncoming = incomingList.filter((item, idx) => !hiddenRows.has(`inc-${item.id || idx}`))
  const filteredOutgoing = outgoingList.filter((item, idx) => !hiddenRows.has(`out-${item.id || idx}`))
  const filteredProduction = Object.entries(productionSummary).filter(([m]) => !hiddenRows.has(`prod-${m}`))
  const prodTotalK1Filtered = filteredProduction.reduce((sum, [, val]) => sum + val.k1, 0)
  const prodTotalK2Filtered = filteredProduction.reduce((sum, [, val]) => sum + val.k2, 0)
  const prodTotalAllFiltered = filteredProduction.reduce((sum, [, val]) => sum + val.total, 0)
  const filteredSaudaSale = saudaSaleSummary.filter((item, idx) => !hiddenRows.has(`sale-${item.itemName || idx}`))
  const filteredSaudaPurchase = saudaPurchaseSummary.filter((item, idx) => !hiddenRows.has(`pur-${item.itemName || idx}`))

  // Local ordered states
  const [orderedRawStock, setOrderedRawStock] = useState(filteredRawStock)
  const [orderedCoalStock, setOrderedCoalStock] = useState(filteredCoalStock)
  const [orderedIncoming, setOrderedIncoming] = useState(filteredIncoming)
  const [orderedOutgoing, setOrderedOutgoing] = useState(filteredOutgoing)
  const [orderedProduction, setOrderedProduction] = useState(filteredProduction)
  const [orderedSaudaSale, setOrderedSaudaSale] = useState(filteredSaudaSale)
  const [orderedSaudaPurchase, setOrderedSaudaPurchase] = useState(filteredSaudaPurchase)

  useEffect(() => setOrderedRawStock(filteredRawStock), [JSON.stringify(filteredRawStock)])
  useEffect(() => setOrderedCoalStock(filteredCoalStock), [JSON.stringify(filteredCoalStock)])
  useEffect(() => setOrderedIncoming(filteredIncoming), [JSON.stringify(filteredIncoming)])
  useEffect(() => setOrderedOutgoing(filteredOutgoing), [JSON.stringify(filteredOutgoing)])
  useEffect(() => setOrderedProduction(filteredProduction), [JSON.stringify(filteredProduction)])
  useEffect(() => setOrderedSaudaSale(filteredSaudaSale), [JSON.stringify(filteredSaudaSale)])
  useEffect(() => setOrderedSaudaPurchase(filteredSaudaPurchase), [JSON.stringify(filteredSaudaPurchase)])

  const [draggedRow, setDraggedRow] = useState(null)

  const handleDragStart = (e, index, listType) => {
    setDraggedRow({ index, listType })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetIndex, listType, list, setList) => {
    e.preventDefault()
    if (!draggedRow || draggedRow.listType !== listType) return
    if (draggedRow.index === targetIndex) return

    const newList = [...list]
    const item = newList[draggedRow.index]
    newList.splice(draggedRow.index, 1)
    newList.splice(targetIndex, 0, item)
    
    setList(newList)
    setDraggedRow(null)
  }

  // Formatting date for header
  const formattedDate = new Date(reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

  const downloadPDF = async () => {
    const element = reportRef.current
    if (!element) return

    setIsDownloading(true)
    try {
      const canvas = await html2canvas(element, { 
        Sale: 2, 
        useCORS: true, 
        logging: false 
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      const imgProps = pdf.getImageProperties(imgData)
      const margin = 10
      const availableWidth = pdfWidth - (margin * 2)
      
      const imgHeight = (imgProps.height * availableWidth) / imgProps.width
      const availableHeight = pdfHeight - (margin * 2)
      
      let finalWidth = availableWidth
      let finalHeight = imgHeight
      
      if (imgHeight > availableHeight) {
        finalHeight = availableHeight
        finalWidth = (imgProps.width * availableHeight) / imgProps.height
      }
      
      const xOffset = margin + (availableWidth - finalWidth) / 2
      
      pdf.addImage(imgData, 'PNG', xOffset, margin, finalWidth, finalHeight)
      pdf.save(`Nandan_Smelters_Report_${formattedDate}.pdf`)
      
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF.")
    } finally {
      setIsDownloading(false)
    }
  }

  // UI based on image provided
  return (
    <div className="space-y-6 pb-12 px-2 sm:px-4 max-w-[1200px] mx-auto text-slate-800">
      <style>{`
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: #ffffff !important;
          }
          table { 
            font-size: 11px !important; 
            width: 100% !important;
          }
          td, th { 
            padding-top: 3px !important; 
            padding-bottom: 3px !important; 
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Banner (Executive Brand Header) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-5 sm:p-6 mb-2 shadow-xl border border-indigo-900/40 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between text-white print:hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="z-10 text-center sm:text-left mb-3 sm:mb-0 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-black text-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300">Executive Management Information System</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Auto Consolidated</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              MIS Daily Report & Settings
            </h1>
          </div>
        </div>

        <div className="z-10 flex flex-col sm:items-end text-xs text-slate-300">
          <span className="font-semibold text-white tracking-wide">NANDAN SMELTERS LTD.</span>
          <span className="text-slate-400">Consolidated Daily Operations Sheet</span>
        </div>
      </div>

      {/* KPI Stats Quick Bar (Live summary indicators) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Raw Stock Items</div>
            <div className="text-lg font-bold text-slate-800">{orderedRawStock.length} Items</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Daily Logistics</div>
            <div className="text-lg font-bold text-slate-800">{orderedIncoming.length + orderedOutgoing.length} Trips</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">24h Production Total</div>
            <div className="text-lg font-bold text-slate-800">{formatNumber(prodTotalAllFiltered)} <span className="text-xs text-slate-500 font-normal">MT</span></div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Pending Sauda</div>
            <div className="text-lg font-bold text-slate-800">{orderedSaudaSale.length + orderedSaudaPurchase.length} Deals</div>
          </div>
        </div>
      </div>

      {/* Single Line Controls Bar: DateFilter + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={downloadPDF} 
            disabled={isDownloading}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 h-10 rounded-lg shadow-sm shadow-emerald-600/20 flex items-center gap-2 font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
          >
            {isDownloading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            <span>Download PDF</span>
          </button>

          <button 
            onClick={() => window.print()} 
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-4 h-10 rounded-lg shadow-sm shadow-indigo-600/20 flex items-center gap-2 font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span>Print Report</span>
          </button>

          {hiddenRows.size > 0 && (
            <button 
              onClick={() => setHiddenRows(new Set())} 
              className="bg-rose-50 border border-rose-200 text-rose-600 px-3.5 h-10 rounded-lg hover:bg-rose-100 flex items-center gap-1.5 font-semibold transition-all text-xs cursor-pointer shadow-sm"
            >
              <span>Unhide All ({hiddenRows.size})</span>
            </button>
          )}

          <div className="hidden lg:flex items-center text-xs text-slate-400 pl-2">
            <span>Tip: Drag rows to reorder &bull; Click any cell to edit &bull; Hover to hide row</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DateFilter date={reportDate} onChange={setReportDate} />
        </div>
      </div>

      {/* The Report (Printable Area Wrapper with Premium Executive Styling) */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3 sm:p-8 print:p-0 print:border-none print:shadow-none" ref={reportRef}>
        <table className="w-full border-collapse border border-slate-500 text-[13px] sm:text-xs print:text-[10px] text-slate-900 bg-white">
          
          {/* Main Header */}
          <thead>
            <tr>
              <th contentEditable suppressContentEditableWarning colSpan="2" className="bg-[#1e3a8a] text-white py-3.5 px-4 text-center font-black text-xl sm:text-2xl border border-slate-600 uppercase tracking-wider">
                NANDAN SMELTERS REPORT
              </th>
              <th contentEditable suppressContentEditableWarning className="bg-[#1e3a8a] text-white py-3.5 px-3 text-center font-bold text-base sm:text-lg border border-slate-600 w-[180px]">
                {formattedDate}
              </th>
            </tr>
          </thead>
          
          <tbody>
            {/* RAW MATERIAL STOCK SECTION */}
            {orderedRawStock.length > 0 ? (
              <>
                {orderedRawStock.map(([material, qty], idx) => (
                  <tr key={`rawstock-${material}`} className="group cursor-move hover:bg-blue-50/40 transition-colors" draggable onDragStart={(e) => handleDragStart(e, idx, 'rawstock')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'rawstock', orderedRawStock, setOrderedRawStock)}>
                    {idx === 0 && (
                      <td contentEditable suppressContentEditableWarning rowSpan={orderedRawStock.length} className="font-extrabold border border-slate-500 p-2 align-top w-[140px] bg-slate-50/70 text-slate-900 uppercase tracking-wide">
                        RAW MATERIAL STOCK
                      </td>
                    )}
                    <td contentEditable suppressContentEditableWarning className="font-semibold border border-slate-500 p-2 relative text-slate-800">
                      <HideButton rowKey={`rawstock-${material}`} />
                      {material}
                    </td>
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-500 p-2 text-right font-mono text-slate-900">{formatNumber(qty)}</td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td contentEditable suppressContentEditableWarning className="font-extrabold border border-slate-500 p-2 align-top w-[140px] bg-slate-50/70 uppercase">RAW MATERIAL STOCK</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2 text-center text-slate-400 italic">No raw material stock found.</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2"></td>
              </tr>
            )}

            {/* COAL DETAIL STOCK SECTION */}
            {orderedCoalStock.length > 0 ? (
              <>
                {orderedCoalStock.map(([material, qty], idx) => (
                  <tr key={`coalstock-${material}`} className="group cursor-move hover:bg-blue-50/40 transition-colors" draggable onDragStart={(e) => handleDragStart(e, idx, 'coalstock')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'coalstock', orderedCoalStock, setOrderedCoalStock)}>
                    {idx === 0 && (
                      <td contentEditable suppressContentEditableWarning rowSpan={orderedCoalStock.length} className="font-extrabold border border-slate-500 p-2 align-top w-[140px] bg-slate-50/70 text-slate-900 uppercase tracking-wide">
                        COAL STOCK
                      </td>
                    )}
                    <td contentEditable suppressContentEditableWarning className="font-semibold border border-slate-500 p-2 relative text-slate-800">
                      <HideButton rowKey={`coalstock-${material}`} />
                      {material}
                    </td>
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-500 p-2 text-right font-mono text-slate-900">{formatNumber(qty)}</td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td contentEditable suppressContentEditableWarning className="font-extrabold border border-slate-500 p-2 align-top w-[140px] bg-slate-50/70 uppercase">COAL STOCK</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2 text-center text-slate-400 italic">No coal stock found.</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2"></td>
              </tr>
            )}

            {/* YESTERDAY INCOMING MATERIALS */}
            <tr>
              <td contentEditable suppressContentEditableWarning colSpan="3" className="bg-[#e0e7ff] text-[#1e1b4b] font-black text-center p-2 border border-slate-500 uppercase tracking-wider text-xs sm:text-sm">
                YESTERDAY INCOMING MATERIALS
              </td>
            </tr>
            {filteredIncoming.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-500">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100">
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[55px]">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-left text-slate-700">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-left text-slate-700">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[125px]">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[120px]">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[120px]">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedIncoming.map((item, idx) => (
                        <tr key={`inc-${item.id || idx}`} className="border-b border-slate-500 last:border-b-0 hover:bg-indigo-50/40 transition-colors group cursor-move" draggable onDragStart={(e) => handleDragStart(e, idx, 'incoming')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'incoming', orderedIncoming, setOrderedIncoming)}>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-bold relative text-slate-700">
                            <HideButton rowKey={`inc-${item.id || idx}`} />
                            {idx + 1}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 font-semibold text-slate-800">{item.partyName}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 font-semibold text-slate-800">{item.materialName}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-mono font-medium text-slate-700">{item.vehicleNo}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-bold font-mono text-slate-900">{formatNumber(item.qty)}</td>
                          <td contentEditable suppressContentEditableWarning className="p-1.5 text-center font-mono font-semibold text-slate-800">{item.rate || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            ) : (
              <tr><td contentEditable suppressContentEditableWarning colSpan="3" className="border border-slate-500 p-2 text-center text-slate-400 italic">No incoming materials found.</td></tr>
            )}

            {/* YESTERDAY OUTGOING MATERIALS */}
            <tr>
              <td contentEditable suppressContentEditableWarning colSpan="3" className="bg-[#e0e7ff] text-[#1e1b4b] font-black text-center p-2 border border-slate-500 uppercase tracking-wider text-xs sm:text-sm">
                YESTERDAY OUTGOING MATERIALS
              </td>
            </tr>
            {filteredOutgoing.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-500">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100">
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[55px]">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-left text-slate-700">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-left text-slate-700">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[125px]">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[120px]">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-500 font-extrabold p-1.5 text-center text-slate-700 w-[120px]">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedOutgoing.map((item, idx) => (
                        <tr key={`out-${item.id || idx}`} className="border-b border-slate-500 last:border-b-0 hover:bg-indigo-50/40 transition-colors group cursor-move" draggable onDragStart={(e) => handleDragStart(e, idx, 'outgoing')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'outgoing', orderedOutgoing, setOrderedOutgoing)}>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-bold relative text-slate-700">
                            <HideButton rowKey={`out-${item.id || idx}`} />
                            {idx + 1}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 font-semibold text-slate-800">{item.partyName}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 font-semibold text-slate-800">{item.materialName}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-mono font-medium text-slate-700">{item.vehicleNo}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 p-1.5 text-center font-bold font-mono text-slate-900">{formatNumber(item.qty)}</td>
                          <td contentEditable suppressContentEditableWarning className="p-1.5 text-center font-mono font-semibold text-slate-800">{item.rate || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            ) : (
              <tr><td contentEditable suppressContentEditableWarning colSpan="3" className="border border-slate-500 p-2 text-center text-slate-400 italic">No outgoing materials found.</td></tr>
            )}

            {/* TOTAL PRODUCTION IN 24HR */}
            <tr>
              <td contentEditable suppressContentEditableWarning colSpan="3" className="bg-[#e0e7ff] text-[#1e1b4b] font-black text-center p-2 border border-slate-500 uppercase tracking-wider text-xs sm:text-sm">
                TOTAL PRODUCTION IN 24HR
              </td>
            </tr>
            {filteredProduction.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-500">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100">
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center text-slate-700">GRADE</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center w-[120px] text-slate-700">KILN 1</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-500 font-extrabold p-1.5 text-center w-[120px] text-slate-700">KILN 2</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-500 font-extrabold p-1.5 text-center w-[120px] text-slate-700">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedProduction.map(([metric, values], idx) => (
                        <tr key={`prod-${metric}`} className="group cursor-move hover:bg-indigo-50/40 transition-colors" draggable onDragStart={(e) => handleDragStart(e, idx, 'production')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'production', orderedProduction, setOrderedProduction)}>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 font-bold p-1.5 uppercase relative text-slate-800">
                            <HideButton rowKey={`prod-${metric}`} />
                            {metric}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 font-bold p-1.5 text-center font-mono text-slate-900">{formatNumber(values.k1)}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-500 font-bold p-1.5 text-center font-mono text-slate-900">{formatNumber(values.k2)}</td>
                          <td contentEditable suppressContentEditableWarning className="font-bold p-1.5 text-center font-mono text-slate-900">
                            <div>{formatNumber(values.total)}</div>
                            {metric.includes('"A" GRADE') && <div className="text-[9px] text-slate-500 font-normal uppercase mt-0.5">A GRADE TOTAL</div>}
                            {metric.includes('"B" GRADE') && <div className="text-[9px] text-slate-500 font-normal uppercase mt-0.5">B GRADE TOTAL</div>}
                          </td>
                        </tr>
                      ))}
                      {/* Sub-total for production */}
                      <tr className="bg-[#cbd5e1] font-bold" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <td contentEditable suppressContentEditableWarning className="border-t-[2px] border-r border-slate-500 font-black py-2.5 px-2 text-center uppercase text-slate-900 tracking-wider">SPONGE TOTAL</td>
                        <td contentEditable suppressContentEditableWarning className="border-t-[2px] border-r border-slate-500 font-bold py-2.5 px-1 text-center font-mono">
                          <div className="text-[9px] text-slate-600 font-bold uppercase leading-tight">KILN-1 TOTAL</div>
                          {formatNumber(prodTotalK1Filtered)}
                        </td>
                        <td contentEditable suppressContentEditableWarning className="border-t-[2px] border-r border-slate-500 font-bold py-2.5 px-1 text-center font-mono">
                          <div className="text-[9px] text-slate-600 font-bold uppercase leading-tight">KILN-2 TOTAL</div>
                          {formatNumber(prodTotalK2Filtered)}
                        </td>
                        <td contentEditable suppressContentEditableWarning className="border-t-[2px] border-slate-500 font-extrabold py-2.5 px-1 text-center font-mono text-base text-slate-950">
                          {formatNumber(prodTotalAllFiltered)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ) : (
              <tr><td contentEditable suppressContentEditableWarning colSpan="3" className="border border-slate-500 p-2 text-center text-slate-400 italic">No production entries found.</td></tr>
            )}

            {/* BALANCE PENDING OUTGOING (SAUDA SALE) */}
            <tr>
              <td contentEditable suppressContentEditableWarning colSpan="3" className="bg-[#e0e7ff] text-[#1e1b4b] font-black text-center p-2 border border-slate-500 uppercase tracking-wider text-xs sm:text-sm">
                BALANCE PENDING OUTGOING (SAUDA SALE)
              </td>
            </tr>
            <tr className="bg-slate-100">
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide w-[140px]">TYPE</th>
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide">ITEM'S</th>
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide w-[180px]">BAL. PENDING</th>
            </tr>
            {orderedSaudaSale.map((item, idx) => (
              <tr key={`sale-${item.itemName || idx}`} className="group cursor-move hover:bg-indigo-50/40 transition-colors" draggable onDragStart={(e) => handleDragStart(e, idx, 'saudaSale')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'saudaSale', orderedSaudaSale, setOrderedSaudaSale)}>
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, orderedSaudaSale.length)} className="font-extrabold border border-slate-500 p-2 align-top uppercase bg-slate-50/70 text-slate-900 tracking-wide">SALE</td>}
                <td contentEditable suppressContentEditableWarning className="font-semibold border border-slate-500 p-2 uppercase relative text-slate-800">
                  <HideButton rowKey={`sale-${item.itemName || idx}`} />
                  {item.itemName}
                </td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-500 p-2 text-right font-mono text-slate-900">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {filteredSaudaSale.length === 0 && (
              <tr>
                <td contentEditable suppressContentEditableWarning className="font-extrabold border border-slate-500 p-2 align-top w-[140px] uppercase bg-slate-50/70">SALE</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2 text-center text-slate-400 italic">No pending sales found.</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2"></td>
              </tr>
            )}

            {/* BALANCE PENDING INCOMING (SAUDA PURCHASE) */}
            <tr>
              <td contentEditable suppressContentEditableWarning colSpan="3" className="bg-[#e0e7ff] text-[#1e1b4b] font-black text-center p-2 border border-slate-500 uppercase tracking-wider text-xs sm:text-sm">
                BALANCE PENDING INCOMING (SAUDA PURCHASE)
              </td>
            </tr>
            <tr className="bg-slate-100">
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide w-[140px]">TYPE</th>
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide">ITEM'S</th>
              <th contentEditable suppressContentEditableWarning className="text-slate-700 font-extrabold text-center p-1.5 border border-slate-500 uppercase tracking-wide w-[180px]">BAL. PENDING</th>
            </tr>
            {orderedSaudaPurchase.map((item, idx) => (
              <tr key={`pur-${item.itemName || idx}`} className="group cursor-move hover:bg-indigo-50/40 transition-colors" draggable onDragStart={(e) => handleDragStart(e, idx, 'saudaPurchase')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'saudaPurchase', orderedSaudaPurchase, setOrderedSaudaPurchase)}>
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, orderedSaudaPurchase.length)} className="font-extrabold border border-slate-500 p-2 align-top uppercase bg-slate-50/70 text-slate-900 tracking-wide">PURCHASE</td>}
                <td contentEditable suppressContentEditableWarning className="font-semibold border border-slate-500 p-2 uppercase relative text-slate-800">
                  <HideButton rowKey={`pur-${item.itemName || idx}`} />
                  {item.itemName}
                </td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-500 p-2 text-right font-mono text-slate-900">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {filteredSaudaPurchase.length === 0 && (
              <tr>
                <td contentEditable suppressContentEditableWarning className="font-extrabold border border-slate-500 p-2 align-top w-[140px] uppercase bg-slate-50/70">PURCHASE</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2 text-center text-slate-400 italic">No pending purchases found.</td>
                <td contentEditable suppressContentEditableWarning className="border border-slate-500 p-2"></td>
              </tr>
            )}

            {/* NOTES SECTION */}
            <tr>
              <td contentEditable suppressContentEditableWarning className="bg-slate-100 text-slate-800 font-extrabold p-2 border border-slate-500 uppercase tracking-wider align-top w-[140px]">
                NOTES:
              </td>
              <td contentEditable suppressContentEditableWarning colSpan="2" className="border border-slate-500 p-3 text-slate-800 font-medium text-sm min-h-[70px] align-top outline-none focus:bg-slate-50/80 transition-colors break-words whitespace-pre-wrap" placeholder="Click here to type additional management notes...">
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MisReport
