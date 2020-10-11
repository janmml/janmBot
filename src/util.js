"use strict"

// Imports
const config = require("./config.json")
const text = require("./text.json")
const Discord = require("discord.js")
const crypto = require("crypto")

// Exports
module.exports = {
	rollDice: rollDice,
	parseDiceNotation: parseDiceNotation,
	getGuildChannels: getGuildChannels,
	parseTime: parseTime,
	logUpdatedMessage: logUpdatedMessage,
	logDeletedMessage: logDeletedMessage

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

	// Check if amount and sides are integers
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
		case "v":
		case "voice":
		case "VoiceChannel":
			channelType = "voice"
			break

		case "t":
		case "text":
		case "TextChannel":
			channelType = "text"
			break

		case "c":
		case "category":
		case "CategoryChannel":
			channelType = "category"
			break

		case "n":
		case "news":
		case "NewsChannel":
			channelType = "news"
			break

		case "s":
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

function parseTime(time) {
	/*
	* Parses time from the string [time]
	*
	* [time] can be in any of the following formats:
	* - [dd]d [HH]h [mm]m [ss]s,
	* - [dd]:[HH]:[mm]:[ss],
	* - number of seconds,
	* where 0 <= [dd] < 7, 0 <= [HH] < 24, 0 <= [mm] < 60, 0 <= [ss] < 60.
	* The last format may be any number of seconds greater than 0.
	* In the second format, hours may be omitted.
	* In the first format, any units may be omitted.
	* The total time must be more than 0 seconds, and less than 7 days.
	*
	* Throws SyntaxError, if [time] syntax is wrong.
	* 
	* time - type string, of the format described above
	* 
	* returns - The number of milliseconds in [time]
	*/

	// Pre-prepare time
	time = (time || "").trim() || "10m"
	let seconds = 0

	if (time.includes(":")) {
		// Format is [dd]:[HH]:[mm]:[ss]
		try {
			// Split the time into and array of ss, mm, HH, dd
			time = time.split(":").reverse()

			// Check if minutes and seconds are specified
			if (time[0].trim() === "" || time[1].trim() === "") {
				throw new SyntaxError("Time " + time + " is invalid.")
			}

			// Add all values to the return variable, seconds
			seconds += parseInt(time[0], 10)
			seconds += parseInt(time[1], 10) * 60
			if (time[2] !== undefined) {
				seconds += parseInt(time[2], 10) * 3600

				if (time[3] !== undefined) {
					seconds += parseInt(time[3], 10) * 86400
	
				}

			}

		} catch (error) {
			throw new SyntaxError("Time " + time + " is invalid.")
		}


	} else if (/[dhms]/gi.test(time)) {
		// Format is [dd]d [HH]h [mm]m [ss]s
		time.split(" ").forEach(value => {
			switch (value[value.length - 1]) {
				case "s":
					// Add seconds to the return variable
					seconds += parseInt(value, 10)
					break

				case "m":
					// Add minutes to the return variable
					seconds += parseInt(value, 10) * 60
					break

				case "h":
					// Add hours to the return variable
					seconds += parseInt(value, 10) * 3600
					break

				case "d":
					// Add days to the return variable
					seconds += parseInt(value, 10) * 86400
					break

			}
			
		})

	} else {
		// Format is [number of seconds]
		seconds = parseInt(time, 10)

	}

	// Make sure time is within limits
	if (seconds < 1 || seconds > 604800 || isNaN(seconds)) {
		throw new SyntaxError("Time " + time + " is invalid.")
	}

	return seconds * 1000
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
		msg.attachments.array().forEach((item) => {
			attachments.push(item.proxyURL)
		})

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
