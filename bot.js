"use strict"

// Imports
const config = require("./config.json")
const text = require("./text.json")
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
		if (message.cleanContent.trim() === ">help") {
			// Display usage for help command
			message.channel.send(text.usage.help)

		} else if (message.cleanContent.trim() === ">help all") {
			// Display usage for all commands
			let helpMessage = ""

			for (let command in text.usage) {
				helpMessage = helpMessage + text.usage[command] + "\n\n"

			}

			message.channel.send(helpMessage)

		} else {
			// Display usage for one command only
			// Get command name from message
			let command = message.cleanContent.split(" ")[1]

			try {
				// Try to send the command usage
				let usage = text.usage[command]

				if (usage == undefined || usage == "") {
					throw ReferenceError()

				} else {
					message.channel.send(text.usage[command])

				}

			} catch (error) {
				// If the command isn't found, send an error
				message.channel.send(text.fail.help)

			}

		}
	
	} else if (
		message.content.startsWith(">mv") ||
		message.content.startsWith(">move")
	) {
		// Move command:
		try {
			moveCmd(message)

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
			deleteCmd(message)

		} catch (error) {
			message.channel.send(text.fail.delete)

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

	logDeletedMessage(message)

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

		logDeletedMessage(message)

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

	logUpdatedMessage(oldMessage, newMessage)

})


// Command functions

function moveCmd(message) {
	/*
	* Moves guild members from one channel to another.
	* Channels are specified in the message text.
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

	// Get channels for moving
	const cmd = [
		message.content.split(" ")[0],
		message.content.substring(message.content.split(" ")[0].length)
	]

	const channels = cmd[1].split(">")
	let fromChannel, toChannel, channelNames

	if (channels.length == 1) {
		fromChannel = [message.member.voice.channel] // Caller's channel
		toChannel = getGuildChannels(message.guild, "voice", channels[0])

		if (fromChannel[0] === null) {
			// If the member is not in a voice channel
			message.channel.send(text.fail.userNotInVoiceChannel
				.replace("{user}", message.member))

			return false
		}

		channelNames = [
			message.member.voice.channel.name,
			channels[0]
		]

	} else if (channels.length == 2) {
		fromChannel = getGuildChannels(message.guild, "voice", channels[0])
		toChannel = getGuildChannels(message.guild, "voice", channels[1])
		
		channelNames = [channels[0], channels[1]]

	} else {
		message.channel.send(text.usage.move)
		return false
	}

	// Verify channels
	if (fromChannel.length === 0) {
		message.channel.send(text.fail.channelNotFound
			.replace("{channel}", channelNames[0]))

		return false
	} else if (toChannel.length === 0) {
		message.channel.send(text.fail.channelNotFound
			.replace("{channel}", channelNames[1]))

		return false
	} else {
		toChannel = toChannel[0]
		fromChannel = fromChannel[0]

	}

	if (fromChannel == undefined || toChannel == undefined) {
		message.channel.send(text.fail.move)
		return false
	}

	// Get guild members in fromChannel
	const membersToMove = Array.from(fromChannel.members)

	// Verify caller can move members (i am so sorry for the following code)
	if (!(
		fromChannel.permissionsFor(message.member)
			.has(Discord.Permissions.FLAGS.MOVE_MEMBERS) &&
		toChannel.permissionsFor(message.member)
			.has(Discord.Permissions.FLAGS.MOVE_MEMBERS) &&
		fromChannel.permissionsFor(message.member)
			.has(Discord.Permissions.FLAGS.CONNECT) &&
		toChannel.permissionsFor(message.member)
			.has(Discord.Permissions.FLAGS.CONNECT)
	)) {
		message.channel.send(text.fail.userPermission)
		return false
	}

	// Verify members will fit in toChannel
	const spaceInToChannel = Array.from(toChannel.members).length
	if (
		toChannel.userLimit !== 0 &&
		membersToMove.length > (toChannel.userLimit - spaceInToChannel)
	) {
		message.channel.send(text.fail.voiceChannelFull
			.replace("{channel}", toChannel))

		return false
	}

	// Move members to toChannel
	for (let member of membersToMove) {
		member[1].voice.setChannel(toChannel, "Moved by the >move command.")

	}

	// Reply to original message
	message.channel.send(text.success.move
		.replace("{amountOfMembers}", membersToMove.length)
		.replace("{fromChannel}", fromChannel.toString())
		.replace("{toChannel}", toChannel.toString()))

	return true
}

function deleteCmd(message) {
	/*
	* Deletes a number of messages
	* (number is first part of message text after a " ")
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

	// Get amount of messages to be deleted
	const cmd = [
		message.content.split(" ")[0],
		message.content.substring(message.content.split(" ")[0].length)
	]

	const msgNum = parseInt(cmd[1])

	// Check command
	if (isNaN(msgNum)) {
		message.channel.send(text.usage.delete)
		return false
	}

	if (msgNum < 1 || msgNum > 99) {
		message.channel.send(text.usage.delete)
		return false
	}

	// Check permissions
	if (
		!message.member.permissionsIn(message.channel)
			.has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)
	) {
		message.channel.send(text.fail.userPermission)
		return false
	}
	
	// Delete messages
	// + 1 to delete the caller's message, then after that msgNum messages
	message.channel.bulkDelete(msgNum + 1)

	return true
}


// Utility functions

function getGuildChannels(guild, type, name) {
	/*
	* Get a guild channel of a certain type by name, id, or category and name.
	* 
	* guild - Discord.Guild - The Discord.Guild object, in which to search
	* for the channels. REQUIRED
	*
	* type - string - The channel type ("VoiceChannel"/"voice",
	* "TextChannel"/"text", "CategoryChannel"/"category", "NewsChannel"/"news",
	* or "StoreChannel"/"store"). OPTIONAL
	*
	* name - string - The channel name, category.name, or id. OPTIONAL
	* 
	* returns - An array of all channels in [guild], which match the
	* [name] and [type]. If [name] and/or [type] are left out or undefined,
	* that specific parameter will be ignored.
	*
	* The channels are returned in order of their position in the GUI
	* (".rawPosition"). If no channels are found, it returns an empty array.
	*
	* On failure, returns undefined.
	*/

	const guildChannels = Array.from(guild.channels.cache)
	let channelType
	let channels = []

	// Set the correct type to look for
	switch (type) {
		case "voice":
		case "VoiceChannel":
			channelType = "voice"
			break

		case "text":
		case "TextChannel":
			channelType = "text"
			break

		case "category":
		case "CategoryChannel":
			channelType = "category"
			break

		case "news":
		case "NewsChannel":
			channelType = "news"
			break

		case "store":
		case "StoreChannel":
			channelType = "store"
			break
		
	}

	// Format the name
	let channelName, channelNameType

	if (name !== undefined && typeof(name) === "string") {
		name = name.trim()
		// Check which name it's using
		if (/.+\..+/giu.test(name)) {
			// category.name
			channelNameType = "category.name"
			channelName = [undefined, undefined]

			channelName[0] = name.match(/.+\./giu)[0]
			channelName[0] = channelName[0]
				.substring(0, channelName[0].length - 1).trim()

			channelName[1] = name.match(/\..+/giu)[0]
			channelName[1] = channelName[1].substring(1).trim()

		} else if (!isNaN(name) && /\d+[^A-Z\s]/giu.test(name)) {
			// id/snowflake
			// If the channel is given by ID, it must be universally unique,
			// so we just return that (inside an array for consistency)
			return [guild.channels.resolve(name)]
		} else {
			// probably name
			channelNameType = "name"
			channelName = name

		}
	}

	// Put all the channel objects into an array
	for (let channel of guildChannels) {
		// But only if the type ...
		if (channel[1].type === channelType || channelType === undefined) {
			// ... and name match
			if (channelNameType === undefined) {
				channels.push(channel[1])

			} else if (channelNameType === "name") {
				if (channel[1].name.trim() === channelName) {
					channels.push(channel[1])

				}

			} else if (channelNameType === "category.name") {
				if (
					channel[1].parent.name.trim() === channelName[0] &&
					channel[1].name.trim() === channelName[1]
				) {
					channels.push(channel[1])

				}
			}
		}
	}

	channels.sort((a, b) => (a.rawPosition - b.rawPosition))

	return channels
}

function logDeletedMessage(msg) {
	/*
	* Logs a message to a channel defined in config.json
	* Note: Only works for recently posted messages.
	* I think they need to be in the cache, or posted while the bot was online.
	*
	* message - type Discord.Message, the message to be logged (from a guild)
	*
	* returns - false on failure, true on success
	*/

	try {
		// Get logging channel from config
		getGuildChannels(msg.guild, "text", config.deletedMsgsChannel)[0]
		// Send the message
		.send(text.other.deletedMessage
			.replace("{message}", msg.content)
			.replace("{author}", msg.author.toString())
			.replace("{date}", msg.createdAt.toISOString()),
			{embed: msg.embed, split: true})

		return true
	} catch (error) {
		// Catch the error and ignore it
		return false
	}
}

function logUpdatedMessage(oldMsg, newMsg) {
	/*
	* Logs a message to a channel defined in config.json
	* Note: Only works for recently posted messages.
	* I think they need to be in the cache, or posted while the bot was online.
	*
	* originalMessage - type Discord.Message, the original version of
	* the message to be logged (from a guild)
	*
	* newMessage - type Discord.Message, the new version of the message
	* to be logged (from a guild)
	*
	* returns - false on failure, true on success
	*/

	try {
		// Get logging channel from config
		getGuildChannels(newMsg.guild, "text", config.updatedMsgsChannel)[0]
		// Send the message
		.send(text.other.updatedMessage
			.replace("{oldMessage}", oldMsg.content)
			.replace("{author}", oldMsg.author.toString())
			.replace("{date}", oldMsg.createdAt.toISOString()),
			{embed: oldMsg.embed, split: true})

		getGuildChannels(newMsg.guild, "text", config.updatedMsgsChannel)[0]
		// Send the second (new) message
		.send("\"" + newMsg.content + "\"", {embed: newMsg.embed, split: true})

		return true
	} catch (error) {
		// Catch the error and ignore it
		return false
	}
}


bot.login(config.token)
