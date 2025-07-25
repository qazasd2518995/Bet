'use client';

import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  initialSeconds?: number;
  onUpdate?: (seconds: number) => void;
  onComplete?: () => void;
}

export default function CountdownTimer({ 
  initialSeconds = 60, 
  onUpdate,
  onComplete 
}: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setSeconds(initialSeconds);
    setIsActive(true);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds(prevSeconds => {
          const newSeconds = prevSeconds - 1;
          
          // Call update callback
          if (onUpdate) {
            onUpdate(newSeconds);
          }
          
          // Check if countdown completed
          if (newSeconds <= 0) {
            setIsActive(false);
            if (onComplete) {
              onComplete();
            }
          }
          
          return newSeconds;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, seconds, onUpdate, onComplete]);

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (seconds <= 10) return 'text-red-400';
    if (seconds <= 30) return 'text-yellow-400';
    return 'text-white';
  };

  const getTimerSize = (): string => {
    if (seconds <= 10) return 'text-2xl font-bold';
    return 'text-xl font-semibold';
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`countdown-timer ${getTimerColor()} ${getTimerSize()} transition-all duration-300`}>
        {formatTime(Math.max(0, seconds))}
      </div>
      
      {/* Progress bar */}
      <div className="w-24 h-1 bg-gray-600 rounded-full mt-2 overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-linear ${
            seconds <= 10 ? 'bg-red-400' : 
            seconds <= 30 ? 'bg-yellow-400' : 'bg-green-400'
          }`}
          style={{ 
            width: `${Math.max(0, (seconds / 60) * 100)}%` 
          }}
        />
      </div>
      
      {/* Status indicator */}
      <div className="text-xs mt-1 text-gray-300">
        {seconds <= 0 ? 'Drawing...' : 
         seconds <= 10 ? 'Final seconds!' : 
         'Next draw in'}
      </div>
    </div>
  );
} 