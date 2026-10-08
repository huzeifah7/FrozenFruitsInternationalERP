import React from 'react';

interface FieldErrorProps {
  message?: string | null | undefined;
}

export const FieldError: React.FC<FieldErrorProps> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="field-error text-[#dc2626] text-[12px] mt-1 leading-[1.2] font-medium">
      {message}
    </p>
  );
};
