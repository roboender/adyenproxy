const fs = require("fs")
const prompt = require("prompt")
const crypto = require("crypto")

const properties = [
	{
		name: "username",
		description: "Username"
	},
	{
		name: "password",
		description: "Password",
		hidden: true
	},
	{
		name: "confirmPassword",
		description: "Confirm Password",
		hidden: true
	}
]

prompt.message = ""
prompt.start()

prompt.get(properties, function (err, result) {
	if (err) { return onErr(err) }
	if (result.password !== result.confirmPassword) {
		return onErr("Passwords do not match try again.")
	}
	writeCredentialsToFile(result.username, result.password)
})

function onErr(err) {
	console.log(err)
	return 1
}

function writeCredentialsToFile(username, password) {
	const salt = crypto.randomBytes(16)
	const encUsername = crypto.scryptSync(username, salt, 64)
	const encPassword = crypto.scryptSync(password, salt, 64)
	const credentials = salt.toString("hex") + "\n"
		+ encUsername.toString("hex") + "\n"
		+ encPassword.toString("hex")
	fs.writeFile(
		"config/basicauthconfig.enc",
		credentials,
		"utf-8",
		function (err) { if (err) return console.log(err) }
	)
}