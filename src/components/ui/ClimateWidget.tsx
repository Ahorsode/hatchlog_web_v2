import React from 'react';
import { ThermometerSun, Droplets, AlertTriangle } from 'lucide-react';
import { ClimateLog } from '@/types/poultry';

interface ClimateWidgetProps {
  currentClimate: ClimateLog;
}

export const ClimateWidget: React.FC<ClimateWidgetProps> = ({ currentClimate }) => {
  const { temperature, humidity } = currentClimate;

  // Simple thresholds for demonstration
  const isHeatStress = temperature > 30; // Anything above 30C is heat stress
  const isOptimal = temperature >= 24 && temperature <= 28;

  const getStatusColor = () => {
    if (isHeatStress) return 'bg-red-100 text-red-800 border-red-200';
    if (isOptimal) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  const getStatusText = () => {
    if (isHeatStress) return 'Heat Stress Risk';
    if (isOptimal) return 'Optimal';
    return 'Monitor';
  };

  return (
    <div className={`flex items-center space-x-3 border px-3 py-2 rounded-lg shadow-sm transition-colors ${getStatusColor()}`}>
      <div className="flex items-center space-x-1">
        <ThermometerSun className="w-5 h-5" />
        <span className="font-semibold">{temperature.toFixed(1)}°C</span>
      </div>
      <div className="w-px h-6 bg-current opacity-20" />
      <div className="flex items-center space-x-1">
        <Droplets className="w-5 h-5" />
        <span className="font-semibold">{humidity}%</span>
      </div>
      <div className="w-px h-6 bg-current opacity-20" />
      <div className="flex items-center space-x-1 text-sm font-medium">
        {isHeatStress && <AlertTriangle className="w-4 h-4 mr-1" />}
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
};
