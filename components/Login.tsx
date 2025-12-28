
import React from 'react';
import { auth } from '../services/auth';
import { Tent, ArrowRight, Lock, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate network delay for UX
    setTimeout(async () => {
      const result = await auth.login(username, password);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message || '登入失敗');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#fbf8e6] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
          backgroundImage: 'radial-gradient(#78b833 1px, transparent 1px)',
          backgroundSize: '40px 40px'
      }} />

      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border-4 border-[#e8dcb9] relative z-10 animate-pop">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-[#78b833] rounded-full mx-auto mb-4 border-4 border-white shadow-lg flex items-center justify-center text-white text-4xl">
            <Tent size={48} />
          </div>
          <h1 className="text-2xl font-black text-[#5d4a36]">清潔小村 ERP</h1>
          <p className="text-[#b59a7a] font-bold text-sm mt-1">Authorized Personnel Only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" size={20} />
              <input 
                type="text" 
                placeholder="帳號" 
                className="input-nook pl-12 py-4 text-lg bg-[#fffdf5]"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d6cbb6]" size={20} />
              <input 
                type="password" 
                placeholder="密碼" 
                className="input-nook pl-12 py-4 text-lg bg-[#fffdf5]"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm font-bold text-center bg-red-50 p-2 rounded-xl animate-bounce">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-primary py-4 rounded-2xl text-xl shadow-lg mt-4 flex justify-center"
          >
            {loading ? '驗證中...' : <span className="flex items-center gap-2">進入系統 <ArrowRight size={20}/></span>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-300 font-bold">Security Level 0: Audit Logging Enabled</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
