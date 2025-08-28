/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { FilterIcon, GridIcon, AppIcon, CrownIcon, HomeIcon } from './icons';

interface HeaderProps {
    onToggleVipMode: () => void;
    isVipMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleVipMode, isVipMode }) => {
  return (
    <header className="w-full py-3 px-4 sm:px-6 border-b border-gray-200 bg-white/80 backdrop-blur-lg sticky top-0 z-40 flex items-center justify-between">
      <div className="flex items-center justify-center gap-3">
          <AppIcon className="w-8 h-8 text-gray-800" />
          <h1 className="text-xl font-bold tracking-tight text-gray-800">
            Hey It
          </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
          <button
              onClick={onToggleVipMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors duration-300 ${isVipMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
              aria-label={isVipMode ? "返回普通模式" : "切换到VIP模式"}
          >
              {isVipMode ? <HomeIcon className="w-5 h-5" /> : <CrownIcon className="w-5 h-5" />}
              <span>{isVipMode ? '返回' : 'VIP'}</span>
          </button>
          <button className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors" aria-label="过滤器">
            <FilterIcon className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors" aria-label="网格视图">
            <GridIcon className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {/* Placeholder for user avatar */}
            <img src="https://i.pravatar.cc/32?u=2" alt="User Avatar" />
          </div>
      </div>
    </header>
  );
};

export default Header;