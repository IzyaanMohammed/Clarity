import { useNavigate } from 'react-router-dom';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Check, Crown } from 'lucide-react';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export const PremiumModal = ({ isOpen, onClose, feature }: PremiumModalProps) => {
  const navigate = useNavigate();
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
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Crown className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8C5A35] mb-2">Paid feature</p>
          <p className="text-gray-600 ">
            {feature} is available on paid plans. Connect billing in Settings to unlock it when your account is ready.
          </p>
        </div>

        <div className="space-y-3">
          {features.map((feat, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-[#8C5A35] rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-gray-700 ">{feat}</span>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-black text-gray-900 mb-1">
            50 AED<span className="text-lg font-normal text-gray-500">/month</span>
          </div>
          <p className="text-sm text-gray-600 ">Pro Max: 350 AED/month</p>
        </div>

        <div className="space-y-2">
          <Button fullWidth size="lg" variant="primary" onClick={() => navigate('/settings')}>
            Go to Billing
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      </div>
    </Modal>
  );
};
