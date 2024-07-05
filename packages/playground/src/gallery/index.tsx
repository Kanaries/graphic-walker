import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './layout';
import { pages } from './pages';
import ErrorPage from './components/ErrorPage';
import './index.css';

export const homeRoute = '/gallery';

const root = createRoot(document.getElementById('root') as HTMLElement);

const router = createBrowserRouter([
    {
        path: homeRoute,
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
