"use strict"

// Imports
const config = require("./config.json")
const text = require("./text.json")
const util = require("./util.js")
const commands = require("./commands.js")
const Discord = require("discord.js")

// Initialize the bot
const bot = new Discord.Client()

bot.on("ready", () => {
	// Once the bot has loaded up and connected to the Discord API

	console.log("Logged in and ready.")

})

bot.on("message", message => {
	// On every message the bot sees

	if (message.author.bot) {
		// Disregard messages from bots (including itself)
		return
	}

	if (!message.guild) {
		// Reply with a standard bit of info about dev contact
		// when not on a server
		message.reply(text.other.dmreply)

		// And forward the message to the dev
		bot.users.resolve(config.devUserID).send(text.other.dmforward
			.replace("{user}", message.author.toString())
			.replace("{message}", message.cleanContent))

		return
	}
	
	// Commands:
	if (message.content.startsWith(">test")) {
		// Test command:
		message.channel.send(text.other.test)

	} else if (message.content.startsWith(">help")) {
		// Help command:
		try {
			commands.help(message)

		} catch (error) {
			message.channel.send(text.fail.help)

		}

	} else if (
		message.content.startsWith(">mv") ||
		message.content.startsWith(">move")
	) {
		// Move command:
		try {
			commands.move(message)

		} catch (error) {
			message.channel.send(text.fail.move)

		}
	
	} else if (
		message.content.startsWith(">rm") ||
		message.content.startsWith(">remove") ||
		message.content.startsWith(">del") ||
		message.content.startsWith(">delete")
	) {
		// Delete command:
		try {
			commands.delete(message)

		} catch (error) {
			message.channel.send(text.fail.delete)

		}

	} else if (message.content.startsWith(">roll")) {
		// Roll command:
		try {
			commands.roll(message)

		} catch (error) {
			message.channel.send(text.fail.roll)

		}

	} else if (message.content.startsWith(">poll")) {
		// Poll command:
		try {
			commands.poll(message)

		} catch (error) {
			message.channel.send(text.fail.poll)

		}

	}

})

bot.on("messageDelete", message => {
	// On every message, that the bot saw get deleted

	if (config.deletedMsgsChannel === "") {
		// Ignore this, if the feature was disabled
		return
	}

	if (message.author.bot) {
		// Disregard messages from bots (including itself)
		return
	}

	if (!message.guild) {
		// Disregard messages not in guilds
		return
	}

	util.logDeletedMessage(message)

})

bot.on("messageDeleteBulk", messages => {
	// On every bulk-delete of messages the bot saw

	// Convert to array (2D)
	messages = Array.from(messages).reverse()

	for (let message of messages) {
		message = message[1]

		if (config.deletedMsgsChannel === "") {
			// Ignore this, if the feature was disabled
			return
		}

		if (message.author.bot) {
			// Disregard messages from bots (including itself)
			return
		}

		if (!message.guild) {
			// Disregard messages not in guilds
			return
		}

		util.logDeletedMessage(message)

	}
})

bot.on("messageUpdate", (oldMessage, newMessage) => {
	// On every message update the bot saw

	if (config.updatedMsgsChannel === "") {
		// Ignore this, if the feature was disabled
		return
	}

	if (oldMessage.author.bot) {
		// Disregard messages from bots (including itself)
		return
	}

	if (!oldMessage.guild) {
		// Disregard messages not in guilds
		return
	}

	util.logUpdatedMessage(oldMessage, newMessage)

})


bot.login(config.token)
