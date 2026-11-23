import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { RequireAuth, RequirePortal, FullPageLoader } from './auth/guards.jsx';
import SiteLayout from './components/site/SiteLayout.jsx';
import Home from './pages/Home.jsx';
import {
  About, AgentsPage, Automation, Contact, Disclaimer, Documentation, Features,
  Marketplace, NotFound, Privacy, Solutions, Terms, ToolsPage,
} from './pages/Content.jsx';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth.jsx';
import PortalShell, { PortalGate } from './portals/PortalShell.jsx';
import Dashboard from './portals/Dashboard.jsx';
import { PORTALS, PORTAL_LIST } from './portals/registry.js';
import {
  AgentsPage as PortalAgents, AttendancePage, AuditPage, ModelsPage, NotificationsPage,
  PermissionsPage, ProfilePage, ProvidersPage, ReportsPage, SecurityPage, SettingsPage,
  StaffPage, TasksPage, TicketsPage, ToolsPage as PortalTools, UsagePage, UsersPage,
  WorkflowsPage,
} from './portals/pages.jsx';
import {
  ApiKeysPage, BackupsPage, DeploymentsPage, LogsPage, ModerationPage, SandboxPage, WebhooksPage,
} from './portals/pages-dev.jsx';
import { ChatPage, HistoryPage, ImageStudioPage } from './portals/Chat.jsx';

/** Sends a signed-in visitor to the portal their role owns. */
function PortalRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullPageLoader label="Finding your portal" />;
  if (status === 'twofa') return <Navigate to="/login?step=2fa" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.homeRoute || '/app'} replace />;
}

const PAGE_COMPONENTS = {
  overview: (portalKey) => <Dashboard portalKey={portalKey} />,
  users: () => <UsersPage />,
  permissions: () => <PermissionsPage />,
  agents: () => <PortalAgents />,
  models: () => <ModelsPage />,
  providers: () => <ProvidersPage />,
  tools: () => <PortalTools />,
  workflows: () => <WorkflowsPage />,
  security: () => <SecurityPage />,
  audit: () => <AuditPage />,
  usage: (portalKey) => <UsagePage portalKey={portalKey} />,
  backups: () => <BackupsPage />,
  settings: (portalKey) => <SettingsPage portalKey={portalKey} />,
  notifications: () => <NotificationsPage />,
  profile: () => <ProfilePage />,
  tasks: () => <TasksPage />,
  staff: () => <StaffPage />,
  attendance: () => <AttendancePage />,
  tickets: () => <TicketsPage />,
  reports: (portalKey) => <ReportsPage portalKey={portalKey} />,
  moderation: () => <ModerationPage />,
  keys: () => <ApiKeysPage />,
  webhooks: () => <WebhooksPage />,
  logs: () => <LogsPage />,
  deployments: () => <DeploymentsPage />,
  sandbox: () => <SandboxPage />,
  chat: () => <ChatPage />,
  history: () => <HistoryPage />,
  images: () => <ImageStudioPage />,
};

export default function App() {
  const { status } = useAuth();
  const navigate = useNavigate();

  // A pending second factor should always land on the challenge screen.
  useEffect(() => {
    if (status === 'twofa' && !window.location.pathname.startsWith('/login')) {
      navigate('/login?step=2fa', { replace: true });
    }
  }, [status, navigate]);

  return (
    <Routes>
      {/* ---------------------------- public site ---------------------------- */}
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="ai-tools" element={<ToolsPage />} />
        <Route path="ai-agents" element={<AgentsPage />} />
        <Route path="automation" element={<Automation />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="solutions" element={<Solutions />} />
        <Route path="features" element={<Features />} />
        <Route path="documentation" element={<Documentation />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="disclaimer" element={<Disclaimer />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* --------------------------- portal routing -------------------------- */}
      <Route path="/portal" element={<PortalRedirect />} />

      {PORTAL_LIST.map((portal) => (
        <Route
          key={portal.key}
          path={portal.route}
          element={
            <RequireAuth>
              <RequirePortal portal={portal.key}>
                <PortalShell portalKey={portal.key} />
              </RequirePortal>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard portalKey={portal.key} />} />
          {portal.nav.filter((item) => item.to).map((item) => {
            const render = PAGE_COMPONENTS[item.page];
            return (
              <Route
                key={item.to}
                path={item.to}
                element={render ? <PortalGate permission={item.perm}>{render(portal.key)}</PortalGate> : <NotFound />}
              />
            );
          })}
          <Route path="*" element={<NotFound />} />
        </Route>
      ))}
    </Routes>
  );
}

export { PORTALS };
