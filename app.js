// express
var createError = require("http-errors")
var express = require("express")
var path = require("path")
var cookieParser = require("cookie-parser")
var logger = require("morgan")

// basic authentication
const basicAuth = require("express-basic-auth")
const scmp = require("scmp")
const crypto = require("crypto")
const fs = require("fs")

// available routes
var indexRouter = require("./routes/index.js")

var app = express()

// proxy debug
var proxyDebug = process.env.PROXY_DEBUG || false
app.locals.proxyDebug = proxyDebug
if (proxyDebug) {
	console.log("***Running proxy in DEBUG mode.***")
}

// load basic auth credentials
var salt
var encUsername
var encPassword
try {
	const data = fs.readFileSync("./config/basicauthconfig.enc", "utf-8")
	const credentials = data.split("\n")
	salt = Buffer.from(credentials[0], "hex")
	encUsername = Buffer.from(credentials[1], "hex")
	encPassword = Buffer.from(credentials[2], "hex")
} catch (err) {
	console.error(err)
	process.exit(1)
}

// basic auth setup
app.use(basicAuth({
	authorizer: (username, password, authCallback) => {
		const usernameMatches = scmp(crypto.scryptSync(username, salt, 64), encUsername)
		const passwordMatches = scmp(crypto.scryptSync(password, salt, 64), encPassword)
		if (usernameMatches & passwordMatches)
			return authCallback(null, true)
		else
			return authCallback(null, false)
	},
	authorizeAsync: true,
	challenge: true
}))

// TODO: use node standard env and logging
app.use(logger("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

app.use("/", indexRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404))
})

// error handler
app.use(function(err, req, res) {
	// set locals, only providing error in development
	res.locals.message = err.message
	res.locals.error = req.app.get("env") === "development" ? err : {}

	// render the error page
	res.status(err.status || 500)
	if (proxyDebug) {
		res.render("error")
	} else {
		res.send("[error]")
	}
})

// load oauth jwt config
app.locals.privateKey = fs.readFileSync("./config/key.pem")
app.locals.credentials = require("./config/oauthconfig.js")

const getConn = require("./conn.js")
getConn(app).then(function(conn) {
	app.locals.conn = conn
})

module.exports = app