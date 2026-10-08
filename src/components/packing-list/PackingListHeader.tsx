import React from 'react';

interface PackingListHeaderProps {
  logoUrl?: string;
  companyName: string;
  companyAddress: string;
  rcNumber: string;
  expeditionDate: string;
}

export const PackingListHeader: React.FC<PackingListHeaderProps> = ({
  logoUrl,
  companyName,
  companyAddress,
  rcNumber,
  expeditionDate,
}) => {
  return (
    <div className="grid grid-cols-3 gap-4 border-b pb-4 mb-6 items-center">
      <div className="col-span-1 flex items-center">
        {logoUrl && (
          <img src={logoUrl} alt="Company Logo" className="h-12 w-auto mr-2" />
        )}
        <div className="text-sm">
          <div className="font-bold text-lg text-primary">{companyName}</div>
          <div>{companyAddress}</div>
          <div>RC {rcNumber}</div>
        </div>
      </div>
      <div className="col-span-1 text-center">
        <h1 className="text-2xl font-black uppercase tracking-wider text-primary">
          PACKING LIST
        </h1>
      </div>
      <div className="col-span-1 text-right text-sm">
        <div className="font-medium">Expedition Date:</div>
        <div>{expeditionDate}</div>
      </div>
    </div>
  );
};
