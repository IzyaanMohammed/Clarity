import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { AskAI } from './pages/AskAI';
import { Practice } from './pages/Practice';
import { Library } from './pages/Library';
import { Summary } from './pages/Summary';
import { TextbookHub } from './pages/TextbookHub';
import { Flashcards } from './pages/Flashcards';
import { StudyPlan } from './pages/StudyPlan';
import { Bookmarks } from './pages/Bookmarks';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Studio } from './pages/Studio';
import { OCR } from './pages/OCR';
import { StudyMaterials } from './pages/StudyMaterials';
import { Progress } from './pages/Progress';
import { getMaterialsFromDatabase, getMyProfile, getUserSnapshot } from './api';
import { clearAuthToken, clearUser, getAuthToken, getUser, hydrateLocalStateFromSnapshot, saveUser, type StudyMaterialItem } from './utils/storage';
import { ThemeProvider } from './contexts/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const token = getAuthToken();
  if (!user || !token) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function SessionHydrator({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const run = async () => {
      const token = getAuthToken();
      if (!token) {
        setHydrated(true);
        return;
      }

      try {
        const [profile, snapshotResp, materialsResp] = await Promise.all([
          getMyProfile(),
          getUserSnapshot(),
          getMaterialsFromDatabase(),
        ]);

        saveUser(profile);
        const serverMaterials = (materialsResp.materials || []) as StudyMaterialItem[];
        hydrateLocalStateFromSnapshot(snapshotResp.payload || {}, serverMaterials);
      } catch {
        clearUser();
        clearAuthToken();
      } finally {
        setHydrated(true);
      }
    };

    run();
  }, []);

  if (!hydrated) {
    return null;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <SessionHydrator>
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
              path="/textbook-hub"
              element={
                <ProtectedRoute>
                  <TextbookHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reader"
              element={
                <ProtectedRoute>
                  <Navigate to="/textbook-hub" replace />
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
              path="/summary"
              element={
                <ProtectedRoute>
                  <Summary />
                </ProtectedRoute>
              }
            />

            <Route
              path="/flashcards"
              element={
                <ProtectedRoute>
                  <Flashcards />
                </ProtectedRoute>
              }
            />

            <Route
              path="/plan"
              element={
                <ProtectedRoute>
                  <StudyPlan />
                </ProtectedRoute>
              }
            />

            <Route
              path="/bookmarks"
              element={
                <ProtectedRoute>
                  <Bookmarks />
                </ProtectedRoute>
              }
            />

            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/studio"
              element={
                <ProtectedRoute>
                  <Studio />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ocr"
              element={
                <ProtectedRoute>
                  <OCR />
                </ProtectedRoute>
              }
            />

            <Route
              path="/materials"
              element={
                <ProtectedRoute>
                  <StudyMaterials />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SessionHydrator>
      </Router>
    </ThemeProvider>
  );
}

export default App;
