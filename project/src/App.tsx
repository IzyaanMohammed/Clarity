import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { AskAI } from './pages/AskAI';
import { Practice } from './pages/Practice';
import { Library } from './pages/Library';
import { getUser } from './utils/storage';
import { ThemeProvider } from './contexts/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!user) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Toaster position="top-center" />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/ask" 
            element={
              <ProtectedRoute>
                <AskAI />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/library" 
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <AskAI />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/practice" 
            element={
              <ProtectedRoute>
                <Practice />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/progress" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Onboarding /> 
              </ProtectedRoute>
            } 
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
