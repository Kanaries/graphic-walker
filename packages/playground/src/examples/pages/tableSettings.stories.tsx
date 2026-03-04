import { useState, useContext } from 'react';
import { TableWalker } from '@kanaries/graphic-walker';
import { themeContext } from '../context';
import { useFetch, IDataSource } from '../util';
import { Switch } from '@headlessui/react';

export default function TableSettingsShowcase() {
    const { theme } = useContext(themeContext);
    const { dataSource, fields } = useFetch<IDataSource>('https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json');
    
    // State for toggle settings
    const [disableFilter, setDisableFilter] = useState(false);
    const [disableSorting, setDisableSorting] = useState(false);
    const [hideSemanticType, setHideSemanticType] = useState(false);

    // Switch option component
    const SwitchOption = ({ 
        label, 
        checked, 
        onChange 
    }: { 
        label: string; 
        checked: boolean; 
        onChange: (checked: boolean) => void 
    }) => {
        return (
            <div className="flex items-center gap-2">
                <Switch
                    checked={checked}
                    onChange={onChange}
                    className={`${
                        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                    <span className="sr-only">{label}</span>
                    <span
                        className={`${
                            checked ? 'translate-x-6' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                </Switch>
                <span className="text-sm font-medium">{label}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="p-4 border rounded-md dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-3">TableWalker API Settings</h2>
                <div className="flex flex-wrap gap-4 mb-4">
                    <SwitchOption 
                        label="Disable Filter" 
                        checked={disableFilter} 
                        onChange={setDisableFilter} 
                    />
                    <SwitchOption 
                        label="Disable Sorting" 
                        checked={disableSorting} 
                        onChange={setDisableSorting} 
                    />
                    <SwitchOption 
                        label="Hide Semantic Type" 
                        checked={hideSemanticType} 
                        onChange={setHideSemanticType} 
                    />
                </div>
                <div className="text-sm mb-4">
                    <p>Current settings:</p>
                    <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded mt-1">
                        {`{
  disableFilter: ${disableFilter},
  disableSorting: ${disableSorting},
  hideSemanticType: ${hideSemanticType}
}`}
                    </code>
                </div>
            </div>
            
            {dataSource && fields && (
                <TableWalker 
                    fields={fields} 
                    data={dataSource} 
                    appearance={theme} 
                    disableFilter={disableFilter}
                    disableSorting={disableSorting}
                    hideSemanticType={hideSemanticType}
                    pageSize={20} 
                    vizThemeConfig="g2"
                />
            )}
        </div>
    );
} 