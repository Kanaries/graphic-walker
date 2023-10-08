import React, { Fragment, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import Modal from '../modal';
import { unstable_batchedUpdates } from 'react-dom';
import DefaultButton from '../button/default';
import PrimaryButton from '../button/primary';
import RemoveConfirm from '../removeConfirm';
import { Popover, Transition } from '@headlessui/react';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export interface ITabOption {
    label: string;
    key: string;
    editable?: boolean;
}
interface EditableTabsProps {
    tabs: ITabOption[];
    selectedKey: string;
    showRemove?: boolean;
    onSelected: (selectedKey: string, index: number) => void;
    onEditLabel?: (label: string, index: number) => void;
    onDuplicate?: (index: number) => void;
    onRemove?: (index: number) => void;
}

const Slider = (props: { className?: string; children: React.ReactNode; safeDistance: number }) => {
    const [x, setX] = useState(0);
    const ref = useRef<HTMLDivElement>();
    const childDisposeRef = useRef<() => void>();

    const onWheel = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = ref.current?.children[0]?.getBoundingClientRect();
            if (rect) {
                setX((x) => Math.min(rect.width - props.safeDistance, Math.max(0, x + e.deltaY)));
            }
            return false;
        },
        [props.safeDistance]
    );

    const refCB = useCallback(
        (node) => {
            if (node == null) {
                if (ref.current != null) {
                    ref.current.removeEventListener('wheel', onWheel);
                }
                return;
            }
            ref.current = node;
            node.addEventListener('wheel', onWheel, { passive: false });
        },
        [onWheel]
    );

    const onResize = useCallback(
        (rect) => {
            setX((x) => Math.min(x, rect.width - props.safeDistance));
        },
        [props.safeDistance]
    );

    const childRefCB = useCallback(
        (node) => {
            if (node === null) {
                if (childDisposeRef.current != null) {
                    childDisposeRef.current();
                }
                return;
            }
            const r = new ResizeObserver((es) => {
                for (const e of es) {
                    onResize(e.contentRect);
                }
            });
            childDisposeRef.current = () => {
                r.disconnect();
            };
            r.observe(node);
        },
        [onResize]
    );

    return (
        <div
            style={{ overflowX: 'clip' }}
            ref={refCB}
            onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.preventDefault();
                setX((x) => Math.max(0, x + e.deltaY));
                return false;
            }}
            className={props.className}
        >
            <div ref={childRefCB} style={{ left: `-${x}px`, width: 'min-content', position: 'relative' }}>
                {props.children}
            </div>
        </div>
    );
};

export default function EditableTabs(props: EditableTabsProps) {
    const { tabs, selectedKey, onSelected, onEditLabel, onRemove, onDuplicate, showRemove } = props;
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    const [name, setName] = useState<string>('');
    const { t } = useTranslation();

    return (
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-y-visible">
            <RemoveConfirm />
            <Modal
                show={editingIndex > -1}
                onClose={() => {
                    setEditingIndex(-1);
                }}
            >
                <div>
                    <span className="block text-sm font-medium leading-6">{t('main.tablist.chart_name')}</span>
                    <div className="mt-2">
                        <input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                            }}
                            type="text"
                            name="text"
                            className="block w-full rounded-md border-0 px-2 py-1.5 bg-transparent shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <DefaultButton
                            className="mr-2"
                            text={t('actions.cancel')}
                            onClick={() => {
                                unstable_batchedUpdates(() => {
                                    setEditingIndex(-1);
                                    setName('');
                                });
                            }}
                        />
                        <PrimaryButton
                            text={t('actions.confirm')}
                            onClick={() => {
                                unstable_batchedUpdates(() => {
                                    onEditLabel && onEditLabel(name, editingIndex);
                                    setEditingIndex(-1);
                                    setName('');
                                });
                            }}
                        />
                    </div>
                </div>
            </Modal>
            <Slider safeDistance={120}>
                <nav className="-mb-px flex h-8 border-gray-200 dark:border-gray-700" role="tablist" aria-label="Tabs">
                    {tabs.map((tab, tabIndex) => (
                        <span
                            role="tab"
                            tabIndex={0}
                            // dangerouslySetInnerHTML={{
                            //     __html: tab.label
                            // }}
                            onClick={() => {
                                onSelected(tab.key, tabIndex);
                            }}
                            key={tab.key}
                            className={classNames(
                                tab.key === selectedKey
                                    ? 'border rounded-t'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:text-gray-200 dark:hover:bg-gray-800',
                                'flex whitespace-nowrap group border-gray-200 dark:border-gray-700 py-1 px-2 pr-2 text-sm cursor-default dark:text-white'
                            )}
                        >
                            {tab.label}
                            {tab.key === selectedKey && tab.editable && (
                                <Popover className="relative inline-flex">
                                    <Popover.Button className="inline-flex items-center gap-x-1 text-sm font-semibold leading-6 text-gray-900">
                                        <EllipsisVerticalIcon className="h-4 w-4" aria-hidden="true" />
                                    </Popover.Button>
                                    <Transition
                                        as={Fragment}
                                        enter="transition ease-out duration-200"
                                        enterFrom="opacity-0 translate-y-1"
                                        enterTo="opacity-100 translate-y-0"
                                        leave="transition ease-in duration-150"
                                        leaveFrom="opacity-100 translate-y-0"
                                        leaveTo="opacity-0 translate-y-1"
                                    >
                                        <Popover.Panel className="absolute left-1/2 z-10 mt-5 flex w-screen max-w-min -translate-x-1/4 px-2">
                                            <div className="shrink rounded p-1 bg-white text-xs font-semibold leading-2 text-gray-900 shadow-lg ring-1 ring-gray-900/5">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        unstable_batchedUpdates(() => {
                                                            setEditingIndex(tabIndex);
                                                            setName(tab.label);
                                                        });
                                                    }}
                                                    className="block p-1 w-full hover:bg-gray-200 text-left"
                                                >
                                                    {'Edit'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDuplicate?.(tabIndex);
                                                    }}
                                                    className="block p-1 w-full hover:bg-gray-200 text-left"
                                                >
                                                    {'Duplicate'}
                                                </button>
                                                {showRemove && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRemove?.(tabIndex);
                                                        }}
                                                        className="block p-1 w-full hover:bg-gray-200 text-red-500 text-left"
                                                    >
                                                        {'Remove'}
                                                    </button>
                                                )}
                                            </div>
                                        </Popover.Panel>
                                    </Transition>
                                </Popover>
                            )}
                        </span>
                    ))}
                </nav>
            </Slider>
        </div>
    );
}