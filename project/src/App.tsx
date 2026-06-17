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
import { Landing } from './pages/Landing';
import { ExamSimulator } from './pages/ExamSimulator';
import { ParentPortal } from './pages/ParentPortal';
import { Subscription } from './pages/Subscription';
import { Login } from './pages/Login';
import { AITutor } from './pages/AITutor';
import { ActiveRecall } from './pages/ActiveRecall';
import { Leaderboard } from './pages/Leaderboard';
import { AnswerChecker } from './pages/AnswerChecker';
import { Dump } from './pages/Dump';
import { getMaterialsFromDatabase, getMyProfile, getUserSnapshot } from './api';
import { clearAuthToken, clearUser, getAuthToken, getUser, hydrateLocalStateFromSnapshot, saveUser, type StudyMaterialItem } from './utils/storage';
import { ThemeProvider } from './contexts/ThemeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const token = getAuthToken();
  if (!user || !token) {
    return <Navigate to="/login" replace />;
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
        const profile = await getMyProfile();
        saveUser(profile);

        // Snapshot/material sync is best-effort and should never log users out.
        const [snapshotResult, materialsResult] = await Promise.allSettled([
          getUserSnapshot(),
          getMaterialsFromDatabase(),
        ]);

        const snapshotPayload =
          snapshotResult.status === 'fulfilled' ? (snapshotResult.value.payload || {}) : {};
        const serverMaterials =
          materialsResult.status === 'fulfilled'
            ? ((materialsResult.value.materials || []) as StudyMaterialItem[])
            : [];

        hydrateLocalStateFromSnapshot(snapshotPayload, serverMaterials);
      } catch (error: any) {
        const status = error?.response?.status;
        // Only clear auth on real auth failures.
        if (status === 401 || status === 403) {
          clearUser();
          clearAuthToken();
        }
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
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            
            <Route
              path="/dump"
              element={
                <ProtectedRoute>
                  <Dump />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
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
              path="/answer-checker"
              element={
                <ProtectedRoute>
                  <AnswerChecker />
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
                  <AITutor initialTab="planner" />
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
              path="/ai-tutor"
              element={
                <ProtectedRoute>
                  <AITutor initialTab="chat" />
                </ProtectedRoute>
              }
            />

            <Route
              path="/active-recall"
              element={
                <ProtectedRoute>
                  <ActiveRecall />
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

            <Route
              path="/exam-simulator"
              element={
                <ProtectedRoute>
                  <ExamSimulator />
                </ProtectedRoute>
              }
            />

            <Route
              path="/parent-portal"
              element={<ParentPortal />}
            />

            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SessionHydrator>
      </Router>
    </ThemeProvider>
  );
}

export default App;
