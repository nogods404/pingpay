import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	Send,
	Plus,
	History,
	Wallet,
	ChevronRight,
	Copy,
	Check,
	X,
	Loader2,
	ExternalLink,
	CheckCheck,
	Link2,
	LogOut,
	Download,
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { api } from "../utils/api";
import ConfirmModal from "../components/ConfirmModal";
import AddFundsModal from "../components/AddFundsModal";

export default function HomePage() {
	const navigate = useNavigate();
	const {
		wallet,
		connectedAddress,
		loading,
		connectWallet,
		disconnectWallet,
		ensureCorrectChain,
		refreshBalance,
		transfers,
		loadTransfers,
		userHandle,
		saveUserHandle,
	} = useWallet();
	const [command, setCommand] = useState("");
	const [parsedCommand, setParsedCommand] = useState(null);
	const [preparedTransfer, setPreparedTransfer] = useState(null);
	const [showConfirm, setShowConfirm] = useState(false);
	const [showAddFunds, setShowAddFunds] = useState(false);
	const [showHandlePrompt, setShowHandlePrompt] = useState(false);
	const [handleInput, setHandleInput] = useState("");
	const [sending, setSending] = useState(false);
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState("");
	const [recentTransfer, setRecentTransfer] = useState(null);
	const inputRef = useRef(null);

	useEffect(() => {
		if (connectedAddress) {
			loadTransfers();
		}
	}, [connectedAddress]);

	// Auto-refresh balance
	useEffect(() => {
		if (connectedAddress) {
			const interval = setInterval(refreshBalance, 30000);
			return () => clearInterval(interval);
		}
	}, [connectedAddress]);

	async function handleConnect() {
		try {
			setError("");
			await connectWallet();
		} catch (err) {
			setError(err.message);
		}
	}

	function handleSaveHandle() {
		if (handleInput.trim()) {
			saveUserHandle(handleInput.trim());
			setShowHandlePrompt(false);
		}
	}

	async function handleCommandSubmit(e) {
		e.preventDefault();
		setError("");

		if (!command.trim()) return;

		if (!connectedAddress) {
			setError("Please connect your wallet first");
			return;
		}

		setParsing(true);
		try {
			const result = await api.parseCommand(command);
			setParsedCommand(result.parsed);

			// Prepare the transfer to get recipient address
			const prepared = await api.prepareTransfer({
				recipient: result.parsed.recipient,
				amount: result.parsed.amount,
				senderAddress: connectedAddress,
				senderHandle: userHandle,
			});

			setPreparedTransfer(prepared.transfer);
			setShowConfirm(true);
		} catch (err) {
			setError(err.message);
		} finally {
			setParsing(false);
		}
	}

	// USDC Contract address on Arbitrum Sepolia
	const USDC_ADDRESS = "0x0050EAB3c59C945aE92858121c88752e8871185D";

	// ERC20 transfer function signature: transfer(address,uint256)
	const ERC20_TRANSFER_ABI = "0xa9059cbb";

	async function handleConfirmSend() {
		if (!parsedCommand || !preparedTransfer) return;

		setSending(true);
		setError("");

		try {
			// Ensure user is on Arbitrum Sepolia before sending
			await ensureCorrectChain();

			// For USDC ERC20 transfer
			const amount = parsedCommand.amount;
			// USDC has 6 decimals
			const amountInUnits = BigInt(Math.floor(amount * 1e6));

			// Encode the transfer function call
			// transfer(address to, uint256 amount)
			const toAddressPadded = preparedTransfer.recipientAddress
				.slice(2)
				.toLowerCase()
				.padStart(64, "0");
			const amountPadded = amountInUnits.toString(16).padStart(64, "0");
			const data = ERC20_TRANSFER_ABI + toAddressPadded + amountPadded;

			// Send ERC20 transfer transaction via MetaMask
			const txHash = await window.ethereum.request({
				method: "eth_sendTransaction",
				params: [
					{
						from: connectedAddress,
						to: USDC_ADDRESS,
						data: data,
					},
				],
			});

			// Confirm the transfer with backend (verifies on-chain, updates DB, sends Telegram)
			const result = await api.confirmTransfer(
				preparedTransfer.id,
				txHash,
				connectedAddress,
			);

			setRecentTransfer({
				...result.transfer,
				amount: parsedCommand.amount,
				recipient: parsedCommand.recipient,
			});
			setShowConfirm(false);
			setCommand("");
			setParsedCommand(null);
			setPreparedTransfer(null);
			refreshBalance();
			loadTransfers();
		} catch (err) {
			console.error("Send error:", err);
			setError(err.message || "Transaction failed");
		} finally {
			setSending(false);
		}
	}

	// Not connected state
	if (!connectedAddress) {
		return (
			<div className="min-h-screen flex flex-col safe-top safe-bottom">
				<header className="px-4 pt-4 pb-2">
					<div className="flex items-center gap-2">
						<img src="/logo.svg" alt="PingPay" className="w-8 h-8" />
						<span className="text-xl font-bold gradient-text">PingPay</span>
					</div>
				</header>

				<div className="flex-1 flex flex-col items-center justify-center p-4">
					<div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500/30 to-indigo-500/30 flex items-center justify-center mb-6">
						<Wallet className="w-10 h-10 text-primary-400" />
					</div>

					<h1 className="text-2xl font-bold mb-2 text-center">
						Send USDC via Telegram
					</h1>
					<p className="text-dark-400 text-center mb-8 max-w-xs">
						Connect your wallet to send USDC to anyone using their Telegram
						handle
					</p>

					{error && (
						<div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-xs w-full">
							{error}
						</div>
					)}

					<button
						onClick={handleConnect}
						disabled={loading}
						className="px-6 py-4 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
					>
						{loading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<Link2 className="w-5 h-5" />
						)}
						Connect Wallet
					</button>

					<p className="text-xs text-dark-500 mt-4">
						Supports MetaMask on Arbitrum Sepolia
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col safe-top safe-bottom">
			{/* Header */}
			<header className="px-4 pt-4 pb-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src="/logo.svg" alt="PingPay" className="w-8 h-8" />
						<span className="text-xl font-bold gradient-text">PingPay</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => navigate("/receive")}
							className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
							title="Receive & Withdraw"
						>
							<Download className="w-5 h-5" />
						</button>
						<button
							onClick={() => navigate("/history")}
							className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
							title="History"
						>
							<History className="w-5 h-5" />
						</button>
						<button
							onClick={disconnectWallet}
							className="p-2 rounded-full glass hover:bg-red-500/20 transition-colors text-dark-400 hover:text-red-400"
							title="Disconnect"
						>
							<LogOut className="w-5 h-5" />
						</button>
					</div>
				</div>
			</header>

			{/* Wallet Card */}
			<div className="px-4 py-4">
				<div className="glass rounded-2xl p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center">
								<Wallet className="w-5 h-5 text-white" />
							</div>
							<div>
								<p className="text-sm text-dark-400">
									{userHandle ? `@${userHandle}` : "Connected Wallet"}
								</p>
								<p className="text-xs text-dark-500 font-mono">
									{wallet?.address?.slice(0, 6)}...{wallet?.address?.slice(-4)}
								</p>
							</div>
						</div>
						<div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
							Arbitrum
						</div>
					</div>

					<div className="flex items-end justify-between">
						<div>
							<p className="text-sm text-dark-400 mb-1">USDC Balance</p>
							<p className="text-3xl font-bold">
								{parseFloat(wallet?.usdcBalance || 0).toFixed(2)} USDC
							</p>
						</div>
						<button
							onClick={() => setShowAddFunds(true)}
							className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary-500/20 text-primary-400 text-sm font-medium hover:bg-primary-500/30 transition-colors"
						>
							<Plus className="w-4 h-4" />
							Add Funds
						</button>
					</div>
				</div>
			</div>

			{/* Recent Transfer Success */}
			{recentTransfer && (
				<div className="px-4 mb-4 animate-fade-in">
					<div className="glass rounded-2xl p-4 border-emerald-500/30">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
									<Check className="w-5 h-5 text-emerald-400" />
								</div>
								<div>
									<p className="font-medium">
										Sent {recentTransfer.amount} USDC
									</p>
									<p className="text-sm text-dark-400">
										to @{recentTransfer.recipient}
									</p>
								</div>
							</div>
							<button
								onClick={() => setRecentTransfer(null)}
								className="p-1 rounded-full hover:bg-white/10"
							>
								<X className="w-4 h-4 text-dark-400" />
							</button>
						</div>
						<a
							href={recentTransfer.explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 mt-3 text-xs text-primary-400 hover:underline"
						>
							View on Explorer <ExternalLink className="w-3 h-3" />
						</a>
					</div>
				</div>
			)}

			{/* Chat Input */}
			<div className="flex-1 px-4 flex flex-col">
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-dark-400 mb-2">Type a command like:</p>
						<p className="text-lg font-mono text-primary-400">
							"send 10 usdc to @alice"
						</p>
					</div>
				</div>

				{/* Recent Transfers Preview */}
				{transfers.length > 0 && (
					<div className="mb-4">
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-dark-400">Recent</p>
							<button
								onClick={() => navigate("/history")}
								className="text-xs text-primary-400 flex items-center gap-1"
							>
								See all <ChevronRight className="w-3 h-3" />
							</button>
						</div>
						<div className="space-y-2">
							{transfers.slice(0, 2).map((tx) => (
								<TransferItem key={tx.id} transfer={tx} />
							))}
						</div>
					</div>
				)}
			</div>

			{/* Input Area */}
			<div className="px-4 pb-4">
				{error && (
					<div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
						{error}
					</div>
				)}

				<form onSubmit={handleCommandSubmit}>
					<div className="glass rounded-2xl p-2 flex items-center gap-2">
						<input
							ref={inputRef}
							type="text"
							value={command}
							onChange={(e) => setCommand(e.target.value)}
							placeholder="send 10 usdc to @username"
							className="flex-1 bg-transparent px-3 py-3 text-white placeholder-dark-500 outline-none font-mono"
							disabled={parsing}
						/>
						<button
							type="submit"
							disabled={!command.trim() || parsing}
							className="p-3 rounded-xl bg-primary-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
						>
							{parsing ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Send className="w-5 h-5" />
							)}
						</button>
					</div>
					{parsing && (
						<p className="text-center text-dark-400 text-sm mt-2 animate-pulse">
							Understanding your command...
						</p>
					)}
				</form>
			</div>

			{/* Modals */}
			{showConfirm && parsedCommand && (
				<ConfirmModal
					parsed={parsedCommand}
					preparedTransfer={preparedTransfer}
					sending={sending}
					onConfirm={handleConfirmSend}
					onClose={() => {
						setShowConfirm(false);
						setParsedCommand(null);
						setPreparedTransfer(null);
					}}
				/>
			)}

			{showAddFunds && (
				<AddFundsModal
					address={wallet?.address}
					onClose={() => setShowAddFunds(false)}
				/>
			)}

			{/* Handle Prompt Modal */}
			{showHandlePrompt && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
					<div className="w-full max-w-lg glass rounded-t-3xl p-6 animate-slide-up safe-bottom">
						<h2 className="text-xl font-bold mb-2">Set Your Telegram Handle</h2>
						<p className="text-dark-400 text-sm mb-4">
							This helps recipients know who sent them funds
						</p>

						<div className="glass rounded-xl p-3 mb-4">
							<input
								type="text"
								value={handleInput}
								onChange={(e) => setHandleInput(e.target.value)}
								placeholder="@yourusername"
								className="w-full bg-transparent text-white placeholder-dark-500 outline-none"
							/>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setShowHandlePrompt(false)}
								className="flex-1 py-3 rounded-xl glass text-dark-300 font-medium"
							>
								Skip
							</button>
							<button
								onClick={handleSaveHandle}
								className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function TransferItem({ transfer }) {
	// History only shows transfers the user SENT
	return (
		<div className="glass rounded-xl p-3 flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/20 text-red-400">
					<Send className="w-4 h-4" />
				</div>
				<div>
					<p className="text-sm font-medium">To @{transfer.recipientHandle}</p>
					<p className="text-xs text-dark-400">
						{new Date(transfer.createdAt).toLocaleDateString()}
					</p>
				</div>
			</div>
			<div className="text-right">
				<p className="font-medium text-red-400">
					-{parseFloat(transfer.amount).toFixed(2)} USDC
				</p>
				<span className="text-xs text-emerald-400 flex items-center gap-0.5">
					<CheckCheck className="w-3 h-3" /> Sent
				</span>
			</div>
		</div>
	);
}
