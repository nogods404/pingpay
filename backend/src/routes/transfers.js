const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const {
	createWallet,
	getWalletByHandle,
	createTransfer,
	updateTransferStatus,
	getTransfersByAddress,
	getTransfersByHandle,
	getTransferById,
} = require("../database");
const {
	createNewWallet,
	verifyTransaction,
	estimateGas,
	getExplorerUrl,
} = require("../services/blockchain");
const { sendClaimNotification } = require("../services/telegram");
const { parseCommandWithAI } = require("../services/ai");

// POST /api/transfers/parse - Parse a send command with AI
router.post("/parse", async (req, res) => {
	const { command } = req.body;

	if (!command) {
		return res.status(400).json({ error: "Command is required" });
	}

	const result = await parseCommandWithAI(command);

	if (!result.success) {
		return res.status(400).json({
			error:
				result.error ||
				'Could not understand command. Try: "send 10 usdc to @username"',
		});
	}

	res.json({
		success: true,
		parsed: {
			amount: result.amount,
			recipient: result.recipient,
			currency: "USDC",
			network: "Arbitrum Sepolia",
		},
	});
});

// POST /api/transfers/prepare - Prepare a transfer (create recipient wallet)
router.post("/prepare", async (req, res) => {
	const { recipient, amount, senderAddress, senderHandle } = req.body;

	if (!recipient || !amount) {
		return res.status(400).json({ error: "Recipient and amount are required" });
	}

	try {
		// Get or create recipient wallet
		let recipientWallet = await getWalletByHandle(recipient);

		if (!recipientWallet) {
			const newWallet = createNewWallet();
			recipientWallet = await createWallet(
				recipient,
				newWallet.address,
				newWallet.privateKey,
			);
		}

		// Create transfer record with pending status
		const transferId = uuidv4();
		const claimToken = uuidv4();

		const transfer = {
			id: transferId,
			senderAddress: senderAddress || "unknown",
			senderHandle: senderHandle || null,
			recipientHandle: recipient,
			recipientAddress: recipientWallet.walletAddress,
			amount: amount.toString(),
			status: "pending",
			claimToken,
		};

		await createTransfer(transfer);

		// Get gas estimate
		const gasEstimate = await estimateGas(
			senderAddress,
			recipientWallet.walletAddress,
			amount,
		);

		res.json({
			success: true,
			transfer: {
				id: transferId,
				recipientAddress: recipientWallet.walletAddress,
				amount,
				recipient,
				network: "Arbitrum Sepolia",
				chainId: 421614,
				gasEstimate,
			},
		});
	} catch (error) {
		console.error("Prepare error:", error);
		res.status(500).json({ error: "Failed to prepare transfer" });
	}
});

// POST /api/transfers/confirm - Confirm transfer after user sends tx
// Flow: User confirms in MetaMask → get txHash → verify on blockchain → update DB → send Telegram
router.post("/confirm", async (req, res) => {
	const { transferId, txHash } = req.body;

	if (!transferId || !txHash) {
		return res
			.status(400)
			.json({ error: "Transfer ID and transaction hash are required" });
	}

	try {
		// 1. Get the transfer from DB
		const transfer = await getTransferById(transferId);

		if (!transfer) {
			return res.status(404).json({ error: "Transfer not found" });
		}

		if (transfer.status !== "pending") {
			return res
				.status(400)
				.json({ error: "Transfer is not in pending state" });
		}

		console.log(`Confirming transfer ${transferId} with txHash ${txHash}`);

		// 2. Verify transaction on blockchain (wait for block confirmation)
		const verification = await verifyTransaction(
			txHash,
			transfer.recipientAddress,
			transfer.amount,
		);

		if (!verification.success) {
			return res.status(400).json({
				error: "Transaction verification failed",
				details: verification.error,
			});
		}

		console.log(`Transaction verified in block ${verification.blockNumber}`);

		// 3. Update transfer status in database
		await updateTransferStatus(transfer.transferId, "confirmed", txHash);
		console.log(`Transfer status updated to confirmed`);

		// 4. Send Telegram notification to recipient
		await sendClaimNotification(
			transfer.recipientHandle,
			transfer.amount,
			transfer.claimToken,
			transfer.senderHandle,
		);
		console.log(`Telegram notification sent to @${transfer.recipientHandle}`);

		res.json({
			success: true,
			transfer: {
				id: transfer.transferId,
				status: "confirmed",
				txHash,
				blockNumber: verification.blockNumber,
				explorerUrl: getExplorerUrl(txHash),
				claimToken: transfer.claimToken,
			},
		});
	} catch (error) {
		console.error("Confirm error:", error);
		res.status(500).json({ error: "Failed to confirm transfer" });
	}
});

// POST /api/transfers/estimate - Get gas estimate
router.post("/estimate", async (req, res) => {
	const { recipient, amount, senderAddress } = req.body;

	try {
		// Get or create recipient wallet
		let recipientWallet = await getWalletByHandle(recipient);

		if (!recipientWallet) {
			const newWallet = createNewWallet();
			await createWallet(recipient, newWallet.address, newWallet.privateKey);
			recipientWallet = { walletAddress: newWallet.address };
		}

		const gasEstimate = await estimateGas(
			senderAddress,
			recipientWallet.walletAddress,
			amount,
		);

		res.json({
			success: true,
			estimate: {
				...gasEstimate,
				recipientAddress: recipientWallet.walletAddress,
				usdcContractAddress: getUsdcAddress(),
			},
		});
	} catch (error) {
		console.error("Estimate error:", error);
		res.status(500).json({ error: "Failed to estimate gas" });
	}
});

// GET /api/transfers/:id - Get transfer by ID
router.get("/:id", async (req, res) => {
	try {
		const transfer = await getTransferById(req.params.id);

		if (!transfer) {
			return res.status(404).json({ error: "Transfer not found" });
		}

		res.json({
			success: true,
			transfer: {
				id: transfer.transferId,
				senderAddress: transfer.senderAddress,
				senderHandle: transfer.senderHandle,
				recipientHandle: transfer.recipientHandle,
				recipientAddress: transfer.recipientAddress,
				amount: transfer.amount,
				status: transfer.status,
				txHash: transfer.txHash,
				createdAt: transfer.createdAt,
				claimedAt: transfer.claimedAt,
				explorerUrl: transfer.txHash ? getExplorerUrl(transfer.txHash) : null,
			},
		});
	} catch (error) {
		console.error("Get transfer error:", error);
		res.status(500).json({ error: "Failed to get transfer" });
	}
});

// GET /api/transfers/history/:address - Get transfer history for an address
router.get("/history/:address", async (req, res) => {
	try {
		const transfers = await getTransfersByAddress(req.params.address);

		res.json({
			success: true,
			transfers: transfers.map((t) => ({
				id: t.transferId,
				senderAddress: t.senderAddress,
				senderHandle: t.senderHandle,
				recipientHandle: t.recipientHandle,
				recipientAddress: t.recipientAddress,
				amount: t.amount,
				status: t.status,
				txHash: t.txHash,
				createdAt: t.createdAt,
				claimedAt: t.claimedAt,
				explorerUrl: t.txHash ? getExplorerUrl(t.txHash) : null,
			})),
		});
	} catch (error) {
		console.error("History error:", error);
		res.status(500).json({ error: "Failed to get transfer history" });
	}
});

// GET /api/transfers/handle/:handle - Get transfer history for a telegram handle
router.get("/handle/:handle", async (req, res) => {
	try {
		const transfers = await getTransfersByHandle(req.params.handle);

		res.json({
			success: true,
			transfers: transfers.map((t) => ({
				id: t.transferId,
				senderAddress: t.senderAddress,
				senderHandle: t.senderHandle,
				recipientHandle: t.recipientHandle,
				recipientAddress: t.recipientAddress,
				amount: t.amount,
				status: t.status,
				txHash: t.txHash,
				createdAt: t.createdAt,
				claimedAt: t.claimedAt,
				explorerUrl: t.txHash ? getExplorerUrl(t.txHash) : null,
			})),
		});
	} catch (error) {
		console.error("Handle history error:", error);
		res.status(500).json({ error: "Failed to get transfer history" });
	}
});

module.exports = router;
