
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
import TodayMission from './components/TodayMission'; 
import { Customer, Job, AppView } from './types';
import { auth } from './services/auth';
import { AlertTriangle } from 'lucide-react';

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
  // [MODIFIED] Default view is now 'today_mission'
  const [activeView, setActiveView] = React.useState<AppView>('today_mission'); 
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | undefined>();
  const [selectedJob, setSelectedJob] = React.useState<Job | undefined>();
  
  // State for the "Quick Add Customer" modal flow
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
  const [quickAddPhone, setQuickAddPhone] = React.useState('');

  React.useEffect(() => {
    auth.init((user) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  // [DEBUG] Monitor View Changes
  React.useEffect(() => {
    console.log(`[App] Current View Changed to: "${activeView}"`);
  }, [activeView]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // [MODIFIED] Redirect to 'today_mission' after login
    setActiveView('today_mission'); 
  };

  const handleNavigate = (view: AppView) => {
    console.log('[App] Navigating to:', view);
    setActiveView(view);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const user = auth.getCurrentUser();
  if (user?.role === 'DECOY') {
    return <DecoyView />;
  }

  const renderContent = () => {
    console.log('[App] Rendering Content Switch:', activeView);

    switch (activeView) {
      case 'dashboard': // Village Map
        return <Dashboard />;
        
      case 'today_mission': // RPG Flow
        return (
          <TodayMission 
            onStartJob={(job, customer) => {
               console.log('[App] TodayMission started job:', job.jobId);
               setSelectedJob(job);
               setSelectedCustomer(customer);
               handleNavigate('job_edit'); 
            }}
          />
        );
        
      case 'boss_dashboard': // Stats
        return <BossDashboard />;
        
      case 'analysis':
        return <AnalysisWorkspace />;
        
      case 'changelog':
        return <Changelog />;
        
      case 'customers':
        return (
          <CustomerList 
            onAdd={() => handleNavigate('customer_add')} 
            onEdit={(c) => {
              setSelectedCustomer(c);
              handleNavigate('customer_edit');
            }}
          />
        );
        
      case 'customer_add':
        return (
          <CustomerForm 
            onCancel={() => handleNavigate('customers')} 
            onSave={() => handleNavigate('customers')} 
          />
        );
        
      case 'customer_edit':
        return (
          <CustomerForm 
            initialData={selectedCustomer}
            onCancel={() => {
              setSelectedCustomer(undefined);
              handleNavigate('customers');
            }} 
            onSave={() => {
              setSelectedCustomer(undefined);
              handleNavigate('customers');
            }} 
          />
        );
        
      case 'jobs':
        return (
          <JobList 
            onAdd={() => handleNavigate('job_add')}
            onView={(job) => {
              setSelectedJob(job);
              handleNavigate('job_view');
            }}
            onEdit={(job) => {
              setSelectedJob(job);
              handleNavigate('job_edit');
            }}
          />
        );
        
      case 'job_view':
        return selectedJob ? (
          <JobDetail 
            job={selectedJob} 
            onBack={() => {
              setSelectedJob(undefined);
              handleNavigate('jobs');
            }}
            onEdit={() => handleNavigate('job_edit')}
          />
        ) : <Dashboard />;
        
      case 'job_add':
      case 'job_edit':
        return (
          <JobManagement 
            initialJob={activeView === 'job_edit' ? selectedJob : undefined}
            initialCustomer={activeView === 'job_add' ? selectedCustomer : undefined}
            onCancel={() => {
              if (activeView === 'job_edit') {
                handleNavigate('job_view'); 
              } else {
                setSelectedJob(undefined);
                setSelectedCustomer(undefined);
                handleNavigate('dashboard');
              }
            }}
            onSave={(savedJob) => {
              setSelectedJob(savedJob);
              handleNavigate('job_view');
            }}
          />
        );
        
      case 'import':
        return <ImportCenter />;
        
      default:
        console.warn('[App] UNKNOWN VIEW KEY encountered:', activeView);
        // Changed fallback to be distinct from BossDashboard to debug routing errors
        return (
            <div className="p-20 text-center flex flex-col items-center">
                <h2 className="text-3xl font-black text-red-500 mb-4">404 - 迷路了？</h2>
                <p className="text-slate-400 font-bold mb-8">找不到頁面: {activeView}</p>
                <button onClick={() => handleNavigate('dashboard')} className="btn-primary">回到村莊地圖</button>
            </div>
        );
    }
  };

  return (
    <Layout activeView={activeView} onNavigate={handleNavigate}>
      {renderContent()}
      
      {isQuickAddModalOpen && (
        <CustomerForm 
          mode="modal"
          initialData={{ phones: [{ number: quickAddPhone, type: '手機', isPrimary: true, label: '主要' }] }}
          onCancel={() => setIsQuickAddModalOpen(false)}
          onSave={(newCustomer) => {
            setIsQuickAddModalOpen(false);
            setSelectedCustomer(newCustomer);
            handleNavigate('job_add');
          }}
        />
      )}
    </Layout>
  );
};

export default App;
