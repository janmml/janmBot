"use strict"

// Imports
const config = require("./config.json")
const text = require("./text.json")
const Discord = require("discord.js")
const crypto = require("crypto")

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
			helpCmd(message)

		} catch (error) {
			message.channel.send(text.fail.help)

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

	} else if (message.content.startsWith(">roll")) {
		// Roll command:
		try {
			rollCmd(message)

		} catch (error) {
			message.channel.send(text.fail.roll)

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

function helpCmd(message) {
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

		message.channel.send(helpMessage, {split: true})

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

}

function rollCmd(message) {
	/*
	* Rolls dice specified using Dice notation
	* (see https://en.wikipedia.org/wiki/Dice_notation and
	* https://roll20.zendesk.com/hc/en-us/articles/360037773133)
	* from the message, then replies with the result.
	*
	* The dice to be rolled (in Dice notation) is
	* the first part of message text after a " ".
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

	// Get the dice to be rolled
	let cmd = message.cleanContent.substring(
		message.cleanContent.split(" ")[0].length
	).trim()

	// If the user is asking about supported rolls, send that message
	if (cmd === "supported") {
		message.channel.send(text.other.supportedRolls)
		return
	}

	let initialCmd = cmd

	// Remove all spaces from cmd
	cmd = cmd.split(" ").join("")

	// Add default parentheses (needed later on)
	cmd = "(" + cmd + ")"


	// Check the cmd syntax
	if (cmd.split("(").length != cmd.split(")").length) {
		// Check for balanced parentheses
		message.channel.send(text.fail.roll)
		return
	} else if (!/[\d%‰‱Fb]/gi.test(cmd)) {
		// Check if it contains at least one digit (or other die symbol)
		message.channel.send(text.fail.roll)
		return
	}

	// Prepare the variable, which hold the results of the parsing
	let equations = cmd + "\n"

	// Get the result
	try {
		// While (true) loop equivalent, but with a limit of 1000, in case
		// the break doesn't get reached for some reason
		for (let i = 0; i < 1000; i++) {
			// Go through the parentheses, most to least nested
			let parentheses = {}
			let levelCounter = 0
			let maxLevel = 0
	
			// Get the indices of all opening parentheses
			// and their respective levels of nestedness
			for (let i = 0; i < cmd.length; i++) {
				if (cmd[i] === "(") {
					levelCounter++
					parentheses[i] = levelCounter
					
					if (levelCounter > maxLevel) {
						maxLevel = levelCounter
	
					}
	
				} else if (cmd[i] === ")") {
					levelCounter--
	
				}
	
			}

			// Find the most nested sets of parentheses ...
			let parenthesisIndices = Object.keys(parentheses).filter(
				key => parentheses[key] == maxLevel
			)

			// ... and go through the left-most set
			let j = parseInt(parenthesisIndices[0]) + 1
			let k = cmd.indexOf(")", j)
			let currentSetOfParentheses = cmd.substring(j, k)

			// Process the contents of the parentheses
			let res = parseDiceNotation(currentSetOfParentheses)
			equations += cmd.substring(0, j) + res + cmd.substring(k) + "\n"
			if (res.includes("(")) {
				cmd = cmd.substring(0, j) + res + cmd.substring(k)
				cmd = cmd.split(" ").join("")
				continue
			}

			// Do the math
			res = res.split(" ")

			// While (true) loop equivalent, but with a limit of 1000, in case
			// the break doesn't get reached for some reason
			let regex = /^[\/÷\*×]$/gi
			for (let l = 0; l < 1000; l++) {
				// Do all the division/multiplication
				if (res.find(m => regex.test(m)) === "*") {
					// If the left-most division/multiplication is *
					let n = res.indexOf("*")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) * parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "×") {
					// If the left-most division/multiplication is ×
					let n = res.indexOf("×")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) * parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "/") {
					// If the left-most division/multiplication is /
					let n = res.indexOf("/")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) / parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "÷") {
					// If the left-most division/multiplication is ÷
					let n = res.indexOf("÷")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) / parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === undefined) {
					// If there aren't any more division/multiplication symbols
					break
				}

				// If this looped too many times, assume an error and stop
				if (l == 999) {
					message.channel.send(text.fail.roll)
					return
				}

			}

			// While (true) loop equivalent, but with a limit of 1000, in case
			// the break doesn't get reached for some reason
			regex = /^[+\-–—−]$/gi
			for (let l = 0; l < 1000; l++) {
				// Do all the addition/subtraction
				if (res.find(m => regex.test(m)) === "+") {
					// If the left-most addition/subtraction is +
					let n = res.indexOf("+")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) + parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "-") {
					// If the left-most addition/subtraction is a hyphen-minus
					let n = res.indexOf("-")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) - parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "–") {
					// If the left-most addition/subtraction is an endash
					let n = res.indexOf("–")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) - parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "—") {
					// If the left-most addition/subtraction is an emdash
					let n = res.indexOf("—")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) - parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === "−") {
					// If the left-most addition/subtraction is a minus
					let n = res.indexOf("−")
					res.splice(n - 1,
						3,
						parseInt(res[n - 1]) - parseInt(res[n + 1])
					)

				} else if (res.find(m => regex.test(m)) === undefined) {
					// If there aren't any more addition/subtraction symbols
					break
				}

				// If this looped too many times, assume an error and stop
				if (l == 999) {
					message.channel.send(text.fail.roll)
					return
				}

			}

			// Remove the parentheses
			res = res.join(" ")
			cmd = cmd.substring(0, j - 1) + res + cmd.substring(k + 1)
			equations += cmd + "\n"

			// End the loop if the roll has been completed
			if (cmd.split("(").length === 1) {
				break
			}

			// If this looped too many times, assume an error and stop
			if (i == 999) {
				message.channel.send(text.fail.roll)
				return
			}

		}

		// Escape asterisks, needed for markdown reasons
		equations = equations.split("*").join("\\*")
		initialCmd = initialCmd.split("*").join("\\*")

		// Limit the size of the text variables, if they're too long
		if (equations.length > 1020) {
			equations = equations.substring(
				0,
				500
			) + "\n...\n" + equations.substring(
				equations.length - 500
			)

		}
		if (initialCmd.length > 255) {
			initialCmd = initialCmd.substring(0, 252) + "..."

		}

		// Send the result in an embed
		let resultEmbed = new Discord.MessageEmbed()
		.setTitle(cmd)
		.addField(initialCmd, equations)
		message.channel.send(resultEmbed).catch(console.log)

	} catch (error) {
		message.channel.send(text.fail.roll)

	}

}


// Utility functions
function rollDice(amount, sides) {
	/*
	* Rolls [amount] of [sides]-sided dice, then adds the results.
	* Both amount and sides have a limit of 65536,
	* and both must be positive integers.
	*
	* amount - number (integer) - The amount of dice to be rolled.
	*
	* sides - number (integer) - The amount of sides each die has.
	*
	* Returns an array, the first element being the sum of the dice rolls,
	* the second element being an array of all the individual rolls,
	* in the order they were rolled.
	*/

	// Check if amount and sides aren't too big
	if (amount > 65536 || sides > 65536) {
		throw new RangeError("Amount and sides must be less than 65536.")
	}

	// Check if amount and sides are positive
	if (amount < 1 || sides < 2) {
		throw new RangeError("Amount and/or sides are too small.")
	}

	// Check if amount and sides are ints
	if (!(Number.isInteger(amount) && Number.isInteger(sides))) {
		throw new TypeError("Amount and sides must be integers.")
	}

	// Declare array, which holds rolling results
	let rolls = [0, []]

	// Roll the dice
	for (; amount > 0; amount--) {
		// The following should solve the bias problems mentioned in
		// https://gist.github.com/joepie91/7105003c3b26e65efcea63f3db82dfba,
		// in a similar way to crypto-secure-random-digit
		// (https://www.npmjs.com/package/crypto-secure-random-digit), but
		// with a flexible maximum value.

		let roll = crypto.randomBytes(2).readUInt16BE(0)
		const maxRandom = (65536 - (65536 % sides)) - 1

		while (roll > maxRandom) {
			// Re-roll the random number
			roll = crypto.randomBytes(2).readUInt16BE(0)
		}

		roll = (roll % sides) + 1
	
		rolls[0] += roll
		rolls[1].push(roll)

	}

	return rolls
}

function parseDiceNotation(dn) {
	/*
	* Parse a bit of dice notation (without parentheses), and return the
	* result, rolling dice if necessary.
	*
	* dn - string - The bit of dice notation
	* (see https://en.wikipedia.org/wiki/Dice_notation and
	* https://roll20.zendesk.com/hc/en-us/articles/360037773133)
	*
	* Currently supports the following*:
	* *Capital letters represent numbers, brackets surround optional parts.
	* - A
	* - +, -, *, ×, /, ÷, (, )
	* - [A]dB
	* - [A]d%, [A]d‰, [A]d‱
	*
	* returns - The result of the parsing of the supplied dice notation,
	* as a string, after rolling all dice. The returned string will be
	* a mathematical equation, with addition, subtraction, multiplication and
	* division. All dice rolls will be converted into such equations as well
	* (for example "3d8" would be turned into "5 + 4 + 1", then inserted into
	* the original input string in the place of "3d8").
	*/

	// Prepare the result-holding variable
	let res = " "

	// Account for percentile, permille-ile, and permyriad-ile dice
	dn = dn.split("d%").join("d100")
		.split("d‰").join("d1000")
		.split("d‱").join("d10000")

	// Split the dn at all mathematical symbols (keeping those symbols)
	dn = dn.split(/((?<![+\-–—−*×\/÷])[+\-–—−*×\/÷](?![LH+*×\/÷]))/gi)

	// Go through all logical parts, and if they represent die rolls,
	// roll those dice, turning them into numbers
	for (let i of dn) {
		if (/^[\-–—−]?\d+$/gi.test(i)) {
			// If it's a number
			res += i + " "

		} else if (/^[+\-–—−\*×\/÷]$/gi.test(i)) {
			// If it's a mathematical symbol
			res += i + " "
			
		} else if (/^d\d+$/gi.test(i)) {
			// If it's a die roll (without the number of dice specified)
			let dieRoll = rollDice(1,
				parseInt(i.substring(1))
			)[1]
			res += dieRoll.join(" + ") + " "
			
		} else if (/^\d+d\d+$/gi.test(i)) {
			// If it's a die roll (with the number of dice specified)
			let dieRoll = rollDice(parseInt(i.substring(0, i.indexOf("d"))),
				parseInt(i.substring(i.indexOf("d") + 1)))[1]
			res += "(" + dieRoll.join(" + ") + ") "
			
		} else {
			throw new SyntaxError("Logical part not supported: " + i)
		}

	}

	return res.trim()

}

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
		// Get message attachments
		let attachments = []
		// sorry
		msg.attachments.array().forEach((item) => {attachments.push(item.proxyURL)})

		// Get logging channel from config
		getGuildChannels(msg.guild, "text", config.deletedMsgsChannel)[0]
		// Send the message
		.send(text.other.deletedMessage
			.replace("{message}", msg.content)
			.replace("{author}", msg.author.toString())
			.replace("{date}", msg.createdAt.toISOString()),
			{embed: msg.embed, split: true, files: attachments})

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
		// Get message attachments
		let oldAttachments = []
		let newAttachments = []
		
		oldMsg.attachments.array().forEach((item) => {
			oldAttachments.push(item.proxyURL)
		})
		newMsg.attachments.array().forEach((item) => {
			newAttachments.push(item.proxyURL)
		})

		// Ignore messages, that differ only in embed
		// (this happens when an embed loads).
		if (oldMsg.id === oldMsg.id &&
			oldMsg.author.id === oldMsg.author.id &&
			oldMsg.content === oldMsg.content &&
			oldMsg.tts === oldMsg.tts &&
			oldMsg.nonce === oldMsg.nonce &&
			oldMsg.attachments.length === oldMsg.attachments.length &&
			oldMsg.embeds.length < newMsg.embeds.length
		) {
			return false
		}

		// Get logging channel from config
		let loggingChannel = getGuildChannels(newMsg.guild, "text",
			config.updatedMsgsChannel)[0]

		// Send the message
		loggingChannel.send(text.other.updatedMessage
			.replace("{oldMessage}", oldMsg.content)
			.replace("{author}", oldMsg.author.toString())
			.replace("{date}", oldMsg.createdAt.toISOString()),
			{embed: oldMsg.embed, split: true, files: oldAttachments})
		// Then send the second (new) message
		.then(message => {
			// Access the nonce of the first message before sending the
			// second one, so that they get received by Discord
			// in the correct order. This helps, because the message nonce only
			// shows once the message is received by the API.
			if (typeof(message) == typeof(Discord.Message)) {
				// If one message is returned
				// Do something useless
				if (message.nonce) {}
			} else {
				// If an array of multiple messages is returned
				// Do something useless
				if (message[0].nonce) {}
			}

			loggingChannel.send("\"" + newMsg.content + "\"",
				{embed: newMsg.embed, split: true, files: newAttachments})

		}

		)

		return true
	} catch (error) {
		// Catch the error and ignore it
		return false
	}
}


bot.login(config.token)
