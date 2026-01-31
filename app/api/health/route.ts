import { NextResponse } from 'next/server';
import config from '@/lib/config';

export async function GET() {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.app.environment,
      version: config.app.version,
      uptime: process.uptime(),
      checks: {
        database: 'healthy', // Add actual database check if needed
        api: 'healthy',      // Add actual API check if needed
        stellar: 'healthy'   // Add actual Stellar network check if needed
      }
    };

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { status: 500 }
    );
  }
}