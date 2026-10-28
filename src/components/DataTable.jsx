export const DataTable = ({ columns, data, sortField, sortDirection, onSort, renderRow }) => {
  const directionIcon = (field) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="data-table min-w-[720px] w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 uppercase tracking-[0.1em] text-[11px] border-b border-slate-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.accessor}
                className={`px-4 py-3 font-semibold ${column.sortable ? 'cursor-pointer select-none hover:text-slate-900 transition' : ''}`}
                onClick={() => column.sortable && onSort(column.accessor)}
              >
                <div className="inline-flex items-center gap-2">
                  <span>{column.label}</span>
                  {directionIcon(column.accessor) && (
                    <span className="text-xs text-slate-400">{directionIcon(column.accessor)}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {data.map(renderRow)}
        </tbody>
      </table>
    </div>
  )
}