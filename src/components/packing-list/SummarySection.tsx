"use client";
import React from 'react';

interface SummarySectionProps {
  totalPallets: number;
  totalBoxes: number;
  totalNetWeight: number | string;
  totalGrossWeight: number | string;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  totalPallets,
  totalBoxes,
  totalNetWeight,
  totalGrossWeight,
}) => {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
      <div>
        <p className="font-medium text-gray-600">Total Pallets:</p>
        <p className="text-lg font-bold text-primary">{totalPallets}</p>
      </div>
      <div>
        <p className="font-medium text-gray-600">Total Boxes:</p>
        <p className="text-lg font-bold text-primary">{totalBoxes}</p>
      </div>
      <div>
        <p className="font-medium text-gray-600">Total Net Weight (KG):</p>
        <p className="text-lg font-bold text-primary">{totalNetWeight} kg</p>
      </div>
      <div>
        <p className="font-medium text-gray-600">Total Gross Weight (KG):</p>
        <p className="text-lg font-bold text-primary">{totalGrossWeight} kg</p>
      </div>
    </div>
  );
};
