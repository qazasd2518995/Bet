'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SynchronizedCountdownProps {
  gameState: {
    current_period: string;
    countdown_seconds: number;
    status: string;
    server_time: string;
    next_draw_time: string;
  } | null;
  onStatusChange?: (status: 'betting' | 'drawing') => void;
}

export default function SynchronizedCountdown({ 
  gameState,
  onStatusChange 
}: SynchronizedCountdownProps) {
  const [displayTime, setDisplayTime] = useState('00:00');
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const hasTriggeredRef = useRef(false);
  const lastPeriodRef = useRef<string>('');

  useEffect(() => {
    if (!gameState) return;

    // 檢測期號變化，重置觸發標記
    if (gameState.current_period !== lastPeriodRef.current) {
      lastPeriodRef.current = gameState.current_period;
      hasTriggeredRef.current = false;
      console.log(`[倒數] 新期號: ${gameState.current_period}`);
    }

    // 直接使用 countdown_seconds，不計算剩餘時間
    setDisplaySeconds(gameState.countdown_seconds);
    setDisplayTime(formatTime(gameState.countdown_seconds));

    // 當倒數為0且狀態改變時觸發
    if (gameState.countdown_seconds <= 0 && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      console.log(`[倒數] 倒數結束，觸發狀態變更 from ${gameState.status}`);
      if (onStatusChange) {
        // 只觸發一次狀態變更
        onStatusChange(gameState.status === 'betting' ? 'drawing' : 'betting');
      }
    }
  }, [gameState]); // 依賴整個 gameState 物件

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (displaySeconds <= 10) return 'text-red-400';
    if (displaySeconds <= 30) return 'text-yellow-400';
    return 'text-white';
  };

  const getTimerSize = (): string => {
    if (displaySeconds <= 10) return 'text-2xl font-bold';
    return 'text-xl font-semibold';
  };

  const isDrawing = gameState?.status === 'drawing';

  // Get status text based on game state
  const getStatusText = () => {
    if (isDrawing) {
      if (displaySeconds <= 0) {
        return '开奖完成';
      }
      return `开奖中 (${displaySeconds}秒)`;
    }
    if (displaySeconds <= 0) {
      return '投注已关闭';
    }
    if (displaySeconds <= 10) {
      return '即将停止投注！';
    }
    return '投注开放中';
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`countdown-timer ${getTimerColor()} ${getTimerSize()} transition-all duration-300`}>
        {displayTime}
      </div>
      
      {/* Progress bar */}
      <div className="w-24 h-1 bg-gray-600 rounded-full mt-2 overflow-hidden">
        <div 
          className={`h-full transition-all duration-100 ease-linear ${
            isDrawing ? 'bg-purple-400' :
            displaySeconds <= 10 ? 'bg-red-400' : 
            displaySeconds <= 30 ? 'bg-yellow-400' : 'bg-green-400'
          }`}
          style={{ 
            width: isDrawing 
              ? `${Math.max(0, (displaySeconds / 15) * 100)}%`
              : `${Math.max(0, (displaySeconds / 60) * 100)}%` 
          }}
        />
      </div>
      
      {/* Status indicator */}
      <div className="text-xs mt-1 text-gray-300">
        {getStatusText()}
      </div>
    </div>
  );
}