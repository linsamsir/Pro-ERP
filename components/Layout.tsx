
import React from 'react';
import { Home, Users, ClipboardList, Database, Menu, X, Tent, Crown, PieChart } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: '村莊地圖', icon: Home, color: 'text-orange-500' },
    { id: 'boss_dashboard', label: '老闆戰情', icon: Crown, color: 'text-yellow-500' },
    { id: 'analysis', label: '進階分析', icon: PieChart, color: 'text-indigo-500' }, // New L2 Entry Point
    { id: 'customers', label: '村民名冊', icon: Users, color: 'text-blue-500' },
    { id: 'jobs', label: '村莊任務', icon: ClipboardList, color: 'text-green-600' },
    { id: 'import', label: '移居中心', icon: Tent, color: 'text-purple-500' },
  ];

  const isActive = (id: string) => {
    if (activeView === id) return true;
    if (id === 'customers' && activeView.startsWith('customer')) return true;
    if (id === 'jobs' && activeView.startsWith('job')) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-[#78b833] text-white p-4 flex justify-between items-center z-50 sticky top-0 border-b-4 border-[#5a8d26]">
        <span className="font-black text-xl flex items-center gap-2"><Tent size={24} /> Cleaning Village</span>
        <button onClick={() => setMenuOpen(!menuOpen)}><Menu size={28} /></button>
      </div>

      {/* Sidebar / NookPhone Menu */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#f2edd4] border-r-4 border-[#e6e0c6] transform transition-transform duration-300 md:relative md:translate-x-0
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 h-full flex flex-col">
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-[#78b833] rounded-full mx-auto mb-4 border-4 border-white shadow-lg flex items-center justify-center text-white">
              <Tent size={40} />
            </div>
            <h1 className="text-[#5d4a36] text-2xl font-black">清潔小村</h1>
            <p className="text-[#b59a7a] text-xs font-bold mt-1 uppercase tracking-widest">Village Manager</p>
          </div>
          
          <nav className="space-y-4 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.5rem] transition-all font-black text-lg group ${
                  isActive(item.id)
                    ? 'bg-white border-4 border-[#78b833] text-[#5d4a36] shadow-sm' 
                    : 'text-[#9c826b] hover:bg-[#fffdf5] hover:text-[#5d4a36]'
                }`}
              >
                <item.icon size={24} className={`transition-transform group-hover:scale-110 ${isActive(item.id) ? item.color : 'text-[#d6cbb6]'}`} strokeWidth={3} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t-2 border-[#e6e0c6] text-center">
            <p className="text-[10px] text-[#b59a7a] font-bold">今天是個打掃的好日子！</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-50" style={{
          backgroundImage: 'radial-gradient(#78b833 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        <div className={`relative z-10 mx-auto ${activeView === 'analysis' ? 'h-full p-0' : 'p-4 md:p-10 max-w-7xl'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
