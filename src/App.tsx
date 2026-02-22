import { useState, useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DetailPage } from '@/pages/DetailPage';
import { PlayerPage } from '@/pages/PlayerPage';
import type { VideoItem } from '@/types';
import './App.css';

type PageType = 'home' | 'search' | 'history' | 'settings';
type ViewType = 'list' | 'detail' | 'player';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [initialEpisode, setInitialEpisode] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // 初始化
  useEffect(() => {
    // 注册Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    setIsReady(true);
  }, []);

  // 处理视频点击
  const handleVideoClick = (video: VideoItem) => {
    setSelectedVideo(video);
    setCurrentView('detail');
  };

  // 处理播放
  const handlePlay = (video: VideoItem, episodeIndex: number) => {
    setSelectedVideo(video);
    setInitialEpisode(episodeIndex);
    setCurrentView('player');
  };

  // 返回列表
  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedVideo(null);
  };

  // 返回详情
  const handleBackToDetail = () => {
    setCurrentView('detail');
  };

  // 跳转到添加影视源
  const handleAddSourceClick = () => {
    setCurrentPage('settings');
  };

  // 跳转到搜索页
  const handleSearchClick = () => {
    setCurrentPage('search');
  };

  // 渲染当前视图
  const renderView = () => {
    if (!isReady) {
      return (
        <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    switch (currentView) {
      case 'detail':
        if (!selectedVideo) return null;
        return (
          <DetailPage
            video={selectedVideo}
            onBack={handleBackToList}
            onPlay={handlePlay}
          />
        );
      
      case 'player':
        if (!selectedVideo) return null;
        return (
          <PlayerPage
            video={selectedVideo}
            initialEpisode={initialEpisode}
            onBack={handleBackToDetail}
          />
        );
      
      case 'list':
      default:
        switch (currentPage) {
          case 'search':
            return (
              <SearchPage
                onVideoClick={handleVideoClick}
                onBack={() => setCurrentPage('home')}
              />
            );
          
          case 'history':
            return (
              <HistoryPage onVideoClick={handleVideoClick} />
            );
          
          case 'settings':
            return (
              <SettingsPage onBack={() => setCurrentPage('home')} />
            );
          
          case 'home':
          default:
            return (
              <HomePage
                onVideoClick={handleVideoClick}
                onSettingsClick={() => setCurrentPage('settings')}
                onAddSourceClick={handleAddSourceClick}
                onSearchClick={handleSearchClick}
              />
            );
        }
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* 主内容区域 */}
      <div className="h-full pb-16">
        {renderView()}
      </div>

      {/* 底部导航 - 只在列表视图显示 */}
      {currentView === 'list' && (
        <BottomNav
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page as PageType);
            setCurrentView('list');
          }}
        />
      )}
    </div>
  );
}

export default App;
