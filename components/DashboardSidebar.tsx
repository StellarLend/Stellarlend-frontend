'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        label: 'Dashboard',
        href: '/dashboard/profile',
        icon: '/icons/dashboard.svg',
    },
    {
        label: 'Loans',
        href: '/dashboard/loans',
        icon: '/icons/bank.svg',
    },
    {
        label: 'Lending',
        href: '/dashboard/notification',
        icon: '/icons/coins-light.svg',
    },
    {
        label: 'Transactions',
        href: '/dashboard/transactions',
        icon: '/icons/transaction-history.svg',
    },
    {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: '/icons/settings.svg',
    },
];

const DashboardSidebar = () => {
    const pathname = usePathname();

    return (
        <div className="fixed top-0 left-0 w-[20%] xl:w-[16%] h-screen overflow-hidden hidden lg:flex flex-col bg-black shadow">
            <h1 className='font-bold text-white text-3xl h-[7rem] flex justify-center mt-2 py-3'>Stellarlend</h1>
            <div className="flex flex-col items-center justify-end space-y-8 w-full">
                { navItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={ item.href }
                            href={ item.href }
                            className={ `flex items-center gap-3 font-medium text-white w-[80%] ${isActive && 'bg-[#15A350] p-2 rounded-lg'}` }
                        >
                            <Image src={ item.icon } alt={ item.label } width={ 30 } height={ 30 } />
                            <span>{ item.label }</span>
                        </Link>
                    );
                }) }
            </div>
        </div>
    );
};

export default DashboardSidebar;
