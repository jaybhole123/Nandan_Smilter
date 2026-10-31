import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': 'Stock Management',
  '/transfer': 'Incoming & Outgoing',
  '/production': 'Production',
  '/production2': 'Production',
  '/sauda-scale': 'Sauda Sale',
  '/sauda-sale': 'Sauda Sale',
  '/sauda-Sale': 'Sauda Sale',
  '/sauda-purchase': 'Sauda Purchase',
  '/mis-report': 'MIS Report',
}

const Navbar = ({ onMenuToggle }) => {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Trading Management'

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10 print:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Module</p>
          <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">User</span>
          <span className="text-sm font-medium text-slate-800">Trading Admin</span>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all">
          <span className="text-slate-500">Live</span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
        </button>
      </div>
    </header>
  )
}

export default Navbar