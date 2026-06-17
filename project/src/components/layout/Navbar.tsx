import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, MessageCircle, ClipboardList, Book, FileText, Layers, CalendarClock, User, Sparkles, ScanText, FolderOpen, ChevronLeft, ChevronRight, BarChart3, Timer, Brain, Video, Trophy } from 'lucide-react';
import { getUser } from '../../utils/storage';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('clarity_sidebar_collapsed') === '1');

  useEffect(() => {
    const sidebarWidth = collapsed ? '5rem' : '18rem';
    document.documentElement.style.setProperty('--clarity-sidebar-width', sidebarWidth);
    document.body.dataset.claritySidebar = collapsed ? 'collapsed' : 'expanded';
    localStorage.setItem('clarity_sidebar_collapsed', collapsed ? '1' : '0');

    return () => {
      document.documentElement.style.removeProperty('--clarity-sidebar-width');
      delete document.body.dataset.claritySidebar;
    };
  }, [collapsed]);

  useEffect(() => {
    const container = document.getElementById('sidebar-scroll-container');
    if (container) {
      const savedScroll = sessionStorage.getItem('sidebar_scroll_position');
      if (savedScroll) {
        setTimeout(() => {
          container.scrollTop = parseInt(savedScroll, 10);
        }, 0);
      }
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem('sidebar_scroll_position', e.currentTarget.scrollTop.toString());
  };

  const homeLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: BookOpen },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  const studyLinks = [
    { to: '/textbook-hub', label: 'Chapter Hub', icon: Book },
    { to: '/studio', label: 'Chapter Deep Dive', icon: Video },
  ];

  const practiceLinks = [
    { to: '/practice', label: 'Practice Lab', icon: ClipboardList },
    { to: '/exam-simulator', label: 'Exam Simulator', icon: Timer },
  ];

  const aiLinks = [
    { to: '/ask', label: 'Ask AI', icon: Sparkles },
    { to: '/ai-tutor', label: 'Arya Tutor', icon: Brain },
    { to: '/study-plan', label: 'Study Planner', icon: CalendarClock },
    { to: '/summary', label: 'Summary', icon: FileText },
    { to: '/flashcards', label: 'Flashcards', icon: Layers },
  ];

  const toolsLinks = [
    { to: '/ocr', label: 'Scan & Digitize', icon: ScanText },
    { to: '/materials', label: 'My Uploads', icon: FolderOpen },
  ];

  const mobileLinks = [
    { to: '/dashboard', label: 'Home', icon: BookOpen },
    { to: '/ask', label: 'Clarifier', icon: Sparkles },
    { to: '/practice', label: 'Practice', icon: ClipboardList },
    { to: '/textbook-hub', label: 'Chapters', icon: Book },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const isActive = (path: string) => location.pathname === path;

  const renderLink = (link: { to: string; label: string; icon: typeof BookOpen }) => {
    const Icon = link.icon;
    const active = isActive(link.to);
    return (
      <Link
        key={link.to}
        to={link.to}
        title={collapsed ? link.label : undefined}
        className={`group flex items-center gap-3 rounded-2xl py-3 transition-all ${collapsed ? 'justify-center px-3' : 'px-4'} ${active
          ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-800'} transition-colors`}>
          <Icon className="h-4 w-4" />
        </span>
        {!collapsed && <span className="text-sm font-bold">{link.label}</span>}
      </Link>
    );
  };

  return (
    <>
      <nav className={`hidden md:flex fixed left-0 top-0 bottom-0 ${collapsed ? 'w-20' : 'w-72'} bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 z-50 transition-all duration-300`}>
        <div className={`relative flex h-full w-full flex-col ${collapsed ? 'p-3' : 'p-4'}`}>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="absolute -right-3 top-10 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 shadow-md hover:text-[#1D9E75]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <Link to="/dashboard" className={`flex items-center gap-3 rounded-3xl bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20 ${collapsed ? 'justify-center px-3 py-4' : 'px-4 py-4'}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-lg font-black leading-tight">Clarity</p>
                <p className="text-xs font-medium text-white/80">Study workspace</p>
              </div>
            )}
          </Link>

          <div id="sidebar-scroll-container" onScroll={handleScroll} className="mt-5 space-y-5 overflow-y-auto pr-1">
            <section>
              {!collapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Home</p>}
              <div className="mt-2 space-y-1">
                {homeLinks.map(renderLink)}
              </div>
            </section>

            <section>
              {!collapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">NCERT Study</p>}
              <div className="mt-2 space-y-1">
                {studyLinks.map(renderLink)}
              </div>
            </section>
            
            <section>
              {!collapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Practice</p>}
              <div className="mt-2 space-y-1">
                {practiceLinks.map(renderLink)}
              </div>
            </section>

            <section>
              {!collapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Clarifier AI</p>}
              <div className="mt-2 space-y-1">
                {aiLinks.map(renderLink)}
              </div>
            </section>

            <section>
              {!collapsed && <p className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Tools</p>}
              <div className="mt-2 space-y-1">
                {toolsLinks.map(renderLink)}
              </div>
            </section>
          </div>

          <div className="mt-auto pt-4 space-y-3">
            {user && (
              <button
                onClick={() => navigate('/profile')}
                title={collapsed ? 'Profile' : undefined}
                className={`flex w-full items-center gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 py-3 text-left transition-all hover:border-[#1D9E75]/30 hover:bg-[#1D9E75]/5 ${collapsed ? 'justify-center px-3' : 'px-4'}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1D9E75] flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">{user.name}</p>
                    <p className="text-xs font-medium text-slate-500">Class {user.class}</p>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0f1117] border-t border-gray-200 dark:border-gray-800 z-50">
        <div className="flex items-center justify-around h-full px-2">
          {mobileLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center justify-center space-y-1 px-2 py-2 rounded-lg min-w-0 ${isActive(link.to)
                  ? 'text-[#1D9E75]'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className={`hidden md:block shrink-0 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`} />
    </>
  );
};
