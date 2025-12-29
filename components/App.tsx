
import React from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CustomerList from './components/CustomerList';
import CustomerForm from './components/CustomerForm';
import ImportCenter from './components/ImportCenter';
import JobManagement from './components/JobManagement';
import JobList from './components/JobList';
import JobDetail from './components/JobDetail';
import BossDashboard from './components/BossDashboard';
import AnalysisWorkspace from './components/AnalysisWorkspace';
import Login from './components/Login';
import Changelog from './components/Changelog';
import CustomerDetailModal from './components/CustomerDetailModal';
import { Customer, Job } from './types';
import { auth } from './services/auth';
import { db } from './services/db';
import { AlertTriangle } from 'lucide-react';

type View = 'dashboard' | 'boss_dashboard' | 'analysis' | 'customers' | 'customer_add' | 'customer_edit' | 'jobs' | 'job_add' | 'job_edit' | 'job_view' | 'import' | 'changelog';

// --- Decoy View for Admin ---
const DecoyView = () => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500 p-8">
    <AlertTriangle size={64} className="mb-4 text-slate-700"/>
    <h1 className="text-2xl font-bold mb-2">System Maintenance</h1>
    <p>The system is currently in read-only maintenance mode.</p>
    <p>Please contact the system administrator.</p>
    <button onClick={() => auth.logout()} className="mt-8 text-sm hover:text-slate-300">Logout</button>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(auth.isAuthenticated());
  const [activeView, setActiveView] = React.useState<View>('boss_dashboard'); // Default to Boss Dashboard after login
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | undefined>();
  const [selectedJob, setSelectedJob] = React.useState<Job | undefined>();
  
  // State for the "Quick Add Customer" modal flow
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
  const [quickAddPhone, setQuickAddPhone] = React.useState('');

  // State for Customer Detail Modal
  const [viewingCustomer, setViewingCustomer] = React.useState<Customer | null>(null);

  React.useEffect(() => {
    // Check auth on mount
    auth.init((user) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveView('boss_dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Handle Decoy
  const user = auth.getCurrentUser();
  if (user?.role === 'DECOY') {
    return <DecoyView />;
  }

  // Robust Handler for Viewing Customer
  const handleViewCustomer = async (input: string | Customer) => {
    console.log('[TRACE][App] handleViewCustomer called', input);

    if (!input) {
        console.error('[TRACE][App] Abort: input is null/undefined');
        return;
    }

    if (typeof input === 'object') {
        console.log('[TRACE][App] Setting viewingCustomer (Object)', input.customer_id);
        setViewingCustomer(input);
        return;
    }
    
    // It's a string ID
    console.log('[TRACE][App] Fetching customer by ID', input);
    try {
        const c = await db.customers.get(input);
        if (c) {
          console.log('[TRACE][App] Fetched and setting', c.customer_id);
          setViewingCustomer(c);
        } else {
          console.error('[TRACE][App] Customer not found for ID', input);
          alert("找不到該村民資料");
        }
    } catch (e) {
        console.error(e);
        alert("讀取村民資料發生錯誤");
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            onStartReport={(customer) => {
              setSelectedCustomer(customer);
              setActiveView('job_add');
            }}
            onAddCustomer={(phone) => {
              setQuickAddPhone(phone);
              setIsQuickAddModalOpen(true);
            }}
          />
        );
      case 'boss_dashboard':
        return <BossDashboard onNavigate={(view) => setActiveView(view as View)} />;
      case 'analysis':
        return <AnalysisWorkspace />;
      case 'changelog':
        return <Changelog />;
      case 'customers':
        return (
          <CustomerList 
            onAdd={() => setActiveView('customer_add')} 
            onEdit={(c) => {
              setSelectedCustomer(c);
              setActiveView('customer_edit');
            }}
            onViewCustomer={handleViewCustomer}
          />
        );
      case 'customer_add':
        return (
          <CustomerForm 
            onCancel={() => setActiveView('customers')} 
            onSave={() => setActiveView('customers')} 
          />
        );
      case 'customer_edit':
        return (
          <CustomerForm 
            initialData={selectedCustomer}
            onCancel={() => {
              setSelectedCustomer(undefined);
              setActiveView('customers');
            }} 
            onSave={() => {
              setSelectedCustomer(undefined);
              setActiveView('customers');
            }} 
          />
        );
      case 'jobs':
        return (
          <JobList 
            onAdd={() => setActiveView('job_add')}
            onView={(job) => {
              setSelectedJob(job);
              setActiveView('job_view');
            }}
            onEdit={(job) => {
              setSelectedJob(job);
              setActiveView('job_edit');
            }}
            onViewCustomer={handleViewCustomer}
          />
        );
      case 'job_view':
        return selectedJob ? (
          <JobDetail 
            job={selectedJob} 
            onBack={() => {
              setSelectedJob(undefined);
              setActiveView('jobs');
            }}
            onEdit={() => setActiveView('job_edit')}
            onViewCustomer={handleViewCustomer}
          />
        ) : <Dashboard 
            onStartReport={(c) => { setSelectedCustomer(c); setActiveView('job_add'); }} 
            onAddCustomer={(p) => { setQuickAddPhone(p); setIsQuickAddModalOpen(true); }}
          />;
      case 'job_add':
      case 'job_edit':
        return (
          <JobManagement 
            initialJob={activeView === 'job_edit' ? selectedJob : undefined}
            initialCustomer={activeView === 'job_add' ? selectedCustomer : undefined}
            onCancel={() => {
              if (activeView === 'job_edit') {
                setActiveView('job_view');
              } else {
                setSelectedJob(undefined);
                setSelectedCustomer(undefined);
                setActiveView('dashboard');
              }
            }}
            onSave={(savedJob) => {
              setSelectedJob(savedJob);
              setActiveView('job_view');
            }}
          />
        );
      case 'import':
        return <ImportCenter />;
      default:
        return <BossDashboard onNavigate={(view) => setActiveView(view as View)} />;
    }
  };

  return (
    <Layout activeView={activeView} onNavigate={(v) => setActiveView(v as View)}>
      {renderContent()}
      
      {/* Global Customer Detail Modal */}
      {viewingCustomer && (
        <CustomerDetailModal 
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onEdit={(c) => {
            setViewingCustomer(null);
            setSelectedCustomer(c);
            setActiveView('customer_edit');
          }}
          onDelete={async (id) => {
            if(confirm("確定刪除此村民？")) {
                await db.customers.delete(id);
                setViewingCustomer(null);
            }
          }}
        />
      )}

      {/* Floating Modal for Quick Customer Add */}
      {isQuickAddModalOpen && (
        <CustomerForm 
          mode="modal"
          initialData={{ phones: [{ number: quickAddPhone, type: '手機', isPrimary: true, label: '主要' }] }}
          onCancel={() => setIsQuickAddModalOpen(false)}
          onSave={(newCustomer) => {
            setIsQuickAddModalOpen(false);
            setSelectedCustomer(newCustomer);
            setActiveView('job_add');
          }}
        />
      )}
    </Layout>
  );
};

export default App;
