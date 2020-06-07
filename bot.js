"use strict"

const config = require("./config.json")
const text = require("./text.json")
const Discord = require("discord.js")

const bot = new Discord.Client()

bot.on("ready", () => {
	console.log("Logged in and ready.");
});

bot.on("message", message => {
	if (message.author.bot) {
		// Disregard messages from bots (including itself)
		return
	}

	if (!message.guild) {
		// Reply with a standard bit of info about dev contact when not on a server
		message.reply(text.other.dmreply)

		// And forward the message to the dev
		bot.users.resolve(config.devUserID).send(message.author.toString() + " sent \"" + message.cleanContent + "\" to me.")

		return
	};
	
	// Commands:
	if (message.content.startsWith(">test")) {
		// Test command:
		message.channel.send(text.other.test)
	} else if (message.content.startsWith(">help")) {
		// Help command:
		if (message.cleanContent === ">help all") {
			let helpMessage = ""
			for (let command in text.usage) {
				helpMessage = helpMessage + text.usage[command] + "\n\n"
			}
			message.channel.send(helpMessage)
		} else {
			message.channel.send(text.other.help)
		}
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
	/*
	* Deletes a number of messages (number is first part of message text after a " ")
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

	// Get amount of messages to be deleted
	const cmd = [message.content.split(" ")[0], message.content.substring(message.content.split(" ")[0].length)]
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
	if (!message.member.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) {
		message.channel.send(text.fail.userPermission)
		return false
	}
	
	// Delete messages
	message.channel.bulkDelete(msgNum + 1) // + 1 to delete the caller's message, then after that msgNum messages
	return true
}

function moveCmd(message) {
	/*
	* Moves guild members from one channel to another. Channels are specified in the message text.
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

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

function getGuildChannels(guild, type, name) {
	/*
	* Get a guild channel of a certain type by name, id, or category and name.
	* 
	* guild - Discord.Guild - The Discord.Guild object, in which to search for the channels. REQUIRED
	* type - string - The channel type ("VoiceChannel"/"voice", "TextChannel"/"text", "CategoryChannel"/"category", "NewsChannel"/"news", or "StoreChannel"/"store"). OPTIONAL
	* name - string - The channel name, category.name, or id. OPTIONAL
	* 
	* returns - An array of all channels in [guild], which match the [name] and [type]. If [name] and/or [type] are left out or undefined, that specific parameter will be ignored.
	* The channels are returned in order of their position in the GUI (".rawPosition"). If no channels are found, it returns an empty array. On failure, returns undefined.
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
		// Check which name it's using
		if (/.+\..+/giu.test(name)) {
			// category.name
			channelNameType = "category.name"
			channelName = [undefined, undefined]
			channelName[0] = name.match(/.+\./giu)[0]
			channelName[0] = channelName[0].substring(0, channelName[0].length - 1).trim()
			channelName[1] = name.match(/\..+/giu)[0]
			channelName[1] = channelName[1].substring(1).trim()

		} else if (!isNaN(name) && /\d+[^A-Z\s]/giu.test(name)) {
			// id/snowflake
			// If the channel is given by ID, it must be universally unique, so we just return that (inside an array for consistency)
			return [guild.channels.resolve(name)]

		} else {
			// probably name
			channelNameType = "name"
			channelName = name.trim()

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
				if (channel[1].parent.name.trim() === channelName[0] && channel[1].name.trim() === channelName[1]) {
					channels.push(channel[1])
				}
			}
		}
	}

	channels.sort((a, b) => (a.rawPosition - b.rawPosition))

	return channels
}

bot.login(config.token)
