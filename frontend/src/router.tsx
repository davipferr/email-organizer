import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './layouts/AppLayout.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { PrivacyPage } from './pages/PrivacyPage.tsx'
import { MailListPage } from './pages/MailListPage.tsx'
import { SendersPage } from './pages/SendersPage.tsx'
import { TagsPage } from './pages/TagsPage.tsx'
import { StoragePage } from './pages/StoragePage.tsx'
import { StatsPage } from './pages/StatsPage.tsx'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: 'inbox', element: <MailListPage /> },
      { path: 'label/:labelId', element: <MailListPage /> },
      { path: 'search', element: <MailListPage /> },
      { path: 'senders', element: <SendersPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'storage', element: <StoragePage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: '*', element: <Navigate to="/inbox" replace /> },
    ],
  },
])
