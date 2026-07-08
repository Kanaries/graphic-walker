export const DemoDataAssets = process.env.NODE_ENV === 'production' ? {
    CARS: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-cars-service.json",
    STUDENTS: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json",
    BTC_GOLD: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-btcgold-service.json",
    BIKE_SHARING: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-bikesharing-service.json',
    CAR_SALES: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-carsales-service.json',
    COLLAGE: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-collage-service.json',
    TITANIC: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-titanic-service.json',
    KELPER: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-kelper-service.json',
    EARTHQUAKE: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-earthquake-service.json'
} : {
    // CARS: "https://chspace.oss-cn-hongkong.aliyuncs.com/api/ds-cars-service.json",
    CARS: "/datasets/ds-cars-service.json",
    // STUDENTS: "https://chspace.oss-cn-hongkong.aliyuncs.com/datasets/ds-students-service.json",
    STUDENTS: "/datasets/ds-students-service.json",
    BTC_GOLD: "/datasets/ds-btcgold-service.json",
    BIKE_SHARING: '/datasets/ds-bikesharing-service.json',
    CAR_SALES: '/datasets/ds-carsales-service.json',
    COLLAGE: '/datasets/ds-collage-service.json',
    TITANIC: '/datasets/ds-titanic-service.json',
    KELPER: '/datasets/ds-kelper-service.json',
    EARTHQUAKE: '/datasets/ds-earthquake-service.json'
} as const;

export interface IPublicData {
    key: string;
    title: string;
    desc?: string;
    icon?: string;
    rows?: number;
    columns?: number;
}

export const PUBLIC_DATA_LIST: IPublicData[] = [
    {
        key: "CARS",
        title: "Cars",
        icon: "🚗",
        rows: 406,
        columns: 9
    },
    {
        key: "STUDENTS",
        title: "Students' Performance",
        icon: "🎓",
        rows: 1000,
        columns: 8
    },
    {
        key: "BIKE_SHARING",
        title: "Bike Sharing",
        icon: "🚲",
        rows: 17379,
        columns: 16
    },
    {
        key: "EARTHQUAKE",
        title: "Earthquakes",
        icon: "🌋",
        rows: 23412,
        columns: 4
    },
    {
        key: "CAR_SALES",
        title: "Car Sales",
        icon: "🚙",
        rows: 157,
        columns: 16
    },
    {
        key: "COLLAGE",
        title: "Colleges",
        icon: "🏫",
        rows: 1294,
        columns: 16
    },
    {
        key: "KELPER",
        title: "NASA Kepler",
        icon: "🪐",
        rows: 9218,
        columns: 44
    },
    {
        key: 'BTC_GOLD',
        title: "Bitcoin vs. Gold",
        icon: "📈",
        rows: 464,
        columns: 7
    },
    {
        key: "TITANIC",
        title: "Titanic",
        icon: "🚢",
        rows: 712,
        columns: 11
    }
]
