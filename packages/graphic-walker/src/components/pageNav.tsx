import {
    ChartBarIcon,
    PresentationChartBarIcon,
    Square3Stack3DIcon,
    TableCellsIcon,
} from "@heroicons/react/24/outline";
import React from "react";

interface PageNavProps{
    
}
const PageNav: React.FC = (props) => {
    const NavLinks = [
        { name: "Data", link: "/", icon: (className: string) => <TableCellsIcon className={className} /> },
        { name: "Explore", link: "/about", icon: (className: string) => <ChartBarIcon className={className} /> },
        {
            name: "Dashboard",
            link: "/contact",
            icon: (className: string) => <PresentationChartBarIcon className={className} />,
        },
    ];
    return (
        <div className="w-fit h-5/6 m-2 rounded-xl bg-primary shadow-2xl">
            <div className="flex flex-col">
                <div
                    className="p-2 m-2 mb-6 rounded text-primary-foreground text-center flex items-center flex-col"
                >
                    
                    <h1 className="text-3xl font-bold">
                        V.
                    </h1>
                </div>
                {NavLinks.map((link, index) => (
                    <div
                        key={index}
                        className="p-2 m-2 rounded text-primary-foreground hover:bg-primary/90 text-center flex items-center flex-col cursor-pointer"
                    >
                        {link.icon("w-6")}
                        <a className="text-xs" href={link.link}>
                            {link.name}
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PageNav;
