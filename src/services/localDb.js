// Browser LocalStorage database service
// Replaces Supabase database integration completely.
// All table CRUD operations (save, edit, delete, fetch) run locally without any backend/table dependencies.

const STORAGE_PREFIX = 'nspl_table_'

export const getStorageTable = (tableName) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tableName)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error(`[LocalStorage] Error reading table '${tableName}':`, err)
    return []
  }
}

export const setStorageTable = (tableName, rows) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + tableName, JSON.stringify(rows))
  } catch (err) {
    console.error(`[LocalStorage] Error writing table '${tableName}':`, err)
  }
}

// Generates unique client-side id
export const generateId = () => {
  return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Query helper to keep code minimal, reliable and synchronous/asynchronous friendly
export const localDb = {
  // Fetch rows
  select: (tableName, filterFn) => {
    const items = getStorageTable(tableName)
    if (typeof filterFn === 'function') {
      return items.filter(filterFn)
    }
    return items
  },

  // Insert single or multiple rows
  insert: (tableName, payload) => {
    const items = getStorageTable(tableName)
    const records = Array.isArray(payload) ? payload : [payload]
    const created = records.map((record) => ({
      id: record.id || generateId(),
      created_at: record.created_at || new Date().toISOString(),
      ...record,
    }))
    const updatedList = [...items, ...created]
    setStorageTable(tableName, updatedList)
    return created
  },

  // Update rows by ID or filter
  update: (tableName, idOrFilter, updates) => {
    const items = getStorageTable(tableName)
    const isFn = typeof idOrFilter === 'function'
    const updatedList = items.map((item) => {
      const match = isFn ? idOrFilter(item) : String(item.id) === String(idOrFilter)
      return match ? { ...item, ...updates } : item
    })
    setStorageTable(tableName, updatedList)
    return updatedList
  },

  // Delete row(s)
  delete: (tableName, idOrFilter) => {
    const items = getStorageTable(tableName)
    const isFn = typeof idOrFilter === 'function'
    const remaining = items.filter((item) => {
      const match = isFn ? idOrFilter(item) : String(item.id) === String(idOrFilter)
      return !match
    })
    setStorageTable(tableName, remaining)
    return remaining
  },
}
