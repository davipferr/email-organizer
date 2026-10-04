import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './layouts/AppLayout.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { MailListPage } from './pages/MailListPage.tsx'
import { SendersPage } from './pages/SendersPage.tsx'
import { TagsPage } from './pages/TagsPage.tsx'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: 'inbox', element: <MailListPage /> },
      { path: 'label/:labelId', element: <MailListPage /> },
      { path: 'search', element: <MailListPage /> },
      { path: 'senders', element: <SendersPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: '*', element: <Navigate to="/inbox" replace /> },
    ],
  },
])
