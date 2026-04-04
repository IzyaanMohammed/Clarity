export const LoadingSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  );
};

export const CardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-[#1a1d26] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
      <LoadingSkeleton className="h-6 w-1/3 mb-4" />
      <LoadingSkeleton className="h-4 w-full mb-2" />
      <LoadingSkeleton className="h-4 w-2/3" />
    </div>
  );
};
