"use strict"

// Imports
const text = require("./text.json")
const Discord = require("discord.js")
const util = require("./util.js")

// Exports
module.exports = {
	move: moveCmd,
	delete: deleteCmd,
	help: helpCmd,
	roll: rollCmd,
	poll: pollCmd

}


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
		toChannel = util.getGuildChannels(message.guild, "v", channels[0])

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
		fromChannel = util.getGuildChannels(message.guild, "v", channels[0])
		toChannel = util.getGuildChannels(message.guild, "v", channels[1])
		
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
			let res = util.parseDiceNotation(currentSetOfParentheses)
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

function pollCmd(message) {
	/*
	* Creates a poll as a reply to the command.
	* 
	* The message it sends collects reactions for a time specified
	* in the command, then tallies up the votes and
	* sends the result in another message.
	*
	* The format for the poll info is as follows:
	* >poll [poll title]; [voting options]; [voting time (optional)]
	*
	* Voting options are seperated by periods.
	* Each voting option may be prepended by an emoji
	* (anything, which can be a reaction).
	* If prepended by such an emoji, that emoji will be used for the reactions.
	* If not prepended by any emoji, a random emoji from the Discord guild will
	* be chosen instead.
	*
	* Voting time can be in any of the following formats:
	* - [dd]d [HH]h [mm]m [ss]s,
	* - [dd]:[HH]:[mm]:[ss],
	* - number of seconds,
	* where 0 <= [dd] < 7, 0 <= [HH] < 24, 0 <= [mm] < 60, 0 <= [ss] < 60.
	* The last format may be any number of seconds greater than 0.
	* In the second format, hours may be omitted.
	* In the first format, any units may be omitted.
	* The total time must be more than 0 seconds, and less than 7 days.
	* 
	* message - type Message, must be from a guild
	* 
	* returns - false on failure, true on success
	*/

	try {
		// Parse the command
		let command = message.cleanContent.split(";")
		command[0] = command[0].substring(command[0].indexOf(" "))
		let pollTimeout = util.parseTime(command[2])
		let pollOptions = []
		let pollOptionsFormatted = ""

		let i = 0
		command[1].split(".").forEach(option => {
			// Format the poll options
			option = option.replace(/\s/gim, " ").trim()

			if (option != "") {
				let reaction = text.other.pollReactions[i]
				pollOptions.push({
					reaction: reaction,
					text: option,
					count: 0
				})

				pollOptionsFormatted += `${reaction}: ${option}.\n`
				
				i += 1
				
			}

		})

		// Delete the command message
		if (message.deletable) {
			message.delete()

		}

		// Create the poll
		message.channel.send(text.success.poll.created
			.replace("{title}", command[0].trim())
			.replace("{options}", pollOptionsFormatted)
		).then(message => {
			// Add the initial poll reactions
			pollOptions.forEach(async option => {
				await message.react(option.reaction)

			})

			// Await the reactions
			return message.awaitReactions(
				() => true,
				{time: pollTimeout}
			)
		}).then(votes => {
			// After the poll ends, tally up the votes
			votes = Array.from(votes.values())
			let results = ""
			let totalCount = 0

			votes.forEach(vote => {
				// Count the votes
				try {
					pollOptions.find(option => {
						return option.reaction === vote.emoji.name
					}).count += vote.count - 1

					totalCount += vote.count - 1
					
				} catch (error) {

				}

			})

			pollOptions.forEach(option => {
				// Calculate the percentage of votes each option got
				let votePercentage

				if (totalCount != 0) {
					votePercentage = (option.count / totalCount) * 100
					votePercentage = votePercentage.toFixed(0)

				} else {
					votePercentage = 0

				}

				// Format the poll result
				if (option.count !== 1) {
					results += `${votePercentage}% - ${option.text}.` +
						` - ${option.count} votes.\n`

				} else {
					results += `${votePercentage}% - ${option.text}.` +
						` - ${option.count} vote.\n`

				}

			})

			// Send the poll result
			message.channel.send(text.success.poll.finished
				.replace("{title}", command[0].trim())
				.replace("{results}", results.trim())
			)

		}).catch(() => {
			message.channel.send(text.fail.poll)

		})

	} catch {
		message.channel.send(text.fail.poll)

	}

}
