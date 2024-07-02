import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service-bar",
        title: "Seasonal Change of Causal Bike Sharing Users on Working Days and Weekends",
        datasetName: "ds-bikesharing-service",
    },
    {
        name: "carsales-service-bar",
        title: "Compare Sales from Different Manufacturers and Different Models",
        datasetName: "ds-carsales-service"
    },
    {
        name: "students-service-bar",
        title: "What Affects the Students' Math Scores?",
        datasetName: "ds-students-service",
    },
    {
        name: "btcgold-service-box",
        title: "Monitor the Price Change of BTC and Gold by Year",
        datasetName: "ds-btcgold-service",
    }
];

const name = "Bar, Box, Rect";
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
