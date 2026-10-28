import React from 'react';

const DateFilter = ({ date, onChange }) => {
  const currentDate = date || new Date().toISOString().split('T')[0];

  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    onChange(d.toISOString().split('T')[0]);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    onChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onChange(new Date().toISOString().split('T')[0]);
  };

  const handleDateChange = (e) => {
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isToday = currentDate === new Date().toISOString().split('T')[0];

  return (
    <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm h-10 w-fit">
      {/* Navigation Group */}
      <div className="flex items-center h-full">
        <button
          onClick={handlePrev}
          className="px-3 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-r border-slate-200"
          title="Previous Day"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        
        <button
          onClick={handleToday}
          className={`px-4 h-full text-sm font-medium transition-colors border-r border-slate-200 ${isToday ? 'bg-slate-100 text-slate-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Today
        </button>
        
        <button
          onClick={handleNext}
          className="px-3 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border-r border-slate-200"
          title="Next Day"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <div className="h-6 w-px bg-slate-300 mx-1"></div>

      {/* Date Picker Group */}
      <div className="relative flex items-center px-3 h-full">
        <div className="flex items-center text-slate-700 pointer-events-none">
          <svg className="w-4 h-4 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium whitespace-nowrap">{formatDate(currentDate)}</span>
        </div>
        <input
          type="date"
          value={currentDate}
          onChange={handleDateChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};

export default DateFilter;
