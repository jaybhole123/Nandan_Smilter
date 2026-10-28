// Local storage backed database mock replacing Supabase
// Keeps full compatibility with .from(table).select().insert().update().delete().eq().gte().lte().order()

const STORAGE_PREFIX = 'nspl_db_'

const getTableData = (table) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error(`[db] Error reading table ${table}:`, err)
    return []
  }
}

const setTableData = (table, data) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data))
  } catch (err) {
    console.error(`[db] Error saving table ${table}:`, err)
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table
    this.filters = []
    this.orderings = []
    this.opType = 'select'
    this.payload = null
  }

  select(columns = '*') {
    this.opType = 'select'
    this.columns = columns
    return this
  }

  insert(rows) {
    this.opType = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this.execute()
  }

  update(values) {
    this.opType = 'update'
    this.payload = values
    return this
  }

  delete() {
    this.opType = 'delete'
    return this
  }

  eq(field, value) {
    this.filters.push((row) => String(row[field]) === String(value))
    return this
  }

  gte(field, value) {
    this.filters.push((row) => {
      const rowVal = row[field]
      if (rowVal == null) return false
      return String(rowVal) >= String(value)
    })
    return this
  }

  lte(field, value) {
    this.filters.push((row) => {
      const rowVal = row[field]
      if (rowVal == null) return false
      return String(rowVal) <= String(value)
    })
    return this
  }

  order(field, { ascending = true } = {}) {
    this.orderings.push({ field, ascending })
    return this
  }

  async execute() {
    let rows = getTableData(this.table)

    if (this.opType === 'select') {
      let filtered = rows.filter((row) => this.filters.every((f) => f(row)))
      if (this.orderings.length > 0) {
        filtered.sort((a, b) => {
          for (const ord of this.orderings) {
            const valA = a[ord.field] ?? ''
            const valB = b[ord.field] ?? ''
            if (valA < valB) return ord.ascending ? -1 : 1
            if (valA > valB) return ord.ascending ? 1 : -1
          }
          return 0
        })
      }
      return { data: filtered, error: null }
    }

    if (this.opType === 'insert') {
      const newItems = this.payload.map((item) => ({
        id: item.id || `id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }))
      rows = [...rows, ...newItems]
      setTableData(this.table, rows)
      return { data: newItems, error: null }
    }

    if (this.opType === 'update') {
      let affected = 0
      rows = rows.map((row) => {
        if (this.filters.length === 0 || this.filters.every((f) => f(row))) {
          affected++
          return { ...row, ...this.payload }
        }
        return row
      })
      setTableData(this.table, rows)
      return { data: rows, error: null, count: affected }
    }

    if (this.opType === 'delete') {
      const initialCount = rows.length
      rows = rows.filter((row) => !this.filters.every((f) => f(row)))
      setTableData(this.table, rows)
      return { data: null, error: null, count: initialCount - rows.length }
    }

    return { data: null, error: null }
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected)
  }
}

// Storage mock for file uploads (local in-memory / data URL)
const storage = {
  from: (bucket) => ({
    upload: async (filePath, file) => {
      try {
        const reader = new FileReader()
        const dataUrl = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result)
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        sessionStorage.setItem(`file_${bucket}_${filePath}`, dataUrl)
        return { data: { path: filePath }, error: null }
      } catch (err) {
        return { data: null, error: err }
      }
    },
    getPublicUrl: (filePath) => {
      const stored = sessionStorage.getItem(`file_${bucket}_${filePath}`)
      return {
        data: {
          publicUrl: stored || URL.createObjectURL(new Blob([])),
        },
      }
    },
  }),
}

// Edge functions mock
const functions = {
  invoke: async (functionName, options) => {
    console.warn(`[db functions] Function '${functionName}' called without Supabase backend.`)
    return { data: null, error: new Error('Supabase backend removed. Function not available.') }
  },
}

export const supabase = {
  from: (table) => new QueryBuilder(table),
  storage,
  functions,
}

export default supabase
