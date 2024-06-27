import BikeSharingServiceLine from '../imgs/bike-sharing-service-line.png';
import BikeSharingServiceArea from '../imgs/bike-sharing-service-area.png';
import StudentsServiceArea from '../imgs/students-service-area.png';
import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service-line",
        title: "Monitor the Changes of a Bike Sharing Service by Month and Year",
        imageURL: BikeSharingServiceLine,
        datasetName: "ds-bike-sharing-service",
        specName: "bike-sharing-service-line",
    },
    {
        name: "bike-sharing-service-area",
        title: "The Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
        imageURL: BikeSharingServiceArea,
        datasetName: "ds-bike-sharing-service",
        specName: "bike-sharing-service-area",
    },
    {
        name: "gender-gap",
        title: "Compare Math Performance of Male and Female Students",
        imageURL: StudentsServiceArea,
        datasetName: "ds-students-service",
        specName: "students-service-area",
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
