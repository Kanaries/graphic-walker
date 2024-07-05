import { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { imageDict } from '../resources';
import { useTheme } from '../context';

interface GalleryItemProps {
    id: string;
    title: string;
}
export type GalleryItemOption = GalleryItemProps & { datasetName: string };

function GalleryItem(props: GalleryItemProps) {
    const { id, title } = props;
    const imageURL = imageDict[id];
    const { theme } = useTheme();

    return (
        <Link to={id}>
            <div className="divide-y divide-gray-200 dark:divide-gray-800 h-full overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow group">
                <div
                    className="w-full h-36 bg-cover bg-no-repeat overflow-hidden hover:bg-right-bottom"
                    style={{
                        backgroundImage: `url(${imageURL})`,
                        transition: 'background-position 2s',
                        filter: theme === 'dark' ? 'invert(1) hue-rotate(180deg)' : '',
                    }}
                ></div>
                <div className="px-4 pt-2 pb-4 sm:px-6 text-sm text-gray-700 dark:text-gray-200 group-hover:underline">{title}</div>
            </div>
        </Link>
    );
}

export default function GalleryGroup(props: { title: string; path: string; items: GalleryItemProps[] }) {
    const { title, path, items } = props;
    const location = useLocation();
    const isActive = useMemo(() => {
        return location.pathname.endsWith(path) || location.pathname.endsWith(path + '/');
    }, [location.pathname, path]);

    return (
        <>
            {isActive && (
                <>
                    <h2 className="mb-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
                    <div className="grid justify-between gap-y-5 gap-x-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] my-7">
                        {items.map(({ id, title }, index) => (
                            <GalleryItem key={index} id={id} title={title} />
                        ))}
                    </div>
                </>
            )}
            <Outlet />
        </>
    );
}
