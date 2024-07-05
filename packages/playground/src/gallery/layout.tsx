import { useMemo, useState, Fragment, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';
import { CurrentTheme } from './components/ThemeToggle';
import { themeContext, useTheme } from './context';
import { pages } from './pages';
import { homeRoute } from '.';

interface SidebarItemProps {
    name: string;
    path: string;
}

const Logo = () => (
    <>
        <img className="h-8 w-auto" src="/kanaries.ico" alt="Kanaries Data Inc." />
        <span className="text-gray-700 dark:text-white p-2 font-semibold leading-6 select-none">Kanaries</span>
    </>
);

const SidebarItem = ({ name, path }: SidebarItemProps) => (
    <li>
        <Link
            to={path}
            className="text-gray-700 hover:bg-gray-50 hover:text-gray-950 dark:text-gray-200 dark:hover:bg-gray-800 group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6"
        >
            {name}
        </Link>
    </li>
);

const DialogSidebar = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void }) => (
    <Transition.Root as={Fragment} show={sidebarOpen}>
        <Dialog className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <Dialog.Backdrop className="fixed inset-0 z-50 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
                <Transition.Child
                    as={Fragment}
                    enter="transition ease-in-out duration-300 transform"
                    enterFrom="-translate-x-full"
                    enterTo="translate-x-0"
                    leave="transition ease-in-out duration-300 transform"
                    leaveFrom="translate-x-0"
                    leaveTo="-translate-x-full"
                >
                    <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
                                <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                    <span className="sr-only">Close sidebar</span>
                                    <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                </button>
                            </div>
                        </Transition.Child>

                        <div className="flex grow flex-col gap-y-5 px-6 pb-2 overflow-y-auto bg-white dark:bg-gray-900">
                            <div className="flex h-16 shrink-0 items-center">
                                <Logo />
                            </div>
                            <nav className="flex flex-1 flex-col">
                                <ul role="list" className="-mx-2 space-y-1">
                                    {pages.map((item, index) => (
                                        <SidebarItem key={index} {...item} />
                                    ))}
                                </ul>
                            </nav>
                        </div>
                    </Dialog.Panel>
                </Transition.Child>
            </div>
        </Dialog>
    </Transition.Root>
);

const StaticSidebar = () => {
    const { toggleTheme } = useTheme();
    return (
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
            <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-none px-6">
                <Link to={homeRoute}>
                    <div className="flex h-16 shrink-0 items-center">
                        <Logo />
                    </div>
                </Link>

                <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                            <ul role="list" className="-mx-2 space-y-1">
                                {pages.map((item, index) => (
                                    <SidebarItem key={index} {...item} />
                                ))}
                            </ul>
                        </li>
                        <li className="-mx-6 mt-auto">
                            <div
                                onClick={toggleTheme}
                                className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            >
                                <CurrentTheme />
                            </div>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    );
};

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
    const route = 'gallery';
    const location = useLocation();
    const isHome = useMemo(() => {
        return location.pathname.endsWith(route) || location.pathname.endsWith(route + '/');
    }, [location.pathname]);

    useEffect(() => {
        const root = document.body;
        root.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    useEffect(() => {
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleColorSchemeChange = (e: MediaQueryList | MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
        colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
        handleColorSchemeChange(colorSchemeQuery);
    }, []);

    return (
        <themeContext.Provider value={{ theme, toggleTheme }}>
            <div className="dark:bg-black">
                <DialogSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
                <StaticSidebar />

                <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm sm:px-6 lg:hidden">
                    <button type="button" className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-400 lg:hidden" onClick={() => setSidebarOpen(true)}>
                        <span className="sr-only">Open sidebar</span>
                        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <Link className="flex-1" to={homeRoute}>
                        <div className="text-md font-semibold leading-6 text-gray-900 dark:text-white">Graphic Walker</div>
                    </Link>
                    <div
                        onClick={toggleTheme}
                        className="flex items-center gap-x-4 px-4 text-sm font-semibold leading-6 text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                    >
                        <CurrentTheme />
                    </div>
                </div>

                <main className="py-10 lg:pl-72">
                    <div className="px-4 sm:px-6 lg:px-8">
                        {isHome && (
                            <>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-200 sm:text-4xl">Graphic Walker Gallery</h1>
                                <p className="mt-6 text-xl leading-8 text-gray-700 dark:text-gray-200">
                                    This page shows use cases with specifications for different types of charts, please click tabs left to check.
                                </p>
                            </>
                        )}
                        <Outlet />
                    </div>
                </main>
            </div>
        </themeContext.Provider>
    );
}
