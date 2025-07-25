import { NextRequest, NextResponse } from 'next/server';
import { getLatestDrawRecords, getDrawRecordsByDate } from '@/lib/database';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs timezone plugin
dayjs.extend(utc);
dayjs.extend(timezone);

// Set Taipei timezone
const TAIPEI_TIMEZONE = 'Asia/Taipei';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log('Fetching draw history...', { date, limit });
    
    let drawRecords;
    
    if (date) {
      // Get records for specific date
      drawRecords = await getDrawRecordsByDate(date);
    } else {
      // Get latest records
      drawRecords = await getLatestDrawRecords(limit);
    }
    
    // Format the response
    const formattedRecords = drawRecords.map(record => ({
      issue: record.period,
      date: dayjs(record.draw_time).tz(TAIPEI_TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
      numbers: record.result,
      timestamp: record.draw_time.getTime(),
      block_height: record.block_height,
      block_hash: record.block_hash
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedRecords,
      total: formattedRecords.length
    });
    
  } catch (error) {
    console.error('Error fetching draw history:', error);
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