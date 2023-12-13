import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { pages } from './nav';
import Layout from './layout';
import ErrorPage from './components/errorPage';
import './index.css';
const root = createRoot(document.getElementById('root') as HTMLElement);

const router = createBrowserRouter([
    {
        path: '/examples',
        element: <Layout />,
        errorElement: <ErrorPage />,
        children: pages,
    },
]);

root.render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
);
