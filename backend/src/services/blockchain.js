const { ethers } = require("ethers");

// USDC Token Contract Address (Arbitrum Sepolia)
const USDC_ADDRESS = "0x0050EAB3c59C945aE92858121c88752e8871185D";

// ERC20 ABI for balanceOf, transfer, and Transfer event
const ERC20_ABI = [
	"function balanceOf(address owner) view returns (uint256)",
	"function transfer(address to, uint256 amount) returns (bool)",
	"function decimals() view returns (uint8)",
	"function symbol() view returns (string)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"event Transfer(address indexed from, address indexed to, uint256 value)",
];

// Initialize provider
function getProvider() {
	return new ethers.JsonRpcProvider(process.env.RPC_URL);
}

// Get USDC contract instance
function getUsdcContract(signerOrProvider) {
	return new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signerOrProvider);
}

// Create a new wallet for recipient
function createNewWallet() {
	const wallet = ethers.Wallet.createRandom();
	return {
		address: wallet.address,
		privateKey: wallet.privateKey,
	};
}

// Get wallet from private key
function getWalletFromPrivateKey(privateKey) {
	const provider = getProvider();
	return new ethers.Wallet(privateKey, provider);
}

// Get ETH balance for an address (for gas)
async function getEthBalance(address) {
	try {
		const provider = getProvider();
		const balance = await provider.getBalance(address);
		return ethers.formatEther(balance);
	} catch (error) {
		console.error("Error getting ETH balance:", error);
		return "0";
	}
}

// Get USDC balance for an address
async function getUsdcBalance(address) {
	try {
		const provider = getProvider();
		const usdc = getUsdcContract(provider);
		const balance = await usdc.balanceOf(address);
		// USDC has 6 decimals
		return ethers.formatUnits(balance, 6);
	} catch (error) {
		console.error("Error getting USDC balance:", error);
		return "0";
	}
}

// Verify a USDC transfer transaction
async function verifyTransaction(txHash, expectedTo, expectedAmount) {
	try {
		const provider = getProvider();

		console.log(`Verifying tx: ${txHash}`);
		console.log(`Expected to: ${expectedTo}, amount: ${expectedAmount} USDC`);

		// Get transaction - retry a few times as it may not be immediately available
		let tx = null;
		for (let i = 0; i < 10; i++) {
			tx = await provider.getTransaction(txHash);
			if (tx) break;
			console.log(`Transaction not found, retrying in 2s... (${i + 1}/10)`);
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		if (!tx) {
			return { success: false, error: "Transaction not found after retries" };
		}

		// Wait for confirmation (at least 1 block)
		console.log("Waiting for transaction confirmation...");
		const receipt = await tx.wait(1);

		if (receipt.status !== 1) {
			return { success: false, error: "Transaction failed on chain" };
		}

		console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

		// For ERC20, we need to check the logs for Transfer event
		const usdc = getUsdcContract(provider);
		
		// Parse logs to find Transfer event
		let transferAmount = 0n;
		for (const log of receipt.logs) {
			try {
				const parsed = usdc.interface.parseLog(log);
				if (parsed && parsed.name === "Transfer") {
					const [from, to, amount] = parsed.args;
					if (to.toLowerCase() === expectedTo.toLowerCase()) {
						transferAmount = amount;
						break;
					}
				}
			} catch (e) {
				// Not a Transfer event from USDC, skip
			}
		}

		const actualAmount = ethers.formatUnits(transferAmount, 6);
		console.log(`Actual transfer amount: ${actualAmount} USDC`);

		if (parseFloat(actualAmount) < parseFloat(expectedAmount) * 0.99) {
			return {
				success: false,
				error: `Amount too low: expected ${expectedAmount}, got ${actualAmount}`,
			};
		}

		return {
			success: true,
			from: tx.from,
			to: expectedTo,
			amount: actualAmount,
			blockNumber: receipt.blockNumber,
			txHash: txHash,
		};
	} catch (error) {
		console.error("Error verifying transaction:", error);
		return { success: false, error: error.message };
	}
}

// Send USDC from a wallet (for withdrawals)
async function sendUsdcFromWallet(privateKey, toAddress, amount) {
	try {
		const wallet = getWalletFromPrivateKey(privateKey);
		const usdc = getUsdcContract(wallet);

		// USDC has 6 decimals
		const amountInUnits = ethers.parseUnits(amount.toString(), 6);

		console.log(`Sending ${amount} USDC to ${toAddress}`);

		// Send USDC transfer
		const tx = await usdc.transfer(toAddress, amountInUnits);

		console.log(`Transaction sent: ${tx.hash}`);

		// Wait for confirmation
		const receipt = await tx.wait();
		console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

		return {
			success: true,
			txHash: tx.hash,
			amount: amount.toString(),
			blockNumber: receipt.blockNumber,
		};
	} catch (error) {
		console.error("Error sending USDC:", error);
		return {
			success: false,
			error: error.message,
		};
	}
}

// Send all USDC from a wallet
async function sendMaxUsdcFromWallet(privateKey, toAddress) {
	try {
		const wallet = getWalletFromPrivateKey(privateKey);
		const provider = getProvider();
		const usdc = getUsdcContract(wallet);

		// Get USDC balance
		const balance = await usdc.balanceOf(wallet.address);
		
		if (balance <= 0n) {
			return {
				success: false,
				error: "No USDC balance to withdraw",
			};
		}

		const amountFormatted = ethers.formatUnits(balance, 6);
		console.log(`Sending all USDC: ${amountFormatted} to ${toAddress}`);

		// Check if wallet has enough ETH for gas
		const ethBalance = await provider.getBalance(wallet.address);
		const feeData = await provider.getFeeData();
		const estimatedGas = 100000n; // ERC20 transfer typically needs ~60k gas
		const gasCost = estimatedGas * (feeData.maxFeePerGas || feeData.gasPrice);

		if (ethBalance < gasCost) {
			return {
				success: false,
				error: `Insufficient ETH for gas. Need ~${ethers.formatEther(gasCost)} ETH`,
			};
		}

		// Send all USDC
		const tx = await usdc.transfer(toAddress, balance);

		console.log(`Transaction sent: ${tx.hash}`);

		// Wait for confirmation
		const receipt = await tx.wait();
		console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

		return {
			success: true,
			txHash: tx.hash,
			amount: amountFormatted,
			blockNumber: receipt.blockNumber,
		};
	} catch (error) {
		console.error("Error sending max USDC:", error);
		return {
			success: false,
			error: error.message,
		};
	}
}

// Estimate gas for USDC transfer
async function estimateGas(fromAddress, toAddress, amount) {
	try {
		const provider = getProvider();

		// ERC20 transfer gas estimate
		const gasLimit = 100000n;

		const feeData = await provider.getFeeData();
		const gasCost = gasLimit * feeData.gasPrice;

		return {
			gasLimit: gasLimit.toString(),
			gasPrice: ethers.formatUnits(feeData.gasPrice, "gwei"),
			estimatedCost: ethers.formatEther(gasCost),
		};
	} catch (error) {
		console.error("Error estimating gas:", error);
		return {
			gasLimit: "100000",
			gasPrice: "0.1",
			estimatedCost: "0.00001",
		};
	}
}

// Get explorer URL for transaction
function getExplorerUrl(txHash) {
	return `https://sepolia.arbiscan.io/tx/${txHash}`;
}

// Get USDC contract address
function getUsdcAddress() {
	return USDC_ADDRESS;
}

module.exports = {
	getProvider,
	createNewWallet,
	getWalletFromPrivateKey,
	getEthBalance,
	getUsdcBalance,
	getUsdcContract,
	getUsdcAddress,
	verifyTransaction,
	sendUsdcFromWallet,
	sendMaxUsdcFromWallet,
	estimateGas,
	getExplorerUrl,
};
