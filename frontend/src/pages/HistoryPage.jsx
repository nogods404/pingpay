import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	ArrowLeft,
	Send,
	Check,
	CheckCheck,
	ExternalLink,
	Loader2,
} from "lucide-react";
import { useWallet } from "../context/WalletContext";

export default function HistoryPage() {
	const navigate = useNavigate();
	const { wallet, transfers, loadTransfers, loading } = useWallet();

	useEffect(() => {
		if (wallet?.address) {
			loadTransfers();
		}
	}, [wallet?.address]);

	return (
		<div className="min-h-screen flex flex-col bg-dark-950 safe-top safe-bottom">
			{/* Header */}
			<header className="px-4 pt-4 pb-2">
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate("/")}
						className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
					<h1 className="text-xl font-bold">Sent Transactions</h1>
				</div>
			</header>

			{/* Info Banner */}
			<div className="px-4 py-2">
				<p className="text-xs text-dark-500">
					Shows USDC you've sent. To see received funds, go to Receive page.
				</p>
			</div>

			{/* Transactions List */}
			<div className="flex-1 px-4 pb-4 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="w-8 h-8 animate-spin text-primary-500" />
					</div>
				) : transfers.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
							<Send className="w-8 h-8 text-dark-500" />
						</div>
						<p className="text-dark-400 mb-2">No transactions yet</p>
						<p className="text-dark-500 text-sm">
							Send your first payment to get started
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{transfers.map((tx) => (
							<TransactionCard key={tx.id} transaction={tx} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function TransactionCard({ transaction }) {
	// History only shows SENT transactions
	const statusIcon = {
		pending: <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />,
		confirmed: <CheckCheck className="w-4 h-4 text-emerald-400" />,
		claimed: <CheckCheck className="w-4 h-4 text-emerald-400" />,
		failed: <span className="text-red-400 text-xs">Failed</span>,
	};

	const statusLabel = {
		pending: "Sending...",
		confirmed: "Sent",
		claimed: "Sent",
		failed: "Failed",
	};

	return (
		<div className="glass rounded-2xl p-4">
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/20">
						<Send className="w-5 h-5 text-red-400" />
					</div>
					<div>
						<p className="font-medium">Sent</p>
						<p className="text-sm text-dark-400">
							To @{transaction.recipientHandle}
						</p>
					</div>
				</div>
				<div className="text-right">
					<p className="text-lg font-bold text-red-400">
						-{parseFloat(transaction.amount).toFixed(2)}
					</p>
					<p className="text-xs text-dark-500">USDC</p>
				</div>
			</div>

			<div className="flex items-center justify-between pt-3 border-t border-white/5">
				<div className="flex items-center gap-2">
					<span className="text-xs text-dark-500">Status:</span>
					<div className="flex items-center gap-1">
						{statusIcon[transaction.status]}
						<span className="text-xs text-dark-400">
							{statusLabel[transaction.status] || transaction.status}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className="text-xs text-dark-500">
						{new Date(transaction.createdAt).toLocaleString()}
					</span>

					{transaction.txHash && (
						<a
							href={`https://sepolia.arbiscan.io/tx/${transaction.txHash}`}
							target="_blank"
							rel="noopener noreferrer"
							className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
						>
							<ExternalLink className="w-4 h-4 text-primary-400" />
						</a>
					)}
				</div>
			</div>
		</div>
	);
}
