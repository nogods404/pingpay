import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	ArrowLeft,
	Wallet,
	Loader2,
	ArrowRight,
	ExternalLink,
	AlertCircle,
	CheckCircle,
	Copy,
	Check,
	Download,
} from "lucide-react";
import { api } from "../utils/api";
import { useWallet } from "../context/WalletContext";

export default function ReceivePage() {
	const navigate = useNavigate();
	const { connectedAddress, ensureCorrectChain } = useWallet();
	const [handle, setHandle] = useState(
		localStorage.getItem("pingpay_claim_handle") || "",
	);
	const [verified, setVerified] = useState(false);
	const [loading, setLoading] = useState(false);
	const [walletInfo, setWalletInfo] = useState(null);

	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const [withdrawing, setWithdrawing] = useState(false);
	const [withdrawAddress, setWithdrawAddress] = useState("");
	const [showWithdraw, setShowWithdraw] = useState(false);

	useEffect(() => {
		// Auto-check if handle is saved
		if (handle) {
			checkHandle();
		}
	}, []);

	async function checkHandle() {
		if (!handle.trim()) {
			setError("Please enter your Telegram handle");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const cleanHandle = handle.replace("@", "").toLowerCase();

			// Get wallet info for this handle
			const walletData = await api.getClaimWallet(cleanHandle);
			setWalletInfo(walletData.wallet);

			// Save handle for next time
			localStorage.setItem("pingpay_claim_handle", cleanHandle);
			setVerified(true);
		} catch (err) {
			if (err.message.includes("not found")) {
				setError(
					"No wallet found for this handle. You may not have received any funds yet.",
				);
			} else {
				setError(err.message);
			}
			setVerified(false);
		} finally {
			setLoading(false);
		}
	}

	async function handleWithdraw() {
		// Use custom address or connected wallet
		const toAddress = withdrawAddress.trim() || connectedAddress;

		if (!toAddress) {
			setError("Please enter a destination address or connect your wallet");
			return;
		}

		// Validate address format
		if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
			setError("Invalid Ethereum address");
			return;
		}

		setWithdrawing(true);
		setError("");

		try {
			// Always withdraw max to avoid gas calculation issues
			const result = await api.withdraw(
				handle.replace("@", "").toLowerCase(),
				toAddress,
				null, // amount not needed for withdrawMax
				true, // withdrawMax = true
			);

			// Refresh wallet info
			const walletData = await api.getClaimWallet(
				handle.replace("@", "").toLowerCase(),
			);
			setWalletInfo(walletData.wallet);
			setShowWithdraw(false);
			setWithdrawAddress("");
		} catch (err) {
			setError(err.message);
		} finally {
			setWithdrawing(false);
		}
	}

	function copyAddress() {
		if (walletInfo?.address) {
			navigator.clipboard.writeText(walletInfo.address);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}

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
					<h1 className="text-xl font-bold">Receive & Withdraw</h1>
				</div>
			</header>

			<div className="flex-1 px-4 py-4">
				{!verified ? (
					/* Handle Verification Form */
					<div className="glass rounded-2xl p-6">
						<div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
							<Wallet className="w-8 h-8 text-primary-400" />
						</div>

						<h2 className="text-xl font-bold text-center mb-2">
							Check Your Balance
						</h2>
						<p className="text-dark-400 text-center mb-6 text-sm">
							Enter your Telegram handle to see funds you've received
						</p>

						{error && (
							<div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
								{error}
							</div>
						)}

						<div className="glass rounded-xl p-3 mb-4">
							<input
								type="text"
								value={handle}
								onChange={(e) => setHandle(e.target.value)}
								placeholder="@yourusername"
								className="w-full bg-transparent text-white placeholder-dark-500 outline-none"
							/>
						</div>

						<button
							onClick={checkHandle}
							disabled={loading || !handle.trim()}
							className="w-full py-4 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
						>
							{loading ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<>
									Check Balance <ArrowRight className="w-5 h-5" />
								</>
							)}
						</button>
					</div>
				) : (
					/* Wallet Info & Withdraw */
					<div className="space-y-4">
						{/* Balance Card */}
						<div className="glass rounded-2xl p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<CheckCircle className="w-5 h-5 text-emerald-400" />
									<span className="text-dark-400">
										@{handle.replace("@", "")}
									</span>
								</div>
								<button
									onClick={() => {
										setVerified(false);
										localStorage.removeItem("pingpay_claim_handle");
									}}
									className="text-xs text-dark-500 hover:text-dark-300"
								>
									Change
								</button>
							</div>

							<p className="text-sm text-dark-400 mb-1">Available Balance</p>
							<p className="text-4xl font-bold gradient-text mb-2">
								{parseFloat(walletInfo?.balance || 0).toFixed(2)} USDC
							</p>

							{/* Wallet Address */}
							<div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-dark-800/50">
								<span className="text-xs text-dark-400 flex-1 font-mono truncate">
									{walletInfo?.address}
								</span>
								<button
									onClick={copyAddress}
									className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
								>
									{copied ? (
										<Check className="w-4 h-4 text-emerald-400" />
									) : (
										<Copy className="w-4 h-4 text-dark-400" />
									)}
								</button>
							</div>
						</div>

						{error && (
							<div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
								{error}
							</div>
						)}

						{/* Withdraw Section */}
						{showWithdraw ? (
							<div className="glass rounded-2xl p-6">
								<h3 className="font-semibold mb-4">Withdraw to Wallet</h3>

								<div className="mb-4">
									<label className="text-sm text-dark-400 mb-2 block">
										Destination Address
									</label>
									<div className="glass rounded-xl p-3">
										<input
											type="text"
											value={withdrawAddress}
											onChange={(e) => setWithdrawAddress(e.target.value)}
											placeholder={connectedAddress || "0x..."}
											className="w-full bg-transparent text-white placeholder-dark-500 outline-none font-mono text-sm"
										/>
									</div>
									{connectedAddress && !withdrawAddress && (
										<p className="text-xs text-dark-500 mt-2">
											Leave empty to use connected wallet:{" "}
											{connectedAddress.slice(0, 8)}...
										</p>
									)}
								</div>

								<div className="mb-4 p-3 rounded-xl bg-dark-800/50">
									<p className="text-xs text-dark-400 mb-1">Withdrawing:</p>
									<p className="text-lg font-bold text-primary-400">
										{walletInfo?.balance || "0"} USDC
									</p>
									<p className="text-xs text-dark-500 mt-1">
										(Full USDC balance)
									</p>
								</div>

								<div className="flex gap-3">
									<button
										onClick={() => setShowWithdraw(false)}
										className="flex-1 py-3 rounded-xl glass text-dark-300"
									>
										Cancel
									</button>
									<button
										onClick={handleWithdraw}
										disabled={withdrawing}
										className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
									>
										{withdrawing ? (
											<Loader2 className="w-5 h-5 animate-spin" />
										) : (
											<>
												<Download className="w-4 h-4" />
												Withdraw
											</>
										)}
									</button>
								</div>
							</div>
						) : (
							<button
								onClick={() => setShowWithdraw(true)}
								disabled={
									!walletInfo?.balance || parseFloat(walletInfo?.balance) <= 0
								}
								className="w-full py-4 rounded-xl bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Download className="w-5 h-5" />
								Withdraw to My Wallet
							</button>
						)}

						{/* Refresh Button */}
						<button
							onClick={checkHandle}
							disabled={loading}
							className="w-full py-3 rounded-xl glass text-dark-300 flex items-center justify-center gap-2"
						>
							{loading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								"Refresh Balance"
							)}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
