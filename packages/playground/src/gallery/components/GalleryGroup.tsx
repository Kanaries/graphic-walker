import { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { imageDict } from '../resources';

function GalleryItem(props: {
    name: string,
    title: string,
}) {
    const {name, title} = props;
    const imageURL = imageDict.get(name);

    return (
        <Link to={name} className="col-span-1 flex flex-col rounded-lg text-center shadow overflow-hidden bg-white dark:bg-neutral-900 group">
            <div
                className="w-full h-32 bg-cover bg-no-repeat border-b-2 overflow-hidden hover:bg-right-bottom"
                style={{
                    backgroundImage: `url(${imageURL})`,
                    transition: "background-position 2s",
                }}
            ></div>
            <p className="mx-1 my-2 text-sm text-gray-600 dark:text-white group-hover:underline">{title}</p>
        </Link>
    );
}

export interface IGalleryItem {
    name: string,
    title: string,
    datasetName: string,
}
export default function GalleryGroup(props: {
    title: string,
    path: string,
    items: IGalleryItem[],
}) {
    const { title, path, items } = props;
    const location = useLocation();
    const isActive = useMemo(() => {
        return location.pathname.endsWith(path) || location.pathname.endsWith(path + '/');
    }, [location.pathname, path]);

    return (
        <>
            {isActive &&
            <>
                <div className="text-xl font-bold text-black dark:text-white">{title}</div>
                <div
                    className="grid justify-between gap-y-5 gap-x-4 my-7"
                    style={{gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))"}}
                >
                    {
                        items.map(({name, title}, index) =>
                            <GalleryItem key={index} name={name} title={title}/>)
                    }
                </div>
            </>
            }
            <Outlet />
        </>
    )
}