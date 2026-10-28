const fs = require('fs');
let code = fs.readFileSync('src/pages/Production.jsx', 'utf8');

// 1. States
code = code.replace(
  'const [editingId, setEditingId] = useState(null)',
  'const [editingId, setEditingId] = useState(null)\n  const [editRows, setEditRows] = useState([])\n  const [editDownTimeRemarks, setEditDownTimeRemarks] = useState("")'
);

// 2. Submit Logic & Form
code = code.replace(/if \(editingId\) \{[^{]*setEntries[^}]*\}[^{]*else \{/, 'if (false) {\n    } else {');
code = code.replace(
  /const handleEdit = \([^)]*\) => \{\s*const item = [^\n]*\n\s*if \(item\) \{\s*\/\/ Reconstruct[^\]]*\]\)\s*setDownTimeRemarks\([^)]*\)\s*setEditingId\(id\)\s*\}\s*\}/s,
  `const handleEdit = (id) => {
    const item = entries.find(i => i.id === id)
    if (item) {
      const loadedRows = []
      let index = 0
      while (item[\`metricRow_\${index}\`] !== undefined) {
        loadedRows.push({
          id: Date.now() + index,
          metricName: item[\`metricRow_\${index}\`] || '',
          percentValue: item[\`percentRow_\${index}\`] || '',
          k1Value: item[\`k1Row_\${index}\`] || '',
          k2Value: item[\`k2Row_\${index}\`] || '',
          totalValue: item[\`totalRow_\${index}\`] || '',
        })
        index++
      }
      setEditRows(loadedRows.length > 0 ? loadedRows : [{ ...initialFormState, id: Date.now() }])
      setEditDownTimeRemarks(item.downTimeRemarks || '')
      setEditingId(id)
    }
  }`
);

// 3. Save/Cancel handlers
code = code.replace(
  'const handleDelete =',
  `const handleEditRowChange = (index, field, value) => {
    setEditRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  const handleSaveInline = () => {
    const formData = {}
    editRows.forEach((row, index) => {
      formData[\`k1Row_\${index}\`] = row.k1Value
      formData[\`k2Row_\${index}\`] = row.k2Value
      formData[\`metricRow_\${index}\`] = row.metricName
      formData[\`percentRow_\${index}\`] = row.percentValue
      formData[\`totalRow_\${index}\`] = row.totalValue
    })
    formData.downTimeRemarks = editDownTimeRemarks

    setEntries(prev => prev.map(item => item.id === editingId ? { ...item, ...formData } : item))
    showToast('Production entry updated.')
    setEditingId(null)
  }

  const handleCancelInline = () => setEditingId(null)

  const handleDelete =`
);

// 4. Update the render logic
code = code.replace(
  /<tbody key=\{item\.id\}[^>]*>([\s\S]*?)<\/tbody>/g,
  (match) => {
    return `
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
`
  }
);

code = code.replace(/\{editingId \? 'Update Entry' : 'Add Entry \(Save to Table\)'\}/g, "'Add Entry (Save to Table)'");
code = code.replace(/\{editingId \? 'Edit Production Entry' : 'Add New Production Entry'\}/g, "'Add New Production Entry'");

fs.writeFileSync('src/pages/Production.jsx', code);
console.log('Production updated successfully.');
