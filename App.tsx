
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

type View = 'dashboard' | 'boss_dashboard' | 'analysis' | 'customers' | 'customer_add' | 'customer_edit' | 'jobs' | 'job_add' | 'job_edit' | 'job_view' | 'import' | 'changelog';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(auth.isAuthenticated());
  const [activeView, setActiveView] = React.useState<View>('boss_dashboard'); // Default to Boss Dashboard after login
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | undefined>();
  const [selectedJob, setSelectedJob] = React.useState<Job | undefined>();
  
  // State for the "Quick Add Customer" modal flow
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
  const [quickAddPhone, setQuickAddPhone] = React.useState('');

  React.useEffect(() => {
    // Check auth on mount
    setIsAuthenticated(auth.isAuthenticated());
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveView('boss_dashboard');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
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
