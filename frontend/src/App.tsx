import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import HomePage from "./pages/HomePage";
import ApprovalPage from "./pages/ApprovalPage";
import ExpensePage from "./pages/ExpensePage";
import AnalysisPage from "./pages/AnalysisPage";
import MonthSummaryPage from "./pages/MonthSummaryPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#f4f6f9] text-[#212529] font-sans antialiased">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/approval-center" element={<ApprovalPage />} />
              <Route path="/submit-expense" element={<ExpensePage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/month-report" element={<MonthSummaryPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/help-center" element={<HelpPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/not-found" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* Navigation Fallbacks */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#FFFFFF",
              color: "#212529",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "600",
            },
            success: {
              iconTheme: {
                primary: "#28a745",
                secondary: "#FFFFFF",
              },
            },
            error: {
              iconTheme: {
                primary: "#dc3545",
                secondary: "#FFFFFF",
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
