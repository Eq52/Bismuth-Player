import { useState, useEffect, useCallback } from 'react';
import { Home, Search, History, Settings, Film, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DetailPage } from '@/pages/DetailPage';
import { PlayerPage } from '@/pages/PlayerPage';
import { isDisclaimerAgreed, setDisclaimerAgreed } from '@/services/storage';
import type { VideoItem } from '@/types';
import './App.css';

type PageType = 'home' | 'search' | 'history' | 'settings';
type ViewType = 'list' | 'detail' | 'player';

// 免责声明弹窗组件
function DisclaimerModal({ onAgree }: { onAgree: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl scale-in">
        {/* 头部 */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold">使用须知</h2>
              <p className="text-gray-500 text-xs">开始使用前请阅读</p>
            </div>
          </div>
        </div>
        
        {/* 内容 */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2.5 text-gray-300 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p>本应用为<strong className="text-white">纯播放工具</strong>，不提供任何影视内容或资源。</p>
          </div>
          <div className="flex items-start gap-2.5 text-gray-300 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p>所有内容来源于用户自行配置的第三方源，请确保来源<strong className="text-white">合法合规</strong>。</p>
          </div>
          <div className="flex items-start gap-2.5 text-gray-300 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p>使用者需自行承担使用风险，开发者<strong className="text-white">不承担任何责任</strong>。</p>
          </div>
        </div>
        
        {/* 按钮 */}
        <div className="p-5 pt-0">
          <button
            onClick={onAgree}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            我已了解，继续使用
          </button>
        </div>
      </div>
    </div>
  );
}

// 启动加载屏幕组件
function StartupScreen() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="startup-loader">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/30">
          <Film className="w-10 h-10 text-white" />
        </div>
      </div>
      <h1 className="text-white text-xl font-bold mt-6 tracking-tight">Bismuth Player</h1>
      <p className="text-gray-500 text-sm mt-1">如"秘"般美丽</p>
      <div className="flex items-center gap-2 mt-8">
        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
        <span className="text-gray-400 text-sm">加载中...</span>
      </div>
    </div>
  );
}

// 桌面端侧边栏组件
function DesktopSidebar({ currentPage, onPageChange }: { currentPage: string; onPageChange: (page: string) => void }) {
  const navItems = [
    { id: 'home', icon: Home, label: '首页' },
    { id: 'search', icon: Search, label: '搜索' },
    { id: 'history', icon: History, label: '历史' },
    { id: 'settings', icon: Settings, label: '设置' },
  ];

  return (
    <aside className="desktop-sidebar">
      {/* Logo */}
      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-purple-500/20">
        <Film className="w-5 h-5 text-white" />
      </div>
      
      {/* 导航项 */}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
                isActive 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
              title={item.label}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-r" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// 页面切换包装组件
function PageTransition({ 
  children, 
  viewKey, 
  type = 'list' 
}: { 
  children: React.ReactNode; 
  viewKey: string;
  type?: ViewType;
}) {
  const [animationClass, setAnimationClass] = useState('');
  
  useEffect(() => {
    // 根据类型选择不同的动画
    const animationType = type === 'list' ? 'page-slide-in' : 'page-slide-up';
    setAnimationClass(animationType);
  }, [viewKey, type]);

  return (
    <div className={`h-full w-full ${animationClass}`} key={viewKey}>
      {children}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [initialEpisode, setInitialEpisode] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [_viewKey, setViewKey] = useState(0);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // 初始化
  useEffect(() => {
    // 模拟短暂启动延迟，显示启动屏幕
    const timer = setTimeout(() => {
      // 检查是否已同意免责声明
      if (!isDisclaimerAgreed()) {
        setShowDisclaimer(true);
      }
      setIsReady(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // 同意免责声明
  const handleAgreeDisclaimer = useCallback(() => {
    setDisclaimerAgreed(true);
    setShowDisclaimer(false);
  }, []);

  // 处理视频点击
  const handleVideoClick = useCallback((video: VideoItem) => {
    setSelectedVideo(video);
    setCurrentView('detail');
    setViewKey(prev => prev + 1);
  }, []);

  // 处理播放
  const handlePlay = useCallback((video: VideoItem, episodeIndex: number) => {
    setSelectedVideo(video);
    setInitialEpisode(episodeIndex);
    setCurrentView('player');
    setViewKey(prev => prev + 1);
  }, []);

  // 返回列表
  const handleBackToList = useCallback(() => {
    setCurrentView('list');
    setSelectedVideo(null);
    setViewKey(prev => prev + 1);
  }, []);

  // 返回详情
  const handleBackToDetail = useCallback(() => {
    setCurrentView('detail');
    setViewKey(prev => prev + 1);
  }, []);

  // 跳转到添加影视源
  const handleAddSourceClick = useCallback(() => {
    setCurrentPage('settings');
    setViewKey(prev => prev + 1);
  }, []);

  // 跳转到搜索页
  const handleSearchClick = useCallback(() => {
    setCurrentPage('search');
    setViewKey(prev => prev + 1);
  }, []);

  // 页面切换
  const handlePageChange = useCallback((page: string) => {
    setCurrentPage(page as PageType);
    setCurrentView('list');
    setViewKey(prev => prev + 1);
  }, []);

  // 渲染当前视图
  const renderView = () => {
    if (!isReady) {
      return <StartupScreen />;
    }

    switch (currentView) {
      case 'detail':
        if (!selectedVideo) return null;
        return (
          <PageTransition viewKey={`detail-${selectedVideo.vod_id}`} type="detail">
            <DetailPage
              video={selectedVideo}
              onBack={handleBackToList}
              onPlay={handlePlay}
            />
          </PageTransition>
        );
      
      case 'player':
        if (!selectedVideo) return null;
        return (
          <PageTransition viewKey={`player-${selectedVideo.vod_id}-${initialEpisode}`} type="detail">
            <PlayerPage
              video={selectedVideo}
              initialEpisode={initialEpisode}
              onBack={handleBackToDetail}
            />
          </PageTransition>
        );
      
      case 'list':
      default:
        switch (currentPage) {
          case 'search':
            return (
              <PageTransition viewKey="search" type="list">
                <SearchPage
                  onVideoClick={handleVideoClick}
                  onBack={() => handlePageChange('home')}
                />
              </PageTransition>
            );
          
          case 'history':
            return (
              <PageTransition viewKey="history" type="list">
                <HistoryPage onVideoClick={handleVideoClick} />
              </PageTransition>
            );
          
          case 'settings':
            return (
              <PageTransition viewKey="settings" type="list">
                <SettingsPage onBack={() => handlePageChange('home')} />
              </PageTransition>
            );
          
          case 'home':
          default:
            return (
              <PageTransition viewKey="home" type="list">
                <HomePage
                  onVideoClick={handleVideoClick}
                  onSettingsClick={() => handlePageChange('settings')}
                  onAddSourceClick={handleAddSourceClick}
                  onSearchClick={handleSearchClick}
                />
              </PageTransition>
            );
        }
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* 免责声明弹窗 */}
      {showDisclaimer && <DisclaimerModal onAgree={handleAgreeDisclaimer} />}
      
      {/* 桌面端侧边栏 */}
      {currentView === 'list' && isReady && !showDisclaimer && (
        <DesktopSidebar
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}

      {/* 主内容区域 */}
      <div className={`h-full desktop-main ${currentView === 'list' ? 'pb-16 md:pb-0' : ''}`}>
        {renderView()}
      </div>

      {/* 底部导航 - 只在移动端列表视图显示 */}
      {currentView === 'list' && isReady && !showDisclaimer && (
        <div className="desktop-bottom-nav">
          <BottomNav
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}

export default App;
