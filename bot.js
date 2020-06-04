const config = require("./config.json")
const text = require("./text.json")
const Discord = require("discord.js")

let bot = new Discord.Client()

bot.on("ready", () => {
	console.log("Logged in and ready.");
});

bot.on('message', message => {
	if (message.author.bot) {
		// Disregard messages from bots (including itself)
		return
	}

	if (!message.guild) {
		// Reply with a standard bit of info about dev contact when not on a server
		message.reply(text.other.dmreply)
		return
	};
	
	// Commands:
	if (message.content.startsWith(">test")) {
		// Test command:
		message.channel.send(text.other.test)
	} else if (message.content.startsWith(">mv") || message.content.startsWith(">move")) {
		// Move command:
		try {
			moveCmd(message)
		} catch (error) {
			message.channel.send(text.fail.move)
		}
	} else if (message.content.startsWith(">rm") || message.content.startsWith(">remove") || message.content.startsWith(">del") || message.content.startsWith(">delete")) {
		// Delete command:
		try {
			deleteCmd(message)
		} catch (error) {
			message.channel.send(text.fail.delete)
		}
	}
});

function deleteCmd(message) {
	// Get amount of messages to be deleted
	const cmd = [message.content.split(" ")[0], message.content.substring(message.content.split(" ")[0].length)]
	const msgNum = parseInt(cmd[1])

	// Check command
	if (isNaN(msgNum)) {
		message.channel.send(text.usage.delete)
		return
	}

	if (msgNum < 1 || msgNum > 99) {
		message.channel.send(text.usage.delete)
		return
	}

	// Check permissions
	if (!message.member.hasPermission(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
		message.channel.send(text.fail.userPermission)
		return
	}
	
	// Delete messages
	message.channel.bulkDelete(msgNum + 1) // + 1 to delete the caller's message, then after that msgNum messages
}

function moveCmd(message) {
	// Get channels for moving
	const cmd = [message.content.split(" ")[0], message.content.substring(message.content.split(" ")[0].length)]
	const channels = cmd[1].split(">")
	if (channels.length == 1) {
		const fromChannel = message.member.voice.channel // Caller's channel
		const toChannel = message.guild.channels.cache.find(channel => channel.name === channels[0].trim())
	} else if (channels.length == 2) {
		//sorry
		const fromChannel = message.guild.channels.cache.find(channel => channel.name === channels[0].trim())
		const toChannel = message.guild.channels.cache.find(channel => channel.name === channels[1].trim())
	} else {
		const fromChannel = undefined
		const toChannel = undefined
		message.channel.send(text.usage.move)
		return
	}

	// Verify channels
	if (fromChannel == undefined || toChannel == undefined) {
		message.channel.send(text.usage.move)
		return
	}

	// Get users in fromChannel
	const usersToMove = fromChannel.members

	// Verify if users can be moved
	// Verify caller can move users
	// Verify users will fit in toChannel

	// Move users to toChannel

	// Reply to original message
}

bot.login(config.token)
