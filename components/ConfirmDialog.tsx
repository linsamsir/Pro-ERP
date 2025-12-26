
import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, title, message, onConfirm, onCancel, 
  confirmText = '確認', cancelText = '取消', isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-pop">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border-4 border-[#e8dcb9]">
        <h3 className="text-xl font-black text-[#5d4a36] mb-2">{title}</h3>
        <p className="text-[#b59a7a] font-bold mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-sm transition-transform active:scale-95 ${isDanger ? 'bg-red-400 hover:bg-red-500' : 'bg-[#78b833] hover:bg-[#5a8d26]'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
