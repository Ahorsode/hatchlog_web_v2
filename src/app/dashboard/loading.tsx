import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';

export default function DashboardLoading() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-7 px-3 md:px-8 py-5 md:py-10 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-3">
          <div className="h-10 w-64 bg-white/10 rounded-md" />
          <div className="h-3 w-40 bg-white/10 rounded-full" />
        </div>
        <div className="h-12 w-48 bg-emerald-500/10 rounded-md border border-white/5" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white/10 border-white/10 h-32 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-white/10 rounded-full" />
                  <div className="h-8 w-32 bg-white/20 rounded-md" />
                </div>
                <div className="h-12 w-12 bg-white/10 rounded-md border border-white/10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Main Chart Skeleton */}
        <div className="lg:col-span-2 bg-white/10 rounded-lg border border-white/10 h-[500px] backdrop-blur-md overflow-hidden p-7 space-y-5">
          <div className="flex justify-between items-center">
            <div className="h-6 w-48 bg-white/10 rounded-lg" />
            <div className="h-10 w-32 bg-white/10 rounded-md" />
          </div>
          <div className="w-full h-full bg-white/[0.02] rounded-lg" />
        </div>

        {/* Sidebar Widgets Skeleton */}
        <div className="space-y-7">
          <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/10 h-[240px] p-7 space-y-5">
            <div className="h-5 w-32 bg-emerald-500/10 rounded-lg" />
            <div className="space-y-3">
              <div className="h-10 w-48 bg-emerald-500/20 rounded-md" />
              <div className="h-2 w-full bg-white/10 rounded-full" />
              <div className="h-3 w-24 bg-emerald-500/10 rounded-full" />
            </div>
          </div>
          <div className="bg-white/10 rounded-lg border border-white/10 h-[240px] p-7 space-y-5">
            <div className="h-5 w-32 bg-white/10 rounded-lg" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-10 w-10 bg-white/10 rounded-md" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-white/10 rounded-full" />
                    <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
