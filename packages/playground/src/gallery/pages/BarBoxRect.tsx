import BikeSharingServiceBar from '../imgs/bike-sharing-service-bar.png';
import StudentsServiceBar from '../imgs/students-service-bar.png';
import BtcgoldServiceBox from '../imgs/btcgold-service-box.png';
import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service",
        title: "Seasonal Change of Causal Bike Sharing Users on Working Days and Weekends",
        imageURL: BikeSharingServiceBar,
        datasetName: "ds-bike-sharing-service",
        specName: "bike-sharing-service-bar",
    },
    {
        name: "students-service",
        title: "What Affects the Students' Math Scores?",
        imageURL: StudentsServiceBar,
        datasetName: "ds-students-service",
        specName: "students-service-bar",
    },
    {
        name: "btcgold-service",
        title: "Monitor the Price Change of BTC and Gold by Year",
        imageURL: BtcgoldServiceBox,
        datasetName: "ds-btcgold-service",
        specName: "btcgold-service-box",
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
