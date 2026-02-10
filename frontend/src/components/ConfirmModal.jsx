import { X, Loader2, AlertCircle, Wallet } from "lucide-react";

export default function ConfirmModal({
	parsed,
	preparedTransfer,
	sending,
	onConfirm,
	onClose,
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
			<div className="w-full max-w-lg glass rounded-t-3xl p-6 animate-slide-up safe-bottom">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold">Confirm Payment</h2>
					<button
						onClick={onClose}
						className="p-2 rounded-full hover:bg-white/10 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Payment Details */}
				<div className="space-y-4 mb-6">
					<div className="glass rounded-xl p-4">
						<div className="flex items-center justify-between mb-4">
							<span className="text-dark-400">Amount</span>
							<span className="text-2xl font-bold">{parsed.amount} USDC</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-dark-400">Recipient</span>
							<span className="font-mono text-primary-400">
								@{parsed.recipient}
							</span>
						</div>
					</div>

					{preparedTransfer && (
						<div className="glass rounded-xl p-4">
							<div className="flex items-center justify-between mb-2">
								<span className="text-dark-400">Send To Wallet</span>
								<span className="text-xs font-mono text-dark-300 truncate max-w-[200px]">
									{preparedTransfer.recipientAddress}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-dark-400">Network</span>
								<span className="text-sm">Arbitrum Sepolia</span>
							</div>
						</div>
					)}
				</div>

				{/* Info Banner */}
				<div className="flex items-start gap-3 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 mb-6">
					<AlertCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
					<div className="text-sm text-dark-300">
						<p className="mb-1">
							<strong>You'll sign this transaction in MetaMask.</strong>
						</p>
						<p>
							The recipient will receive a Telegram message with a claim link.
							They don't need a wallet to receive funds.
						</p>
					</div>
				</div>

				{/* Actions */}
				<div className="flex gap-3">
					<button
						onClick={onClose}
						disabled={sending}
						className="flex-1 py-4 rounded-xl glass text-dark-300 font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						disabled={sending}
						className="flex-1 py-4 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
					>
						{sending ? (
							<>
								<Loader2 className="w-5 h-5 animate-spin" />
								Sending...
							</>
						) : (
							<>
								<Wallet className="w-5 h-5" />
								Sign & Send
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
