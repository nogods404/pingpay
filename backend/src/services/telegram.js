const TelegramBot = require("node-telegram-bot-api");
const TelegramUser = require("../models/TelegramUser");

let bot = null;

// Save or update user's chat ID in database
async function saveUserChatId(username, chatId) {
	try {
		await TelegramUser.findOneAndUpdate(
			{ username: username.toLowerCase() },
			{ username: username.toLowerCase(), chatId },
			{ upsert: true, new: true }
		);
		console.log(`📝 Saved @${username} with chatId ${chatId} to database`);
	} catch (error) {
		console.error(`Failed to save chatId for @${username}:`, error.message);
	}
}

// Get user's chat ID from database
async function getUserChatId(username) {
	try {
		const user = await TelegramUser.findOne({ username: username.toLowerCase() });
		return user?.chatId || null;
	} catch (error) {
		console.error(`Failed to get chatId for @${username}:`, error.message);
		return null;
	}
}

function initTelegramBot() {
	const token = process.env.TELEGRAM_BOT_TOKEN;

	if (!token || token === "your_telegram_bot_token_here") {
		console.log(
			"⚠️  Telegram bot token not configured. Bot features disabled.",
		);
		return null;
	}

	try {
		bot = new TelegramBot(token, { polling: true });

		// Handle /start command - register user's chat ID
		bot.onText(/\/start/, async (msg) => {
			const chatId = msg.chat.id;
			const username = msg.from.username;

			if (username) {
				await saveUserChatId(username, chatId);
			}

			bot.sendMessage(
				chatId,
				`👋 Welcome to PingPay${username ? `, @${username}` : ""}!\n\n` +
					`✅ You're now registered to receive notifications when someone sends you USDC.\n\n` +
					`Just share your Telegram handle with friends and they can send you USDC instantly!`,
			);
		});

		// Handle any message - ensure we have user's chat ID
		bot.on("message", async (msg) => {
			const username = msg.from.username;
			const chatId = msg.chat.id;
			if (username) {
				// Check if already in DB, if not save
				const existing = await getUserChatId(username);
				if (!existing) {
					await saveUserChatId(username, chatId);
				}
			}
		});

		// Handle /balance command
		bot.onText(/\/balance/, async (msg) => {
			const chatId = msg.chat.id;
			bot.sendMessage(
				chatId,
				"💰 To check your balance, go to the PingPay Receive page and enter your Telegram handle!",
			);
		});

		console.log("✅ Telegram bot started");
		return bot;
	} catch (error) {
		console.error("Failed to initialize Telegram bot:", error);
		return null;
	}
}

// Send claim notification to recipient
async function sendClaimNotification(
	recipientHandle,
	amount,
	claimToken,
	senderHandle,
) {
	if (!bot) {
		console.log("Telegram bot not initialized. Skipping notification.");
		return { success: false, reason: "Bot not initialized" };
	}

	const claimUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/receive`;
	const cleanHandle = recipientHandle.toLowerCase();
	const chatId = await getUserChatId(cleanHandle);

	if (!chatId) {
		console.log(
			`⚠️ @${recipientHandle} hasn't started the bot yet. Cannot send notification.`,
		);
		return {
			success: false,
			reason: "User has not started bot conversation",
			claimUrl,
		};
	}

	try {
		const message =
			`💰 You received ${amount} USDC${senderHandle ? ` from @${senderHandle}` : ""}!\n\n` +
			`👉 Click here to claim: ${claimUrl}`;

		await bot.sendMessage(chatId, message, { disable_web_page_preview: false });

		console.log(`✅ Notification sent to @${recipientHandle}`);
		return { success: true, claimUrl };
	} catch (error) {
		console.error(
			`Failed to send notification to @${recipientHandle}:`,
			error.message,
		);
		return { success: false, reason: error.message };
	}
}

// Get bot instance
function getBot() {
	return bot;
}

module.exports = {
	initTelegramBot,
	sendClaimNotification,
	getBot,
};
