var axios = require("axios")
var jsforce = require("jsforce")
var jwt = require("jsonwebtoken")
var moment = require("moment")
var querystring = require("querystring")
var url = require("url")

async function getConn(app) {

	var conn

	var jwtparams = {
		iss: app.locals.credentials.consumer_key,
		prn: app.locals.credentials.username,
		aud: app.locals.credentials.login_url,
		exp: parseInt(moment().add(2, "minutes").format("X"))
	}

	var token = jwt.sign(jwtparams, app.locals.privateKey, { algorithm: "RS256" })

	var params = {
		grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
		assertion: token
	}

	// get the access_token and create the jsforce connection
	var token_url = new url.URL("/services/oauth2/token", app.locals.credentials.login_url).toString()
	await axios.post(token_url, querystring.stringify(params))
		.then(function (res) {
			conn = new jsforce.Connection({
				loginUrl: app.locals.credentials.login_url,
				instanceUrl: res.data.instance_url,
				accessToken: res.data.access_token
			})
		}).catch(function (error) {
			if (error.response) {
				// Request made and server responded
				console.log(error.response.status)
				console.log(error.response.data)
				console.log(error.response.headers)
			} else if (error.request) {
				// The request was made but no response was received
				console.log(error.request)
			} else {
				// Something happened in setting up the request that triggered an Error
				console.log(error.message)
			}
			console.log("[Fatal]: Unable to establish oauth jwt, exiting...")
			process.exit(1)
		})

	return conn
}

module.exports = getConn