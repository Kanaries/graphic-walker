import { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

function GalleryItem(props: IGalleryItem) {
    const {
        name,
        title,
        imageURL,
    } = props

    return (
        <Link to={name} className="bg-card group flex flex-col">
            <div
                className="w-full h-32 border rounded bg-cover bg-no-repeat overflow-hidden hover:bg-right-bottom"
                style={{
                    backgroundImage: `url(${imageURL})`,
                    transition: "background-position 2s",
                }}
            ></div>
            <p className="px-0.5 group-hover:underline text-center text-black dark:text-white">{title}</p>
        </Link>
    )
}

export interface IGalleryItem {
    name: string,
    title: string,
    imageURL: string,
    datasetName?: string,
    specName?: string,
}
export default function GalleryGroup(props: {
    title: string,
    path: string,
    items: IGalleryItem[],
}) {
    const { title, path, items } = props;
    const location = useLocation();
    const isActive = useMemo(() => {
        return location.pathname.endsWith(path) || location.pathname.endsWith(path + '/')
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
                        items.map(({name, title, imageURL}, index) =>
                            <GalleryItem key={index} name={name} imageURL={imageURL} title={title}/>)
                    }
                </div>
            </>
            }
            <Outlet />
        </>
    )
}