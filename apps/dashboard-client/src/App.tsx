import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Settings } from './pages/Settings';
import { TestCases } from './pages/TestCases';
import { TestCycles } from './pages/TestCycles';
import { CycleReportPage } from './pages/CycleReportPage';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { useOrganizationFeatures } from './hooks/useOrganizationFeatures';

function FeatureGatedRoute({
  featureKey,
  children,
}: {
  featureKey: 'testCasesEnabled' | 'testCyclesEnabled';
  children: React.ReactNode;
}) {
  const { features, isLoading } = useOrganizationFeatures();
  if (isLoading) return null; // avoid flash-redirect while loading
  if (!features[featureKey]) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen bg-gh-bg-subtle dark:bg-gh-bg-dark text-gh-text dark:text-gh-text-dark font-sans antialiased transition-colors duration-200">
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/join" element={<Signup />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />

                {/* Protected routes — share the AppLayout shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/test-cases" element={
                    <FeatureGatedRoute featureKey="testCasesEnabled">
                      <TestCases />
                    </FeatureGatedRoute>
                  } />
                  <Route path="/test-cycles" element={
                    <FeatureGatedRoute featureKey="testCyclesEnabled">
                      <TestCycles />
                    </FeatureGatedRoute>
                  } />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                {/* Standalone protected routes — no AppLayout shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <div className="min-h-screen bg-[#0d1117]"><Outlet /></div>
                    </ProtectedRoute>
                  }
                >
                  <Route path="/test-cycles/:id/report" element={
                    <FeatureGatedRoute featureKey="testCyclesEnabled">
                      <CycleReportPage />
                    </FeatureGatedRoute>
                  } />
                </Route>

                {/* Redirect root to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
