import { Link, useLocation } from 'react-router-dom';
import { BookOpen, MessageCircle, ClipboardList, Upload, BarChart3, Settings, Moon, Sun, Book } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getUser } from '../../utils/storage';

export const Navbar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const user = getUser();

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: BookOpen },
    { to: '/library', label: 'Library', icon: Book },
    { to: '/ask', label: 'Ask AI', icon: MessageCircle },
    { to: '/practice', label: 'Practice', icon: ClipboardList },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="hidden md:flex fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-gray-800 z-50">
        <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#1D9E75] rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">NcertAI</span>
          </Link>

          <div className="flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive(link.to)
                      ? 'bg-[#1D9E75] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-600" />
              ) : (
                <Sun className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {user && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#1D9E75]/10 rounded-lg">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
                {user.name.endsWith('_PRO') && (
                  <span className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white font-bold rounded-full">PRO</span>
                )}
                <span className="text-xs px-2 py-0.5 bg-[#1D9E75] text-white rounded-full">
                  Class {user.class}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0f1117] border-t border-gray-200 dark:border-gray-800 z-50">
        <div className="flex items-center justify-around h-full px-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-lg ${
                  isActive(link.to)
                    ? 'text-[#1D9E75]'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="h-16 md:block hidden" />
    </>
  );
};
