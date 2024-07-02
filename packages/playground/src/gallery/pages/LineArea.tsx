import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service-line",
        title: "Monitor the Changes of a Bike Sharing Service by Month and Year",
        datasetName: "ds-bikesharing-service",
    },
    {
        name: "bike-sharing-service-area",
        title: "The Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
        datasetName: "ds-bikesharing-service",
    },
    {
        name: "students-service-area",
        title: "Compare Math Performance of Male and Female Students",
        datasetName: "ds-students-service",
    },
    {
        name: "cars-service-line",
        title: "Compare Miles per Gallon between Three Different Countries",
        datasetName: "ds-cars-service",
    }
];

const name = "Line, Area";
const path = toRouterPath(name);
const pages = groupItems.map((item) => ({
    name: item.name,
    path: toRouterPath(item.name),
    element: <ExampleWrapper options={item}/>,
}));

export default {
    name,
    path,
    element: <GalleryGroup title={name} path={path} items={groupItems}/>,
    children: pages,
};
