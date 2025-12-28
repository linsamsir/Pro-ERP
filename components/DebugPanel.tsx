
import React from 'react';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { X, RefreshCw, Database } from 'lucide-react';

const DebugPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [stats, setStats] = React.useState<any>({});
  const [loading, setLoading] = React.useState(false);

  const runCheck = async () => {
    setLoading(true);
    const s: any = {};
    try {
      const c = await db.customers.list();
      s.customers = c.length;
      
      const j = await db.jobs.list();
      s.jobs = j.length;
      
      const e = await db.expenses.list();
      s.expenses = e.length;
      
      s.user = auth.getCurrentUser()?.role || 'Guest';
      s.canWrite = auth.canWrite();
    } catch (err: any) {
      s.error = err.message;
    }
    setStats(s);
    setLoading(false);
  };

  React.useEffect(() => { runCheck(); }, []);

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-slate-900 text-green-400 p-6 z-[999] font-mono text-sm shadow-2xl overflow-y-auto">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-700">
        <h3 className="font-bold flex items-center gap-2"><Database size={16}/> System Debug</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X/></button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-slate-500 mb-1">User Role</div>
          <div className="text-white font-bold">{stats.user} {stats.canWrite ? '(Write)' : '(Read-Only)'}</div>
        </div>

        <div>
          <div className="text-slate-500 mb-1">Data Counts (Raw Fetch)</div>
          {loading ? <div>Scanning...</div> : (
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Customers:</span> <span className="text-white">{stats.customers}</span></li>
              <li className="flex justify-between"><span>Jobs:</span> <span className="text-white">{stats.jobs}</span></li>
              <li className="flex justify-between"><span>Expenses:</span> <span className="text-white">{stats.expenses}</span></li>
            </ul>
          )}
        </div>

        {stats.error && (
          <div className="bg-red-900/50 p-3 rounded border border-red-500 text-red-200">
            Error: {stats.error}
          </div>
        )}

        <button onClick={runCheck} className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-white flex items-center justify-center gap-2">
          <RefreshCw size={14}/> Re-Scan DB
        </button>
      </div>
    </div>
  );
};

export default DebugPanel;
