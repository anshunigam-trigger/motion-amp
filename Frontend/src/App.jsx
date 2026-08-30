import { useState, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import DashboardPage from './components/DashboardPage';
import AnalysisPage from './components/AnalysisPage';

export default function App() {
  const [page, setPage] = useState('landing');

  const navigate = useCallback((dest) => {
    setPage(dest);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (page === 'dashboard') {
    return <DashboardPage onNavigate={navigate} />;
  }

  if (page === 'analysis') {
    return <AnalysisPage onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} />;
}
