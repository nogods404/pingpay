import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
	const [wallet, setWallet] = useState(null);
	const [connectedAddress, setConnectedAddress] = useState(null);
	const [loading, setLoading] = useState(false);
	const [transfers, setTransfers] = useState([]);
	const [userHandle, setUserHandle] = useState(
		localStorage.getItem("pingpay_handle") || null,
	);

	useEffect(() => {
		// Check if MetaMask is connected
		checkWalletConnection();

		// Listen for account changes
		if (window.ethereum) {
			window.ethereum.on("accountsChanged", handleAccountsChanged);
			window.ethereum.on("chainChanged", () => window.location.reload());
		}

		return () => {
			if (window.ethereum) {
				window.ethereum.removeListener(
					"accountsChanged",
					handleAccountsChanged,
				);
			}
		};
	}, []);

	useEffect(() => {
		if (connectedAddress) {
			refreshBalance();
		}
	}, [connectedAddress]);

	async function checkWalletConnection() {
		// Don't auto-reconnect if user explicitly disconnected
		const wasDisconnected = localStorage.getItem("pingpay_disconnected");
		if (wasDisconnected) {
			return;
		}

		if (window.ethereum) {
			try {
				const accounts = await window.ethereum.request({
					method: "eth_accounts",
				});
				if (accounts.length > 0) {
					setConnectedAddress(accounts[0]);
					await loadWalletInfo(accounts[0]);
				}
			} catch (error) {
				console.error("Error checking wallet:", error);
			}
		}
	}

	function handleAccountsChanged(accounts) {
		if (accounts.length > 0) {
			setConnectedAddress(accounts[0]);
			loadWalletInfo(accounts[0]);
		} else {
			setConnectedAddress(null);
			setWallet(null);
		}
	}

	async function connectWallet() {
		if (!window.ethereum) {
			throw new Error("Please install MetaMask to use this app");
		}

		// Clear the disconnected flag since user is explicitly connecting
		localStorage.removeItem("pingpay_disconnected");

		setLoading(true);
		try {
			// Request permissions to force account selection popup
			await window.ethereum.request({
				method: "wallet_requestPermissions",
				params: [{ eth_accounts: {} }],
			});

			// Now get the selected accounts
			const accounts = await window.ethereum.request({
				method: "eth_accounts",
			});

			if (accounts.length === 0) {
				throw new Error("No account selected");
			}

			// Switch to Arbitrum Sepolia
			try {
				await window.ethereum.request({
					method: "wallet_switchEthereumChain",
					params: [{ chainId: "0x66eee" }], // 421614 in hex
				});
			} catch (switchError) {
				// Chain not added, add it
				if (switchError.code === 4902) {
					await window.ethereum.request({
						method: "wallet_addEthereumChain",
						params: [
							{
								chainId: "0x66eee",
								chainName: "Arbitrum Sepolia",
								nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
								rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
								blockExplorerUrls: ["https://sepolia.arbiscan.io"],
							},
						],
					});
				}
			}

			setConnectedAddress(accounts[0]);
			await loadWalletInfo(accounts[0]);
			return accounts[0];
		} finally {
			setLoading(false);
		}
	}

	async function loadWalletInfo(address) {
		try {
			const balanceData = await api.getBalance(address);
			setWallet({
				address,
				usdcBalance: balanceData.balance.usdc,
				usdcAddress: balanceData.usdcAddress,
				network: "Arbitrum Sepolia",
			});
		} catch (error) {
			console.error("Error loading wallet info:", error);
			setWallet({
				address,
				usdcBalance: "0",
				network: "Arbitrum Sepolia",
			});
		}
	}

	async function refreshBalance() {
		if (connectedAddress) {
			try {
				const data = await api.getBalance(connectedAddress);
				setWallet((prev) => ({
					...prev,
					usdcBalance: data.balance.usdc,
					usdcAddress: data.usdcAddress,
				}));
			} catch (error) {
				console.error("Failed to refresh balance:", error);
			}
		}
	}

	async function loadTransfers() {
		if (connectedAddress) {
			try {
				const data = await api.getHistory(connectedAddress);
				setTransfers(data.transfers || []);
			} catch (error) {
				console.error("Failed to load transfers:", error);
			}
		}
	}

	function saveUserHandle(handle) {
		const cleanHandle = handle.replace("@", "").toLowerCase();
		localStorage.setItem("pingpay_handle", cleanHandle);
		setUserHandle(cleanHandle);
	}

	function disconnectWallet() {
		localStorage.setItem("pingpay_disconnected", "true");
		setConnectedAddress(null);
		setWallet(null);
		setTransfers([]);
	}

	// Ensure we're on Arbitrum Sepolia before sending
	async function ensureCorrectChain() {
		if (!window.ethereum) {
			throw new Error("Please install MetaMask");
		}

		const chainId = await window.ethereum.request({ method: "eth_chainId" });

		if (chainId !== "0x66eee") {
			// 421614 in hex
			try {
				await window.ethereum.request({
					method: "wallet_switchEthereumChain",
					params: [{ chainId: "0x66eee" }],
				});
			} catch (switchError) {
				if (switchError.code === 4902) {
					await window.ethereum.request({
						method: "wallet_addEthereumChain",
						params: [
							{
								chainId: "0x66eee",
								chainName: "Arbitrum Sepolia",
								nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
								rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
								blockExplorerUrls: ["https://sepolia.arbiscan.io"],
							},
						],
					});
				} else {
					throw new Error("Please switch to Arbitrum Sepolia network");
				}
			}
		}
	}

	const value = {
		wallet,
		connectedAddress,
		loading,
		transfers,
		userHandle,
		connectWallet,
		disconnectWallet,
		ensureCorrectChain,
		refreshBalance,
		loadTransfers,
		setTransfers,
		saveUserHandle,
	};

	return (
		<WalletContext.Provider value={value}>{children}</WalletContext.Provider>
	);
}

export function useWallet() {
	const context = useContext(WalletContext);
	if (!context) {
		throw new Error("useWallet must be used within WalletProvider");
	}
	return context;
}
