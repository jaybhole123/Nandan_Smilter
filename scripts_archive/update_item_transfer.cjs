const fs = require('fs');
let code = fs.readFileSync('src/pages/ItemTransfer.jsx', 'utf8');

// 1. Add editForm state
code = code.replace(
  'const [editingOutgoingId, setEditingOutgoingId] = useState(null)',
  'const [editingOutgoingId, setEditingOutgoingId] = useState(null)\n  const [editIncomingForm, setEditIncomingForm] = useState(initialIncomingForm)\n  const [editOutgoingForm, setEditOutgoingForm] = useState(initialOutgoingForm)'
);

// 2. Modify resetForms
code = code.replace(
  /const resetIncomingForm = \(\) => \{[^}]*setEditingIncomingId\(null\)\n  \}/s,
  `const resetIncomingForm = () => {
    setIncomingForm(initialIncomingForm)
  }`
);
code = code.replace(
  /const resetOutgoingForm = \(\) => \{[^}]*setEditingOutgoingId\(null\)\n  \}/s,
  `const resetOutgoingForm = () => {
    setOutgoingForm(initialOutgoingForm)
  }`
);

// 3. Modify handleSubmits to remove edit logic
code = code.replace(
  /if \(editingIncomingId\) \{[^{]*setIncomingList[^}]*\}[^{]*else \{/,
  'if (false) {\n    } else {'
);
code = code.replace(
  /if \(editingOutgoingId\) \{[^{]*setOutgoingList[^}]*\}[^{]*else \{/,
  'if (false) {\n    } else {'
);

// 4. Update handleEdits
code = code.replace(
  /const handleEditIncoming = \([^)]*\) => \{\s*const item = [^\n]*\n\s*if \(item\) \{\s*setIncomingForm\(item\)\s*setEditingIncomingId\(id\)\s*\}\s*\}/s,
  `const handleEditIncoming = (id) => {
    const item = incomingList.find(i => i.id === id)
    if (item) {
      setEditIncomingForm(item)
      setEditingIncomingId(id)
    }
  }`
);
code = code.replace(
  /const handleEditOutgoing = \([^)]*\) => \{\s*const item = [^\n]*\n\s*if \(item\) \{\s*setOutgoingForm\(item\)\s*setEditingOutgoingId\(id\)\s*\}\s*\}/s,
  `const handleEditOutgoing = (id) => {
    const item = outgoingList.find(i => i.id === id)
    if (item) {
      setEditOutgoingForm(item)
      setEditingOutgoingId(id)
    }
  }`
);

// 5. Add inline save/cancel handlers
code = code.replace(
  'const handleDeleteOutgoing = (id) => {',
  `const handleSaveInlineIncoming = () => {
    if (!editIncomingForm.partyName.trim() || !editIncomingForm.materialName.trim()) return showToast('Required fields missing', 'error')
    setIncomingList(prev => prev.map(item => item.id === editingIncomingId ? { ...editIncomingForm, id: item.id } : item))
    showToast('Incoming updated.')
    setEditingIncomingId(null)
  }
  const handleCancelInlineIncoming = () => setEditingIncomingId(null)

  const handleSaveInlineOutgoing = () => {
    if (!editOutgoingForm.partyName.trim() || !editOutgoingForm.materialName.trim()) return showToast('Required fields missing', 'error')
    setOutgoingList(prev => prev.map(item => item.id === editingOutgoingId ? { ...editOutgoingForm, id: item.id } : item))
    showToast('Outgoing updated.')
    setEditingOutgoingId(null)
  }
  const handleCancelInlineOutgoing = () => setEditingOutgoingId(null)

  const handleDeleteOutgoing = (id) => {`
);

// 6. Update renderTable signature
code = code.replace(
  'const renderTable = (type, list, onEdit, onDelete, isPreview = false) => {',
  'const renderTable = (type, list, onEdit, onDelete, editForm, setEditForm, onSaveInline, onCancelInline, editingId, isPreview = false) => {'
);

// 7. Update table row rendering
code = code.replace(
  /<tr key=\{item\.id\}[^>]*>([\s\S]*?)<\/tr>/g,
  (match) => {
    if (match.includes('colSpan="7"')) return match;
    
    return `
                    <tr key={item.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                      {editingId === item.id ? (
                        <>
                          <td className="px-2 py-1.5 text-slate-400 font-medium border border-slate-400">{index + 1}</td>
                          <td className="px-2 py-1.5 border border-slate-400"><input type="text" value={editForm.partyName} onChange={e => setEditForm({...editForm, partyName: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" /></td>
                          <td className="px-2 py-1.5 border border-slate-400"><input type="text" value={editForm.materialName} onChange={e => setEditForm({...editForm, materialName: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" /></td>
                          <td className="px-2 py-1.5 border border-slate-400"><input type="text" value={editForm.vehicleNo} onChange={e => setEditForm({...editForm, vehicleNo: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" /></td>
                          <td className="px-2 py-1.5 border border-slate-400"><input type="number" value={editForm.qty} onChange={e => setEditForm({...editForm, qty: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right" /></td>
                          <td className="px-2 py-1.5 border border-slate-400"><input type="number" value={editForm.rate} onChange={e => setEditForm({...editForm, rate: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right" /></td>
                          <td className="px-2 py-1.5 text-center print:hidden border border-slate-400 bg-white align-middle">
                            <div className="flex flex-row justify-center items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={onSaveInline} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button onClick={onCancelInline} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Cancel">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
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
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEdit(item.id)} className="p-1.5 rounded transition-colors text-blue-500 hover:bg-blue-50" title="Edit">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => onDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>`
  }
);

// 8. Update renderTable calls
code = code.replace(
  "{renderTable('incoming', incomingCsvPreview, null, null, true)}",
  "{renderTable('incoming', incomingCsvPreview, null, null, null, null, null, null, null, true)}"
);
code = code.replace(
  "{renderTable('outgoing', outgoingCsvPreview, null, null, true)}",
  "{renderTable('outgoing', outgoingCsvPreview, null, null, null, null, null, null, null, true)}"
);
code = code.replace(
  "{renderTable('incoming', incomingList, handleEditIncoming, handleDeleteIncoming, false)}",
  "{renderTable('incoming', incomingList, handleEditIncoming, handleDeleteIncoming, editIncomingForm, setEditIncomingForm, handleSaveInlineIncoming, handleCancelInlineIncoming, editingIncomingId, false)}"
);
code = code.replace(
  "{renderTable('outgoing', outgoingList, handleEditOutgoing, handleDeleteOutgoing, false)}",
  "{renderTable('outgoing', outgoingList, handleEditOutgoing, handleDeleteOutgoing, editOutgoingForm, setEditOutgoingForm, handleSaveInlineOutgoing, handleCancelInlineOutgoing, editingOutgoingId, false)}"
);

// 9. Remove conditional text in submit button and form header
code = code.replace(/\{isEditing \? 'Update' : 'Add Row'\}/g, "'Add Row'");
code = code.replace(/\{isEditing \? \`Edit \$\{title\}\` : \`Add \$\{title\}\`\}/g, "`Add ${title}`");

fs.writeFileSync('src/pages/ItemTransfer.jsx', code);
console.log('ItemTransfer updated successfully.');
