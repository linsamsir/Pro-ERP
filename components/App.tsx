
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
import { Customer, Job } from './types';
import { auth } from './services/auth';
import { AlertTriangle, Loader2 } from 'lucide-react';

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
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeView, setActiveView] = React.useState<View>('boss_dashboard'); 
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | undefined>();
  const [selectedJob, setSelectedJob] = React.useState<Job | undefined>();
  
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
  const [quickAddPhone, setQuickAddPhone] = React.useState('');

  React.useEffect(() => {
    auth.init((user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
      // If user logs in and is STAFF, maybe redirect to Dashboard instead of Boss Dashboard?
      if (user && user.role === 'STAFF') setActiveView('dashboard');
    });
  }, []);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-[#fbf8e6] text-[#5d4a36]"><Loader2 size={40} className="animate-spin"/></div>;
  }

  const handleLoginSuccess = () => {
    // Auth init listener handles state
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const user = auth.getCurrentUser();
  if (user?.role === 'DECOY') {
    return <DecoyView />;
  }

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
        return <BossDashboard />;
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
        return <BossDashboard />;
    }
  };

  return (
    <Layout activeView={activeView} onNavigate={(v) => setActiveView(v as View)}>
      {renderContent()}
      
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
