
import React from 'react';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { AuditLog } from '../types';
import { Search, Filter, ChevronDown, ChevronRight, Activity, Download, Loader2 } from 'lucide-react';

const Changelog: React.FC = () => {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = React.useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [moduleFilter, setModuleFilter] = React.useState<string>('ALL');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const all = await db.audit.getAll();
      setLogs(all);
      setFilteredLogs(all);
      setLoading(false);
    };
    loadData();
  }, []);

  React.useEffect(() => {
    let res = logs;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      res = res.filter(l => 
        l.summary.toLowerCase().includes(lower) || 
        l.actor.name.toLowerCase().includes(lower) ||
        l.target.entityName?.toLowerCase().includes(lower) ||
        (l.target.entityId && l.target.entityId.toLowerCase().includes(lower))
      );
    }
    if (moduleFilter !== 'ALL') {
      res = res.filter(l => l.module === moduleFilter);
    }
    setFilteredLogs(res);
  }, [searchTerm, moduleFilter, logs]);

  const exportCSV = () => {
    const header = "Time,Actor,Role,Module,Action,TargetID,TargetName,Summary\n";
    const rows = filteredLogs.map(l => 
      `${l.createdAt},${l.actor.name},${l.actor.role},${l.module},${l.action},${l.target.entityId},${l.target.entityName},"${l.summary}"`
    ).join("\n");
    
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AuditLog_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      console.warn("Circular structure in changelog", e);
      // Fallback: try to just show keys or a simple message
      return `[Complex Data - Circular Reference Detected]\nKeys: ${Object.keys(obj || {}).join(', ')}`;
    }
  };

  const renderDiff = (diff: any) => {
    if (!diff) return <div className="text-xs text-slate-400 italic">No detailed changes recorded.</div>;
    return (
      <div className="mt-2 bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-700">
        <div className="flex gap-4 min-w-max">
          <div className="flex-1 min-w-[300px]">
            <div className="text-red-400 font-bold mb-2 text-xs uppercase tracking-wider border-b border-red-900/50 pb-1">Before</div>
            <pre className="text-xs text-red-200 font-mono leading-relaxed whitespace-pre-wrap">
              {diff.before ? safeStringify(diff.before) : 'null'}
            </pre>
          </div>
          <div className="w-px bg-slate-700"></div>
          <div className="flex-1 min-w-[300px]">
             <div className="text-green-400 font-bold mb-2 text-xs uppercase tracking-wider border-b border-green-900/50 pb-1">After</div>
             <pre className="text-xs text-green-200 font-mono leading-relaxed whitespace-pre-wrap">
               {diff.after ? safeStringify(diff.after) : 'null'}
             </pre>
          </div>
        </div>
      </div>
    );
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-green-600 bg-green-50 border-green-200';
      case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
      case 'LOGIN': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'LOGOUT': return 'text-slate-600 bg-slate-100 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  if (loading) {
    return <div className="p-20 text-center"><Loader2 size={30} className="animate-spin mx-auto text-[#b59a7a]"/></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-pop">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-h1 flex items-center gap-3">
            <Activity className="text-[#78b833]" size={32}/> 系統變更紀錄
          </h2>
          <p className="text-note font-bold mt-1 ml-1">Audit Trail & Security Logs</p>
        </div>
        {auth.isAdmin() && (
          <button onClick={exportCSV} className="bg-white border-2 border-[#e8dcb9] text-[#5d4a36] px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#fffdf5]">
            <Download size={18}/> 匯出 CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border-2 border-[#e8dcb9] flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            className="input-nook pl-10 py-2 text-sm" 
            placeholder="搜尋摘要、操作者、目標 ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {['ALL', 'CUSTOMER', 'JOB', 'EXPENSE', 'SETTINGS', 'AUTH'].map(m => (
            <button 
              key={m}
              onClick={() => setModuleFilter(m)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border-2 ${moduleFilter === m ? 'bg-[#78b833] text-white border-[#78b833]' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
            >
              {m === 'ALL' ? '全部' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div className="bg-white rounded-[2rem] border-2 border-[#e8dcb9] overflow-hidden shadow-sm min-h-[500px]">
        {filteredLogs.length === 0 ? (
          <div className="p-20 text-center text-slate-300 font-bold">查無紀錄</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="group">
                <div 
                  className="p-4 flex items-center gap-4 hover:bg-[#fbf8e6] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="w-8 flex justify-center text-slate-300">
                    {expandedId === log.id ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-black ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-bold text-slate-400 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                      <span className="text-xs font-bold text-[#5d4a36] bg-slate-100 px-2 py-0.5 rounded">
                        {log.actor.name} ({log.actor.role})
                      </span>
                    </div>
                    <div className="font-bold text-[#5d4a36] truncate">{log.summary}</div>
                  </div>
                </div>
                
                {expandedId === log.id && (
                  <div className="px-4 md:px-16 pb-6 bg-[#fbf8e6] animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-xs text-slate-500 font-mono pt-2">
                       <div>Log ID: {log.id}</div>
                       <div>Target: {log.target.entityType} / {log.target.entityId}</div>
                    </div>
                    {renderDiff(log.diff)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Changelog;
