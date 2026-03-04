import { useTheme } from '../context';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';

export const CurrentTheme = () => {
    const { theme } = useTheme();
    const iconStyle = 'h-4 dark:text-gray-200';
    const textStyle = 'text-gray-700 hover:text-gray-950 dark:text-gray-200 group gap-x-3 rounded-md p-2 text-sm font-semibold leading-6';

    return (
        <div className="flex items-center">
            {theme === 'light' && (
                <>
                    <SunIcon className={iconStyle} />
                    <p className={textStyle}>Light</p>
                </>
            )}
            {theme === 'dark' && (
                <>
                    <MoonIcon className={iconStyle} />
                    <p className={textStyle}>Dark</p>
                </>
            )}
        </div>
    );
};
