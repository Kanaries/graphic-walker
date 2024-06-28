import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "carsales-service-pie",
        title: "Car Manufacturer Sales Tracker",
        datasetName: "ds-carsales-service",
    },
    {
        name: "bike-sharing-service-table",
        title: "Bike Sharing Service Usage Tracker",
        datasetName: "ds-bikesharing-service",
    }
];

const name = "Pie, Tick, Other";
const path = toRouterPath(name);
const pages = groupItems.map((item) => ({
    name: item.name,
    path: toRouterPath(item.name),
    element: <ExampleWrapper options={item} />,
}));


export default {
    name,
    path,
    element: <GalleryGroup title={name} path={path} items={groupItems}/>,
    children: pages,
};
