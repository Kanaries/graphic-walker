import { Fragment, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { themeContext } from './context';
import { ThemeToggle } from './components/ThemeToggle';
import { pageGroups } from './nav';

function NavList({ onNavigate }: { onNavigate?: () => void }) {
    const location = useLocation();

    return (
        <nav className="flex flex-col gap-5">
            {pageGroups.map((group) => (
                <div key={group.label}>
                    <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {group.label}
                    </h3>
                    <ul className="space-y-0.5">
                        {group.pages.map((page) => {
                            const active = location.pathname === `/examples/${page.path}`;
                            return (
                                <li key={page.name}>
                                    <Link
                                        to={`/examples/${page.path}`}
                                        onClick={onNavigate}
                                        className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                                            active
                                                ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                                                : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
                                        }`}
                                    >
                                        {page.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    return (
        <themeContext.Provider value={{ theme, setTheme }}>
            <div className={theme === 'dark' ? 'dark' : ''}>
                <div>
                    <Transition.Root show={sidebarOpen} as={Fragment}>
                        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
                            <Transition.Child
                                as={Fragment}
                                enter="transition-opacity ease-linear duration-300"
                                enterFrom="opacity-0"
                                enterTo="opacity-100"
                                leave="transition-opacity ease-linear duration-300"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                            >
                                <div className="fixed inset-0 bg-gray-950/80 dark:bg-white/80" />
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
                                            enter="ease-in-out duration-300"
                                            enterFrom="opacity-0"
                                            enterTo="opacity-100"
                                            leave="ease-in-out duration-300"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                        >
                                            <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                                <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                                    <span className="sr-only">Close sidebar</span>
                                                    <XMarkIcon className="h-6 w-6 text-white dark:text-gray-900" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </Transition.Child>
                                        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-4 py-8 bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
                                            <span className="px-2 text-lg font-bold">Examples</span>
                                            <NavList onNavigate={() => setSidebarOpen(false)} />
                                        </div>
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </Dialog>
                    </Transition.Root>

                    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
                        <div className="flex grow flex-col overflow-y-auto border-r border-zinc-200 bg-white px-4 py-8 dark:border-zinc-800 dark:bg-gray-950 text-gray-900 dark:text-white">
                            <span className="mb-6 px-2 text-lg font-bold">Examples</span>
                            <NavList />
                        </div>
                    </div>

                    <div className="lg:pl-64">
                        <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-x-4 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-gray-950/80 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
                            <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
                                <span className="sr-only">Open sidebar</span>
                                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                            </button>
                            <div className="h-6 w-px bg-gray-950/10 dark:bg-white/10 lg:hidden" aria-hidden="true" />
                            <div className="flex flex-1 items-center justify-between">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Graphic Walker Playground</span>
                                <ThemeToggle />
                            </div>
                        </div>

                        <main className="py-10 bg-white dark:bg-gray-950">
                            <div className="px-4 sm:px-6 lg:px-8">
                                <Outlet />
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </themeContext.Provider>
    );
}
