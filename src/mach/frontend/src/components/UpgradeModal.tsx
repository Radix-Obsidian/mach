import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: string;
  missionsUsed: number;
  missionsQuota: number;
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentTier,
  missionsUsed,
  missionsQuota,
}: UpgradeModalProps) {
  const handleUpgrade = () => {
    // Redirect to settings page (Stripe will be added in Vertical Slice 4)
    window.location.href = "/app/settings";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quota Exceeded</DialogTitle>
          <DialogDescription>
            You've reached your monthly mission limit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <span className="font-semibold">Current Plan:</span>{" "}
              <span className="capitalize">{currentTier}</span>
            </p>
            <p className="text-sm text-slate-300 mt-1">
              <span className="font-semibold">Missions Used:</span> {missionsUsed}/
              {missionsQuota}
            </p>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <h4 className="font-semibold text-white mb-3">Upgrade Options</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Starter Plan</span>
                <span className="font-semibold">$29/mo</span>
              </div>
              <p className="text-slate-400 text-xs">50 missions per month</p>

              <div className="flex justify-between items-center mt-3">
                <span className="text-slate-300">Pro Plan</span>
                <span className="font-semibold">$99/mo</span>
              </div>
              <p className="text-slate-400 text-xs">500 missions per month</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpgrade} className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
              View Plans
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
