import BikeSharingImage from "../imgs/bike-sharing-register-user.webp";
import CarsServiceImage from "../imgs/car-service.webp";
import EarthquakeService from "../imgs/earthquake-service.webp";
import GalleryGroup, { IGalleryItem } from "../components/GalleryGroup";

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
    },
    {
        name: "cars-service",
        title: "Cars Service",
        imageURL: CarsServiceImage
    },
    {
        name: "earthquake-service",
        title: "Earthquake Service",
        imageURL: EarthquakeService
    },{
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
    },
    {
        name: "cars-service",
        title: "Cars Service",
        imageURL: CarsServiceImage
    },
    {
        name: "earthquake-service",
        title: "Earthquake Service",
        imageURL: EarthquakeService
    },
    {
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
    },
    {
        name: "cars-service",
        title: "Cars Service",
        imageURL: CarsServiceImage
    },
    {
        name: "earthquake-service",
        title: "Earthquake Service",
        imageURL: EarthquakeService
    },
];

const name = "Line, Area";
const path = name.replace(/\s/g, '_');
const pages = groupItems.map((Component) => ({
    name: Component.name,
    path: Component.name.replace(/\s/g, '_'),
    element: <div>{Component.name}</div>,
}));

export default {
    name,
    path,
    element: <GalleryGroup title={name} path={path} items={groupItems}/>,
    children: pages,
};
