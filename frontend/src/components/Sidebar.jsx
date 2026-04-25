import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings as GearIcon, Sun, Moon, ChevronLeft, ChevronRight, Wifi, WifiOff, Newspaper, Trash2, Rss, Database } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

const Sidebar = ({ collapsed, setCollapsed }) => {
    const { theme, toggleTheme } = useTheme();
    const [isBackendUp, setIsBackendUp] = useState(false);

    const toggleSidebar = () => {
        setCollapsed(!collapsed);
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/status');
                setIsBackendUp(response.ok);
            } catch (error) {
                setIsBackendUp(false);
            }
        };

        checkStatus(); // Initial check
        const interval = setInterval(checkStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    const NavItem = ({ to, icon: Icon, label }) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-200 group",
                    isActive
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                )
            }
        >
            <Icon size={20} className="shrink-0" />
            <span
                className={cn(
                    "whitespace-nowrap overflow-hidden transition-all duration-300 text-base font-medium",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}
            >
                {label}
            </span>
            {collapsed && (
                <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {label}
                </div>
            )}
        </NavLink>
    );

    return (
        <aside
            className={cn(
                "h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 relative",
                collapsed ? "w-16" : "w-60"
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="bg-blue-600 p-1.5 rounded-lg shrink-0">
                        <Newspaper size={20} className="text-white" />
                    </div>
                    <span
                        className={cn(
                            "font-bold text-lg text-gray-800 dark:text-white whitespace-nowrap transition-all duration-300",
                            collapsed ? "w-0 opacity-0 " : "w-auto opacity-100"
                        )}
                    >
                        Central de Noticias
                    </span>
                </div>
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute -right-3 top-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-10 text-gray-500 dark:text-gray-400"
            >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 mt-4 overflow-y-auto">


                <NavItem to="/entities" icon={Database} label="Entidades" />
                <NavItem to="/sources" icon={Rss} label="Fuentes" />
                <NavItem to="/" icon={LayoutDashboard} label="Noticias" />


            </nav>

            {/* Footer */}
            <div className="p-2 border-t border-gray-100 dark:border-gray-800 space-y-3 pb-4">
                {/* Utilities Row: Theme, Trash, Settings */}
                <div className={cn(
                    "flex items-center py-2",
                    collapsed
                        ? "flex-col gap-3"
                        : "flex-row justify-center gap-4"
                )}>
                    <button
                        onClick={toggleTheme}
                        className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    <NavLink
                        to="/trash"
                        className={({ isActive }) => cn(
                            "transition-colors",
                            isActive
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        )}
                        title="Papelera"
                    >
                        <Trash2 size={18} />
                    </NavLink>

                    <NavLink
                        to="/settings"
                        className={({ isActive }) => cn(
                            "transition-colors",
                            isActive
                                ? "text-slate-900 dark:text-white"
                                : "text-gray-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                        )}
                        title="Ajustes"
                    >
                        <GearIcon size={18} />
                    </NavLink>
                </div>

                {/* Status Row (Centered Row) */}
                <div className={cn(
                    "flex items-center justify-center gap-2 transition-colors duration-300",
                    isBackendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                    {isBackendUp ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {!collapsed && (
                        <span className="text-[9px] whitespace-nowrap overflow-hidden transition-all duration-300 font-bold tracking-wider">
                            {isBackendUp ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}
                        </span>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
