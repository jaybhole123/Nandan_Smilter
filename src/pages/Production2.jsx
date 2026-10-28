import React, { useState, useEffect, useRef } from 'react';
import { useProduction2Store } from '../store/useStore';
import { localDb } from '../services/localDb';
import OCRImageUploader from '../components/OCRImageUploader';
import { parseProductionOCR } from '../utils/ocrParsers';
import DateFilter from '../components/DateFilter';
import './Production2.css';

/* ---------- Load pdf.js (classic, non-module build) with CDN fallback chain ---------- */
const PDFJS_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"
];



const PDFJS_WORKER_SOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
];

function loadScript(url) {
  return new Promise(function (resolve, reject) {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve(url);
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
}

function loadPdfJsWithFallback(sources, index = 0) {
  if (index >= sources.length) {
    return Promise.reject(new Error("Saari CDN sources try kar li, koi kaam nahi kiya. Internet connection check karein."));
  }
  return loadScript(sources[index]).catch(function () {
    return loadPdfJsWithFallback(sources, index + 1);
  });
}

let pdfJsReadyPromise = null;
function ensurePdfJsLoaded() {
  if (pdfJsReadyPromise) return pdfJsReadyPromise;
  pdfJsReadyPromise = loadPdfJsWithFallback(PDFJS_SOURCES).then(function () {
    if (typeof window.pdfjsLib === "undefined") {
      throw new Error("pdf.js script load hui par pdfjsLib global nahi mila.");
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SOURCES[0];
    return window.pdfjsLib;
  });
  return pdfJsReadyPromise;
}

/* ---------- PDF row reconstruction ---------- */
async function extractRows(file) {
  const lib = await ensurePdfJsLoaded();
  const buffer = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buffer }).promise;
  const allRows = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));

    const rows = [];
    const tolerance = 2.5;
    for (const item of items) {
      let row = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }

    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const text = row.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) allRows.push(text);
    }
  }
  return allRows;
}

/* ---------- Extract ONLY the PRODUCTION section ---------- */
function num(str) {
  if (str === null || str === undefined) return null;
  const n = parseFloat(String(str).replace(/,/g, "").replace(/%$/, "").trim());
  return isNaN(n) ? null : n;
}

function parseRow(row) {
  const tokens = row.trim().split(/\s+/);
  let i = tokens.length;
  const values = [];
  while (i > 0 && /^-?[\d,]+(\.\d+)?%?$/.test(tokens[i - 1])) {
    values.unshift(tokens[i - 1]);
    i--;
  }
  const label = tokens.slice(0, i).join(" ");
  return { label, values };
}

function parseProductionSection(rows) {
  const dateRow = rows.find((r) => r.trim().startsWith("DATE"));
  let date = null;
  if (dateRow) {
    const m = dateRow.match(/DATE\s*:\s*(.+?)\s+KILN/i);
    date = m ? m[1].trim() : null;
  }

  const prodIdx = rows.findIndex((r) => r.trim().toUpperCase() === "PRODUCTION");
  if (prodIdx === -1) {
    return { date, found: false, items: [] };
  }
  const endIdx = rows.findIndex((r, i) => i > prodIdx && /DOWN TIME REMARKS/i.test(r));
  const sectionRows = rows.slice(prodIdx + 1, endIdx === -1 ? rows.length : endIdx);

  const items = [];
  for (const row of sectionRows) {
    const { label, values } = parseRow(row);
    if (!label || values.length === 0) continue;
    if (/^K-\s*\d/i.test(label.trim())) continue;

    let percent = null, kiln1 = null, kiln2 = null, total = null;
    if (values.length === 4) {
      [percent, kiln1, kiln2, total] = values.map(num);
    } else if (values.length === 3) {
      [kiln1, kiln2, total] = values.map(num);
    } else if (values.length === 2) {
      [kiln1, kiln2] = values.map(num);
    } else if (values.length === 1) {
      total = num(values[0]);
    }
    items.push({ label: label.trim(), percent, kiln1, kiln2, total });
  }

  return { date, found: items.length > 0, items };
}

async function parsePdfFile(file) {
  const rows = await extractRows(file);
  const data = parseProductionSection(rows);
  const fileUrl = URL.createObjectURL(file);
  return { ...data, fileName: file.name, fileUrl };
}

/* ---------- Utils ---------- */
function fmt(n) {
  return n === null || n === undefined ? "—" : (Number.isInteger(n) ? n.toFixed(2) : n.toFixed(2));
}
function fmtPct(n) {
  return n === null || n === undefined ? "" : `${n}%`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
/* ---------- Component ---------- */

export default function Production2Page() {
  const filesData = useProduction2Store(state => state.filesData);
  const setFilesData = useProduction2Store(state => state.setFilesData);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const fileInputRef = useRef(null);
  const fetchRequestId = useRef(0);

  const [headerDate, setHeaderDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = (date = headerDate) => {
    const requestId = ++fetchRequestId.current;
    let data = localDb.select('production2', (row) => row.report_date === date);
    data.sort((a, b) => {
      const sf = (a.source_file || '').localeCompare(b.source_file || '');
      if (sf !== 0) return sf;
      return (a.item_grade || '').localeCompare(b.item_grade || '');
    });

    if (requestId !== fetchRequestId.current) return;

    const grouped = new Map();
    (data || []).forEach(row => {
      let file = grouped.get(row.source_file);
      if (!file) {
        file = {
          date: row.report_date,
          fileName: row.source_file,
          found: true,
          items: []
        };
        grouped.set(row.source_file, file);
      }
      file.items.push({
        label: row.item_grade,
        percent: row.percent === null ? null : Number(row.percent),
        kiln1: Number(row.kiln1),
        kiln2: Number(row.kiln2),
        total: Number(row.total)
      });
    });

    setFilesData(Array.from(grouped.values()));
  };

  useEffect(() => {
    if (headerDate) fetchData();
  }, [headerDate]);

  // Manual Form State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editModeData, setEditModeData] = useState(null);
  const [manualDate, setManualDate] = useState("");
  const [manualItem, setManualItem] = useState('"A" GRADE');
  const [manualPercent, setManualPercent] = useState("");
  const [manualKiln1, setManualKiln1] = useState("");
  const [manualKiln2, setManualKiln2] = useState("");
  const [isSavingDB, setIsSavingDB] = useState(false);

  const handleSaveToDB = async () => {
    setIsSavingDB(true);
    let payloads = [];

    filesData.forEach(f => {
      f.items.forEach(item => {
        let reportDate = headerDate || new Date().toISOString().split('T')[0];
        if (f.date && f.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          reportDate = f.date;
        }

        payloads.push({
          report_date: reportDate,
          source_file: f.fileName || 'Manual Entry',
          item_grade: item.label,
          percent: item.percent ?? null,
          kiln1: item.kiln1 ?? 0,
          kiln2: item.kiln2 ?? 0,
          total: item.total ?? 0
        });
      });
    });

    if (payloads.length === 0) {
      setErrorMsg("Koi data nahi mila save karne ke liye.");
      setIsSavingDB(false);
      return;
    }

    localDb.delete('production2', (row) => row.report_date === headerDate);
    localDb.insert('production2', payloads);
    alert("Production data successfully save ho gaya!");
    fetchData(headerDate);
    setIsSavingDB(false);
  };

  useEffect(() => {
    ensurePdfJsLoaded().catch((err) => {
      console.error("pdf.js preload failed:", err);
      setErrorMsg("pdf.js abhi load nahi ho payi. Internet check karein — file upload par yeh dobara try hoga.");
    });
  }, []);

  const handleFiles = async (fileList) => {
    const fileArr = Array.from(fileList || []).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (fileArr.length === 0) {
      setErrorMsg("Sirf PDF file(s) upload karein.");
      return;
    }
    setErrorMsg("");

    let done = 0;
    const newFiles = [];
    for (const file of fileArr) {
      setProgressMsg(`Reading ${file.name}… (${done + 1}/${fileArr.length})`);
      try {
        const result = await parsePdfFile(file);
        if (!result.found) {
          setErrorMsg(`"${file.name}" me PRODUCTION section ka data nahi mila. Format check karein.`);
        } else {
          result.fileUrl = URL.createObjectURL(file);
          newFiles.push(result);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg(`"${file.name}" read nahi ho payi. (${err && err.message ? err.message : "unknown error"})`);
      }
      done++;
    }
    setProgressMsg("");
    setFilesData((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idxToRemove) => {
    setFilesData((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleOcrUpload = (extractedText) => {
    console.log(extractedText)
    const { rows: ocrRows } = parseProductionOCR(extractedText);
    if (!ocrRows || ocrRows.length === 0) {
      setErrorMsg("Image me PRODUCTION data nahi mila.");
      return;
    }
    
    const mappedItems = ocrRows.map(row => ({
      label: row.metricName,
      percent: parseFloat(row.percentValue) || null,
      kiln1: parseFloat(row.k1Value) || 0,
      kiln2: parseFloat(row.k2Value) || 0,
      total: parseFloat(row.totalValue) || 0
    }));

    const newResult = {
      date: new Date().toISOString().split('T')[0],
      fileName: "Image OCR Entry",
      found: true,
      items: mappedItems
    };
    
    setFilesData((prev) => [...prev, newResult]);
    alert("Image se data extract ho gaya!");
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualDate || !manualKiln1 || !manualKiln2) {
      setErrorMsg("Please fill out all fields for manual entry.");
      return;
    }
    setErrorMsg("");

    const k1 = parseFloat(manualKiln1);
    const k2 = parseFloat(manualKiln2);
    const newItem = {
      label: manualItem,
      percent: manualPercent ? parseFloat(manualPercent) : null,
      kiln1: k1,
      kiln2: k2,
      total: k1 + k2
    };

    setFilesData((prev) => {
      if (editModeData) {
        return prev.map(f => {
          if (f.date === editModeData.date && f.fileName === editModeData.fileName) {
            const updatedItems = f.items.map(i => i.label === editModeData.oldLabel ? newItem : i);
            return { ...f, items: updatedItems };
          }
          return f;
        });
      }

      const existingIdx = prev.findIndex(f => f.date === manualDate && f.fileName === "Manual Entry");
      if (existingIdx >= 0) {
        const newArr = [...prev];
        const existingItemIdx = newArr[existingIdx].items.findIndex(i => i.label === newItem.label);
        if (existingItemIdx >= 0) {
          const updatedItems = [...newArr[existingIdx].items];
          updatedItems[existingItemIdx] = newItem;
          newArr[existingIdx] = { ...newArr[existingIdx], items: updatedItems };
        } else {
          newArr[existingIdx] = {
            ...newArr[existingIdx],
            items: [...newArr[existingIdx].items, newItem]
          };
        }
        return newArr;
      }
      return [...prev, {
        date: manualDate,
        fileName: "Manual Entry",
        found: true,
        items: [newItem]
      }];
    });

    setEditModeData(null);
    setManualKiln1("");
    setManualKiln2("");
    setManualPercent("");
    setIsManualModalOpen(false);
  };

  const editSummaryItem = (fileDate, fileName, item) => {
    setEditModeData({ date: fileDate, fileName, oldLabel: item.label });
    setManualDate(fileDate);
    setManualItem(item.label);
    setManualPercent(item.percent !== null ? item.percent : "");
    setManualKiln1(item.kiln1);
    setManualKiln2(item.kiln2);
    setIsManualModalOpen(true);
  };

  const deleteSummaryItem = (fileDate, fileName, itemLabel) => {
    setFilesData(prev => prev.map(f => {
      if (f.date === fileDate && f.fileName === fileName) {
        return { ...f, items: f.items.filter(item => item.label !== itemLabel) };
      }
      return f;
    }).filter(f => f.items.length > 0));
  };

  const toCSV = () => {
    const rows = [["Date", "Source File", "Item", "Percent", "Kiln-1", "Kiln-2", "Total"]];
    filesData.forEach((f) => {
      f.items.forEach((item) => {
        rows.push([f.date ?? "", f.fileName, item.label, item.percent ?? "", item.kiln1 ?? "", item.kiln2 ?? "", item.total ?? ""]);
      });
    });
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const handleJsonExport = () => {
    downloadBlob(JSON.stringify(filesData, null, 2), "nspl_production_log.json", "application/json");
  };

  const handleCsvExport = () => {
    downloadBlob(toCSV(), "nspl_production_log.csv", "text/csv");
  };

  const handleClearAll = () => {
    if (window.confirm(`Delete all data for ${headerDate}?`)) {
      localDb.delete('production2', (row) => row.report_date === headerDate);
      setFilesData([]);
      setErrorMsg("");
    }
  };

  const filteredFiles = headerDate 
    ? filesData.filter(f => {
        if (!f.date) return false;
        // Simple check if it matches headerDate 
        // e.g., if headerDate is 2026-08-25, check for '25' and '08' and '2026'
        // or just rely on manual date setting. For now let's just show all or implement a basic check.
        // Let's actually not filter the local files by this strict date unless we parse it properly.
        // The user probably just wants it for the DB save and consistency.
        return true;
      }) 
    : filesData;

  const sortedFiles = [...filteredFiles].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <div className="space-y-6 pb-10 px-2 sm:px-4 w-full max-w-[1200px] mx-auto text-slate-800">
      
      {/* Top Banner (Modern Gradient) */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 rounded p-4 sm:p-5 mb-4 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center justify-between text-white">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-28 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-28 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        
        <div className="z-10 text-center sm:text-left mb-1 sm:mb-0">
          <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Module</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Production 2</h1>
        </div>
      </div>

      {/* Single Row: Action Buttons + Image Upload + Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm print:hidden mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <OCRImageUploader 
            onTextExtracted={handleOcrUpload} 
            buttonLabel="Scan Production Slip"
            className="px-5 h-10 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold rounded-lg transition flex items-center gap-2 shadow-sm"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 h-10 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span>Upload PDF</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <DateFilter date={headerDate} onChange={setHeaderDate} />
        </div>
      </div>

      <div className="print:hidden">
        <section
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 relative group
            ${isDragging ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="text-5xl mb-4 opacity-80 group-hover:Sale-110 transition-transform duration-300">🏭</div>
          <p className="text-lg font-semibold text-slate-700 mb-1">Upload Production PDF (2)</p>
          <p className="text-sm text-slate-500">Drag & drop your PDF files here, or click to browse</p>
          
          {progressMsg && <p className="mt-4 text-sm font-medium text-blue-600 bg-blue-50 py-2 px-4 rounded-full inline-block">{progressMsg}</p>}
          {errorMsg && <p className="mt-4 text-sm font-medium text-rose-600 bg-rose-50 py-2 px-4 rounded-full inline-block">{errorMsg}</p>}
        </section>
      </div>

        <div className="flex justify-between items-center mb-4 mt-8">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Production Data</h2>
          <div className="flex gap-2">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" onClick={() => document.getElementById('filesContainer').scrollBy({ left: -800, behavior: 'smooth' })} title="Scroll Left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" onClick={() => document.getElementById('filesContainer').scrollBy({ left: 800, behavior: 'smooth' })} title="Scroll Right">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors border border-rose-200" onClick={handleClearAll}>Clear All</button>
          </div>
        </div>

        <div id="filesContainer" className="flex overflow-x-auto gap-6 pb-6 snap-x hide-scrollbar scroll-smooth">
          {sortedFiles.length === 0 ? (
            <div className="min-w-full flex-shrink-0 bg-white border border-slate-300 rounded-lg shadow-sm snap-center overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                    <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="px-3 py-2 border-b border-slate-200">Item</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-1</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-2</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    <tr>
                      <td colSpan="4" className="text-center py-12 bg-slate-50/50">
                        <p className="text-slate-500 font-medium">No data available. Please upload a PDF.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            sortedFiles.map((f, i) => (
              <div className="min-w-full flex-shrink-0 bg-white border border-slate-300 rounded-lg shadow-sm snap-center overflow-hidden flex flex-col" key={i}>
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{f.date || "Date not found"}</div>
                    <div className="text-sm font-medium text-slate-700 truncate max-w-[250px]">{f.fileName}</div>
                  </div>
                  <button className="text-xs text-rose-500 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors" onClick={() => removeFile(i)}>Remove</button>
                </div>
                <div className="overflow-auto max-h-[60vh]">
                  <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                      <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="px-3 py-2 border-b border-slate-200">Item</th>
                        <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-1</th>
                        <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-2</th>
                        <th className="px-3 py-2 border-b border-slate-200 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {f.items.map((item, j) => (
                        <tr key={j} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${item.label.toUpperCase().startsWith('SPONGE PROD') ? 'bg-indigo-50/30 font-semibold' : ''}`}>
                          <td className="px-3 py-2">
                            {item.label}
                            {item.percent !== null && <span className="text-slate-400 ml-1">({fmtPct(item.percent)})</span>}
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(item.kiln1)}</td>
                          <td className="px-3 py-2 text-right">{fmt(item.kiln2)}</td>
                          <td className="px-3 py-2 text-right">{item.total === null ? "—" : fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center mb-4 mt-10">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sponge Production Summary</h2>
          <div className="flex gap-2">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" onClick={() => document.getElementById('summaryContainer').scrollBy({ left: -800, behavior: 'smooth' })} title="Scroll Left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" onClick={() => document.getElementById('summaryContainer').scrollBy({ left: 800, behavior: 'smooth' })} title="Scroll Right">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2" onClick={handleSaveToDB} disabled={isSavingDB}>
              {isSavingDB ? 'Saving...' : 'Save Data to DB'}
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-sm" onClick={() => {
              setEditModeData(null);
              setManualDate("");
              setManualItem('"A" GRADE');
              setManualPercent("");
              setManualKiln1("");
              setManualKiln2("");
              setIsManualModalOpen(true);
            }}>+ Add Entry</button>
          </div>
        </div>

        {isManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsManualModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="font-bold text-lg">{editModeData ? 'Edit Entry' : 'Manual Entry'}</h3>
                <button className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors" onClick={() => setIsManualModalOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <form className="p-6 flex flex-col gap-5 bg-slate-50" onSubmit={handleManualSubmit}>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Date</label>
                    <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Item Grade</label>
                    <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={manualItem} onChange={e => setManualItem(e.target.value)}>
                      <option value='"A" GRADE'>"A" GRADE</option>
                      <option value='"B" GRADE'>"B" GRADE</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Percent (%)</label>
                  <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="number" step="0.01" placeholder="e.g. 80" value={manualPercent} onChange={e => setManualPercent(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kiln-1 (Mt)</label>
                    <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-right" type="number" step="0.01" placeholder="0.00" value={manualKiln1} onChange={e => setManualKiln1(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kiln-2 (Mt)</label>
                    <input className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-right" type="number" step="0.01" placeholder="0.00" value={manualKiln2} onChange={e => setManualKiln2(e.target.value)} required />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors w-full sm:w-auto">Save Entry</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div id="summaryContainer" className="flex overflow-x-auto gap-6 pb-6 snap-x hide-scrollbar scroll-smooth">
          {sortedFiles.length === 0 ? (
            <div className="min-w-full flex-shrink-0 bg-white border border-slate-300 rounded-lg shadow-sm snap-center overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                    <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="px-3 py-2 border-b border-slate-200">Item</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-1</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-2</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-center">Total</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-center">Source File</th>
                      <th className="px-3 py-2 border-b border-slate-200 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    <tr>
                      <td colSpan="6" className="text-center py-12 bg-slate-50/50">
                        <p className="text-slate-500 font-medium">No data available.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            sortedFiles.map((f, i) => {
              const filteredItems = f.items.filter(item => {
                const upper = item.label.toUpperCase();
                return upper.includes('"A" GRADE') || upper.includes('"B" GRADE');
              });
              
              if (filteredItems.length === 0) return null;

              return (
                <div className="min-w-full flex-shrink-0 bg-white border border-slate-300 rounded-lg shadow-sm snap-center overflow-hidden flex flex-col" key={`summary-${i}`}>
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{f.date || "Date not found"}</div>
                      <div className="text-sm font-medium text-slate-700 truncate max-w-[250px]">{f.fileName}</div>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                        <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                          <th className="px-3 py-2 border-b border-slate-200">Item</th>
                          <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-1</th>
                          <th className="px-3 py-2 border-b border-slate-200 text-right">Kiln-2</th>
                          <th className="px-3 py-2 border-b border-slate-200 text-center">Total</th>
                          <th className="px-3 py-2 border-b border-slate-200 text-center">Source File</th>
                          <th className="px-3 py-2 border-b border-slate-200 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {filteredItems.map((item, j) => (
                          <tr key={j} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${item.label.toUpperCase().startsWith('SPONGE PROD') ? 'bg-indigo-50/30 font-semibold' : ''}`}>
                            <td className="px-3 py-2">
                              {item.label}
                              {item.percent !== null && <span className="text-slate-400 ml-1">({fmtPct(item.percent)})</span>}
                            </td>
                            <td className="px-3 py-2 text-right">{fmt(item.kiln1)}</td>
                            <td className="px-3 py-2 text-right">{fmt(item.kiln2)}</td>
                            <td className="px-3 py-2 text-center align-top">
                              <div>{item.total === null ? "—" : fmt(item.total)}</div>
                              {item.label.toUpperCase().includes('"A" GRADE') && <div className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">A grade total</div>}
                              {item.label.toUpperCase().includes('"B" GRADE') && <div className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">B grade total</div>}
                            </td>
                            <td className="px-3 py-2 text-center text-[11px] text-slate-400">
                              {f.fileUrl ? (
                                <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-700 font-medium inline-flex items-center gap-1 transition-colors" title="Preview PDF">
                                  PDF
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                              ) : (
                                f.fileName
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors" onClick={() => editSummaryItem(f.date, f.fileName, item)} title="Update">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                                <button className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" onClick={() => deleteSummaryItem(f.date, f.fileName, item.label)} title="Delete">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="px-3 py-2 font-bold text-slate-800">SUB TOTAL</td>
                          <td className="px-3 py-2 text-right align-bottom">
                            <div className="text-[10px] text-slate-400 font-normal uppercase mb-0.5">Kiln-1 total</div>
                            <strong className="text-slate-800">{fmt(filteredItems.reduce((acc, curr) => acc + (curr.kiln1 || 0), 0))}</strong>
                          </td>
                          <td className="px-3 py-2 text-right align-bottom">
                            <div className="text-[10px] text-slate-400 font-normal uppercase mb-0.5">Kiln-2 total</div>
                            <strong className="text-slate-800">{fmt(filteredItems.reduce((acc, curr) => acc + (curr.kiln2 || 0), 0))}</strong>
                          </td>
                          <td className="px-3 py-2 text-center align-bottom">
                            <strong className="text-slate-800">{fmt(filteredItems.reduce((acc, curr) => acc + (curr.total || 0), 0))}</strong>
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                        {(() => {
                          const expectedTotal = filteredItems.reduce((acc, curr) => acc + (curr.kiln1 || 0), 0) + filteredItems.reduce((acc, curr) => acc + (curr.kiln2 || 0), 0);
                          const actualTotal = filteredItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
                          const isCorrect = Math.abs(expectedTotal - actualTotal) < 0.001;
                          return (
                            <tr className={isCorrect ? "bg-emerald-50/40" : "bg-rose-50/40"}>
                              <td colSpan="3" className={`border-b border-slate-100 px-3 py-1 text-right text-[10px] font-semibold italic ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isCorrect ? 'Calculation Verified' : 'Calculation Mismatch'}
                              </td>
                              <td className={`border-b border-slate-100 px-3 py-1 text-center font-bold text-[10px] ${isCorrect ? 'text-emerald-700 bg-emerald-100/50' : 'text-rose-600 bg-rose-100/50'}`}>
                                {isCorrect ? 'Correct' : `Expected: ${fmt(expectedTotal)}`}
                              </td>
                              <td colSpan="2" className="border-b border-slate-100"></td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </div>
  );
}
