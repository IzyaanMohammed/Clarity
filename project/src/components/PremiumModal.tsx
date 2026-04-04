import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Check, Crown } from 'lucide-react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export const PremiumModal = ({ isOpen, onClose, feature }: PremiumModalProps) => {
  const features = [
    'Unlimited questions per day',
    'Unlimited file uploads',
    'Practice tests unlocked',
    'Full progress analytics',
    'Weekly parent report',
    'Priority support',
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Premium">
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {feature} is a premium feature. Upgrade now to unlock unlimited access!
          </p>
        </div>

        <div className="space-y-3">
          {features.map((feat, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-[#1D9E75] rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{feat}</span>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            ₹499<span className="text-lg font-normal text-gray-500">/month</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">or ₹3,999/year (save 33%)</p>
        </div>

        <div className="space-y-2">
          <Button fullWidth size="lg" variant="primary">
            Upgrade Now
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      </div>
    </Modal>
  );
};
