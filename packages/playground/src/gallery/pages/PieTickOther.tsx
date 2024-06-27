import CarsalesServicePie from '../imgs/carsales-service-pie.png'
import BikeSharingServiceTable from '../imgs/bike-sharing-service-table.png'
import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "cars-service",
        title: "Car Manufacturer Sales Tracker",
        imageURL: CarsalesServicePie,
        datasetName: "ds-carsales-service",
        specName: "carsales-service-pie",
    },
    {
        name: "bike-sharing-service",
        title: "Bike Sharing Service Usage Tracker",
        imageURL: BikeSharingServiceTable,
        datasetName: "ds-bike-sharing-service",
        specName: "bike-sharing-service-table",
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
