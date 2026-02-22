import { Home, Search, History, Settings } from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export function BottomNav({ currentPage, onPageChange }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'search', label: '搜索', icon: Search },
    { id: 'history', label: '历史', icon: History },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 z-50 safe-area-pb">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-white/10' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
