import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGameState } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching current game state...');
    
    const gameState = await getCurrentGameState();
    
    if (!gameState) {
      return NextResponse.json({
        success: false,
        message: 'No game state found'
      }, { status: 404 });
    }

    // Convert the countdown to actual time based on server time
    const now = new Date();
    const timeRemaining = Math.max(0, gameState.countdown_seconds);
    
    return NextResponse.json({
      success: true,
      data: {
        current_period: gameState.current_period,
        countdown_seconds: timeRemaining,
        last_result: gameState.last_result,
        status: gameState.status,
        server_time: now.toISOString(),
        next_draw_time: new Date(now.getTime() + (timeRemaining * 1000)).toISOString(),
        current_block_height: gameState.current_block_height,
        current_block_hash: gameState.current_block_hash
      }
    });
    
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 