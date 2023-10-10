var express = require("express")
const getConn = require("../conn")
var router = express.Router()

// get method tests connectivity
router.get("/", function(req, res) {
	if (req.app.locals.proxyDebug) {
		var soqlQuery = "SELECT Id, Name FROM Account LIMIT 1"
		console.log("[Request]: " + soqlQuery)
		req.app.locals.conn.query(soqlQuery, function (err, results) {
			console.log("[Response]: " + JSON.stringify(results.records[0]))
		})
	}
	res.status(200)
	res.send("[ok]")
})

// post method proxies the request
router.post("/", function(req, res) {
	if (req.app.locals.proxyDebug) {
		console.log("[Request]: " + JSON.stringify(req.body))
	}

	req.app.locals.conn.apex.post(req.app.locals.credentials.apex_rest, req.body, function (err, results) {
		if (err) {
			console.log("[Error]: " + err)

			// TODO: Salesforce OAuth JWT workflow suggest that a refresh_token is not needed, yet
			// the access_token (Session ID) is timing out and we need to re-establish the session.
			console.log("Re-establishing session.")

			getConn(req.app).then(function (conn) {
				// replace the connection
				req.app.locals.conn = conn

				req.app.locals.conn.apex.post(req.app.locals.credentials.apex_rest, req.body, function (err, results) {
					if (err) {
						console.log("[Error]: " + err)
						console.log("[Fatal]: Unable to re-establish session, exiting...")
						process.exit(1)
					}
					if (req.app.locals.proxyDebug) {
						console.log("[Response]: " + results)
					}
				})
			})
		}

		if (!err) {
			if (req.app.locals.proxyDebug) {
				console.log("[Response]: " + results)
			}
		}
	})

	res.status(200)
	res.send("[accepted]")
})

module.exports = router
