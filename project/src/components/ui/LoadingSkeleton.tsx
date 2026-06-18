export const LoadingSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
};

export const CardSkeleton = () => {
  return (
    <div className="bg-[#FCFAF8] rounded-xl  border border-gray-100 p-6">
      <LoadingSkeleton className="h-6 w-1/3 mb-4" />
      <LoadingSkeleton className="h-4 w-full mb-2" />
      <LoadingSkeleton className="h-4 w-2/3" />
    </div>
  );
};
