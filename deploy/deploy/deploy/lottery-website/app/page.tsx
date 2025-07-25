'use client';

import React, { useState, useEffect } from 'react';
import CountdownTimer from '@/components/countdown-timer';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs timezone plugin
dayjs.extend(utc);
dayjs.extend(timezone);

// Set Taipei timezone
const TAIPEI_TIMEZONE = 'Asia/Taipei';

interface DrawResult {
  issue: string;
  date: string;
  numbers: number[];
  timestamp: number;
  block_height?: string;
  block_hash?: string;
}

interface GameState {
  current_period: string;
  countdown_seconds: number;
  last_result: number[];
  status: string;
  server_time: string;
  next_draw_time: string;
  current_block_height?: string;
  current_block_hash?: string;
}

export default function Racing10Page() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [latestDraw, setLatestDraw] = useState<DrawResult | null>(null);
  const [drawHistory, setDrawHistory] = useState<DrawResult[]>([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().tz(TAIPEI_TIMEZONE).format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch game state
  const fetchGameState = async () => {
    try {
      const response = await fetch('/api/game-state');
      const data = await response.json();
      
      if (data.success) {
        setGameState(data.data);
      } else {
        console.error('Failed to fetch game state:', data.message);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  // Fetch latest draw
  const fetchLatestDraw = async () => {
    try {
      const response = await fetch('/api/latest-draw');
      const data = await response.json();
      
      if (data.success) {
        setLatestDraw(data.data);
      } else {
        console.error('Failed to fetch latest draw:', data.message);
      }
    } catch (error) {
      console.error('Error fetching latest draw:', error);
    }
  };

  // Fetch draw history
  const fetchDrawHistory = async (date?: string) => {
    try {
      // If no date is provided, use today's date (selectedDate)
      const dateToFetch = date || selectedDate;
      const url = `/api/draw-history?date=${dateToFetch}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setDrawHistory(data.data);
      } else {
        console.error('Failed to fetch draw history:', data.message);
        setDrawHistory([]);
      }
    } catch (error) {
      console.error('Error fetching draw history:', error);
      setDrawHistory([]);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await Promise.all([
          fetchGameState(),
          fetchLatestDraw(),
          fetchDrawHistory()
        ]);
      } catch (error) {
        setError('Failed to load lottery data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-refresh game state every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchGameState();
      fetchLatestDraw();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle date change
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    fetchDrawHistory(newDate);
  };

  // Handle countdown complete
  const handleCountdownComplete = () => {
    // Refresh data when countdown completes
    setTimeout(() => {
      fetchGameState();
      fetchLatestDraw();
      fetchDrawHistory();
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lottery data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <header className="bg-purple-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Online Lottery Logo */}
          <div className="flex items-center">
            <div className="flex">
              <span className="bg-blue-500 text-white text-sm font-bold px-2 py-1 rounded-l">O</span>
              <span className="bg-orange-500 text-white text-sm font-bold px-2 py-1">n</span>
              <span className="bg-yellow-500 text-white text-sm font-bold px-2 py-1">l</span>
              <span className="bg-green-500 text-white text-sm font-bold px-2 py-1">i</span>
              <span className="bg-red-500 text-white text-sm font-bold px-2 py-1">n</span>
              <span className="bg-blue-600 text-white text-sm font-bold px-2 py-1 rounded-r">e</span>
            </div>
            <div className="ml-2">
              <div className="text-cyan-300 font-bold text-lg">LOTTERY</div>
            </div>
          </div>
        </div>
      </header>

      {/* FS Racing Banner */}
      <section className="bg-gradient-to-r from-yellow-400 to-yellow-500 py-16 text-center">
        <h1 className="text-6xl font-bold text-purple-800">FS <span className="text-blue-800">RACING</span></h1>
      </section>

      {/* Current Winning Numbers */}
      <section className="bg-blue-600 py-8 px-4 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                WINNING NUMBERS: {latestDraw?.issue || 'Loading...'}, {latestDraw?.date || ''}
              </h2>
              {latestDraw?.block_height && (
                <div className="mt-2 text-sm opacity-90">
                  <span className="inline-flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Block Height: {latestDraw.block_height}
                  </span>
                  {latestDraw.block_hash && (
                    <span className="ml-4 text-xs opacity-75" title={latestDraw.block_hash}>
                      Hash: {latestDraw.block_hash.substring(0, 8)}...
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm mb-1">Next Lottery Draw :</div>
              {gameState && (
                <CountdownTimer 
                  initialSeconds={gameState.countdown_seconds}
                  onComplete={handleCountdownComplete}
                />
              )}
              {gameState?.current_block_height && (
                <div className="text-xs mt-2 opacity-75">
                  Current Block: {gameState.current_block_height}
                </div>
              )}
            </div>
          </div>

          {/* Winning Numbers Display */}
          <div className="flex justify-center space-x-4">
            {(latestDraw?.numbers || gameState?.last_result || [1,2,3,4,5,6,7,8,9,10]).map((number, index) => (
              <div key={`winning-${index}`} className="bg-white text-blue-600 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg number-ball">
                {number.toString().padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blockchain Security Notice */}
      <section className="bg-green-50 py-6 px-4 border-t border-b border-green-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-green-800 mb-1">Blockchain Verification</h3>
              <p className="text-green-700 text-sm">
                Every draw result is recorded on the blockchain with block height and hash values ensuring results cannot be tampered with.
                You can verify the authenticity and fairness of each draw through the block height.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Results Table */}
      <section className="py-8 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">CHECK LOTTERY RESULTS ONLINE</h3>
            <p className="text-gray-600 mb-4">Find results, see winning numbers, or select from the list below to check results for all lotteries at the Lottery.</p>

            <div className="flex items-center space-x-4 mb-6">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="border border-gray-300 px-3 py-2 rounded"
              />
              <button 
                onClick={() => fetchDrawHistory(selectedDate)}
                className="bg-gray-100 p-2 rounded hover:bg-gray-200"
              >
                🔍
              </button>
              <span className="text-sm text-gray-500">
                Showing results for {selectedDate}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {drawHistory.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border p-3 text-left text-blue-600 font-semibold">ISSUE NO</th>
                    <th className="border p-3 text-left text-blue-600 font-semibold">DATE</th>
                    <th className="border p-3 text-left text-blue-600 font-semibold">WINNING NUMBERS</th>
                    <th className="border p-3 text-left text-blue-600 font-semibold">BLOCK HEIGHT</th>
                  </tr>
                </thead>
                <tbody>
                  {drawHistory.map((result) => (
                    <tr key={result.issue} className="hover:bg-gray-50">
                      <td className="border p-3 text-blue-600">{result.issue}</td>
                      <td className="border p-3 text-blue-600">{result.date}</td>
                      <td className="border p-3">
                        <div className="flex space-x-1">
                          {result.numbers.map((num, index) => (
                            <span key={`${result.issue}-${index}`} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-semibold">
                              {num.toString().padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="border p-3 text-gray-600">
                        {result.block_height ? (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span className="font-mono text-sm">{result.block_height}</span>
                            {result.block_hash && (
                              <span className="ml-2 text-xs text-gray-500" title={result.block_hash}>
                                ({result.block_hash.substring(0, 6)}...)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No results found for {selectedDate}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer Promotion */}
      <footer className="bg-purple-700 py-12 px-4 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-8">
            <div className="relative">
              <div className="w-24 h-24 relative">
                {/* Money stack illustration */}
                <div className="absolute inset-0 bg-green-500 rounded-lg transform rotate-12 opacity-80" />
                <div className="absolute inset-0 bg-green-400 rounded-lg transform rotate-6 opacity-90" />
                <div className="absolute inset-0 bg-green-300 rounded-lg" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-green-800 font-bold text-xl">$</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">Don&apos;t Waste Your Time! Win Today!</h2>
              <h3 className="text-xl text-cyan-300 mb-4">When To Play</h3>
              <p className="text-lg">24/7 - Play Anytime!</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Copyright */}
      <div className="bg-gray-800 py-4 text-center text-gray-400 text-sm">
        FS Racing All rights reserved.
      </div>
    </div>
  );
} 