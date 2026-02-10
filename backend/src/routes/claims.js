const express = require("express");
const router = express.Router();
const {
	getTransferByClaimToken,
	markTransferClaimed,
	getWalletByHandle,
	getPendingTransfersForRecipient,
} = require("../database");
const {
	getUsdcBalance,
	sendUsdcFromWallet,
	sendMaxUsdcFromWallet,
	getExplorerUrl,
} = require("../services/blockchain");

// GET /api/claims/:token - Get claim info
router.get("/:token", async (req, res) => {
	try {
		const transfer = await getTransferByClaimToken(req.params.token);

		if (!transfer) {
			return res.status(404).json({ error: "Claim not found or expired" });
		}

		const balance = await getUsdcBalance(transfer.recipientAddress);

		res.json({
			success: true,
			claim: {
				id: transfer.transferId,
				amount: transfer.amount,
				senderHandle: transfer.senderHandle,
				recipientHandle: transfer.recipientHandle,
				status: transfer.status,
				claimedAt: transfer.claimedAt,
				recipientAddress: transfer.recipientAddress,
				currentBalance: balance,
				txHash: transfer.txHash,
				explorerUrl: transfer.txHash ? getExplorerUrl(transfer.txHash) : null,
			},
		});
	} catch (error) {
		console.error("Get claim error:", error);
		res.status(500).json({ error: "Failed to get claim info" });
	}
});

// POST /api/claims/:token/verify - Verify telegram handle and claim
router.post("/:token/verify", async (req, res) => {
	const { handle } = req.body;

	if (!handle) {
		return res.status(400).json({ error: "Telegram handle is required" });
	}

	try {
		const transfer = await getTransferByClaimToken(req.params.token);

		if (!transfer) {
			return res.status(404).json({ error: "Claim not found or expired" });
		}

		// Verify handle matches recipient
		const cleanHandle = handle.replace("@", "").toLowerCase();
		if (transfer.recipientHandle.toLowerCase() !== cleanHandle) {
			return res.status(403).json({
				error: "Handle does not match recipient",
			});
		}

		// Check if already claimed
		if (transfer.status === "claimed") {
			const wallet = await getWalletByHandle(cleanHandle);
			const balance = wallet ? await getUsdcBalance(wallet.walletAddress) : "0";

			return res.json({
				success: true,
				alreadyClaimed: true,
				claim: {
					amount: transfer.amount,
					claimedAt: transfer.claimedAt,
				},
				wallet: wallet
					? {
							address: wallet.walletAddress,
							balance,
						}
					: null,
			});
		}

		// Mark as claimed
		await markTransferClaimed(req.params.token);

		// Get wallet info
		const wallet = await getWalletByHandle(cleanHandle);
		const balance = wallet ? await getUsdcBalance(wallet.walletAddress) : "0";

		res.json({
			success: true,
			claimed: true,
			wallet: wallet
				? {
						address: wallet.walletAddress,
						balance,
					}
				: null,
		});
	} catch (error) {
		console.error("Verify claim error:", error);
		res.status(500).json({ error: "Failed to verify claim" });
	}
});

// POST /api/claims/withdraw - Withdraw funds to external address
router.post("/withdraw", async (req, res) => {
	const { handle, toAddress, amount, withdrawMax } = req.body;

	if (!handle || !toAddress) {
		return res
			.status(400)
			.json({ error: "Handle and destination address are required" });
	}

	try {
		const cleanHandle = handle.replace("@", "").toLowerCase();
		const wallet = await getWalletByHandle(cleanHandle);

		if (!wallet) {
			return res
				.status(404)
				.json({ error: "Wallet not found for this handle" });
		}

		// Check USDC balance
		const balance = await getUsdcBalance(wallet.walletAddress);

		if (parseFloat(balance) <= 0) {
			return res.status(400).json({ error: "No USDC balance to withdraw" });
		}

		let result;

		// If withdrawMax is true, send all USDC
		if (withdrawMax) {
			result = await sendMaxUsdcFromWallet(wallet.privateKey, toAddress);
		} else {
			if (!amount) {
				return res
					.status(400)
					.json({ error: "Amount is required when not withdrawing max" });
			}
			if (parseFloat(balance) < parseFloat(amount)) {
				return res.status(400).json({ error: "Insufficient balance" });
			}
			result = await sendUsdcFromWallet(wallet.privateKey, toAddress, amount);
		}

		if (result.success) {
			res.json({
				success: true,
				txHash: result.txHash,
				amount: result.amount,
				explorerUrl: getExplorerUrl(result.txHash),
			});
		} else {
			res
				.status(500)
				.json({ error: "Withdrawal failed", details: result.error });
		}
	} catch (error) {
		console.error("Withdraw error:", error);
		res.status(500).json({ error: "Failed to withdraw funds" });
	}
});

// GET /api/claims/pending/:handle - Get pending claims for a handle
router.get("/pending/:handle", async (req, res) => {
	try {
		const cleanHandle = req.params.handle.replace("@", "").toLowerCase();
		const transfers = await getPendingTransfersForRecipient(cleanHandle);

		res.json({
			success: true,
			pendingClaims: transfers.map((t) => ({
				id: t.transferId,
				amount: t.amount,
				senderHandle: t.senderHandle,
				txHash: t.txHash,
				createdAt: t.createdAt,
				claimToken: t.claimToken,
			})),
		});
	} catch (error) {
		console.error("Pending claims error:", error);
		res.status(500).json({ error: "Failed to get pending claims" });
	}
});

// GET /api/claims/wallet/:handle - Get full wallet info for claimed user
router.get("/wallet/:handle", async (req, res) => {
	try {
		const cleanHandle = req.params.handle.replace("@", "").toLowerCase();
		const wallet = await getWalletByHandle(cleanHandle);

		if (!wallet) {
			return res.status(404).json({ error: "No wallet found for this handle" });
		}

		const usdcBalance = await getUsdcBalance(wallet.walletAddress);

		res.json({
			success: true,
			wallet: {
				handle: wallet.telegramHandle,
				address: wallet.walletAddress,
				balance: usdcBalance,
			},
		});
	} catch (error) {
		console.error("Get wallet error:", error);
		res.status(500).json({ error: "Failed to get wallet info" });
	}
});

module.exports = router;
