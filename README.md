# adyen-salesforce-proxy

Copyright 2021 AppFrontier, LLC

Node.js server implementation for proxying HTTP Basic Auth callbacks from Adyen to OAuth2 JWT Rest API on Salesforce Connected App.

__Chargent Labs Notice:__ This is experimental software. This guide solely describes how to deploy a test environment. Production deployment suggestions are provided at the end of this document, and you should follow your organization's deployment procedures and policies for your environment. What is outlined in this guide is not a recommended production configuration or guaranteed to be a secure configuration. AppFrontier, LLC does not warranty, guarantee, or assume any liability for the code in this repository or setup instructions in this guide. USE AT YOUR OWN RISK.

## Prerequisites

In order to deploy this software to a test environment you will need the following:

1. A Salesforce sandbox
1. An Adyen sandbox
1. A cloud server with a routable IP and available port

## Test Deployment

This guide assumes an Ubuntu/Debian cloud server for running the node JS application.

### Cloud Server Deployment

* Login to cloud server, install node.js, install proxy application

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash		# https://github.com/nvm-sh/nvm
nvm install node
sudo mkdir /opt/chargent
sudo chown $(id -u):$(id -g) /opt/chargent-labs
sudo /opt/chargent-labs
git clone git@github.com:Appfrontier/adyen-salesforce-proxy.git
cd adyen-salesforce-proxy
npm install
```

* Configure the secrets

__Note:__ Follow your IS procedures for generating, transmitting, and storing x509 secrets.

```
node config/basicautheconfig.js	# enter strong un/pw for basic auth - will be stored encrypted at rest on local fs in file config/basicauthconfig.js.enc
cd config
openssl req -nodes -new -x509 -keyout key.pem -out server.cert	# protect key.pem - this is the private key that will enable oauth jwt to access salesforce connected app
```

* The default port is 3000. Many cloud servers will not allow you to bind a process to a firewall port such as 80 unless you are running as root. Setup an iptables rule to forward port 80 to port 3000 to allow for testing. You need to persist the iptables rule below for it to be run after a server restart. Any other system configuration, setup, troubleshooting is out of scope for this testing guide, however, there is some production deployment guidance at the end of this guide.

```
sudo iptables -t nat -I PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3000
```

### Configure Salesforce Connected App

* Create the Salesforce Connected App (according to your Salesforce IS policies)
* Select "Use digital signatures"
* Upload the `server.cert` generated on Cloud Server
* Copy Consumer Key
* Go to Manage Connected App
* Click Edit Policies
* You have two options for OAuth Policies | Permitted Users: `All users may self-authorize` and `Admin approved users are pre-authorized`. Select the option that makes the most sense for you environment. _Note:_ If you choose `All users may self-authorize` then you will need to manually perform an OAuth2 workflow that generates the `refresh_token` otherwise JWT will not work.

### Configure Cloud Server - Salesforce Credentials

* Log into cloud server

```
cd /opt/chargent-labs/adyen-salesforce-proxy
vim config/oauthcongfig.js
```

* Enter in the Salesforce credentials and save

```
module.exports = {
	consumer_key: "<Your Consumer Key>",
	login_url: "https://test.salesforce.com",
	username: "<Your Sandbox Username>",
	apex_rest: "/services/apexrest/ChargentBase/WebhookNotifications/v1/Adyen"
}
```

* Start the server in debug mode

```
PROXY_DEBUG=true npm start
```

* Test a GET request Basic Auth end-point which will send a SOQL query to Salesforce in debug mode.

```
$ curl -u <basicauth-username>:<basicauth-password> http://<Your Cloud Server IP Address>:80/
[ok]
```

And, in the proxy server log you will see:

```
***Running proxy in DEBUG mode.***
GET / 200 4.982 ms - 4
{"attributes":{"type":"Account","url":"/services/data/v42.0/sobjects/Account/0011F00000vSLrBQAW"},"Id":"0011F00000vSLrBQAW","Name":"test"}
```

* Test a POST request to Basic Auth end-point which will send an POST to the Apex Rest API:

```
curl -u <basicauth-username>:<basicauth-password> -X POST http://<Your Cloud Server IP Address>:80/--header 'Content-Type: application/json' --data-raw '{"live":"false","notificationItems":[{"NotificationRequestItem":{"amount":{"currency":"EUR","value":500},"eventCode":"CAPTURE","eventDate":"2018-22T15:54:01+02:00","merchantAccountCode":"YourMerchantAccount","originalReference":"7914073381342284","paymentMethod":"mc","pspReference":"8825408195409505","reason":"","success":"true"}}]}'
[accepted]
```

And, in the proxy server log you will see:

```
[Request]: {"live":"false","notificationItems":[{"NotificationRequestItem":{"amount":{"currency":"EUR","value":500},"eventCode":"CAPTURE","eventDate":"2018-22T15:54:01+02:00","merchantAccountCode":"YourMerchantAccount","originalReference":"7914073381342284","paymentMethod":"mc","pspReference":"8825408195409505","reason":"","success":"true"}}]}
POST / 200 17.266 ms - 10
[Response]: [accepted]
```

### Configure Adyen Calbacks

* Login to the Adyen admin panel
* Select Developers | Webhooks and Create Webhook
* Enter URL value `http://<Your Cloud Server IP Address>:80/`
* Enter SSL Version `NO_SSL...`
* Enter Authentication Username `<basicauth-username>`
* Enter Authentication Password `<basicauth-password>`
* Click Test Configuration and review Success message

Congratulations, you've successfully configured the Adyen proxy server! Follow the Chargent Adyen setup guide for more details on how to setup Chargent with Adyen.

## Production Deployment Guidance

### Encryption in Transit
* The primary production deployment consideration is how to manage TLS encryption for the Basic Auth callback from Adyen to cloud server. Use your cloud load balancer and certificate workflow to encypt data traversing the Internet. Another alternative would be run Nginx reverse proxy on your cloud server and use Let's Encrypt to generate a self-signed certificate.
### Network Security
* Adyen does not publish a list of IP addresses for whitelisting. If your firewall supports it you can use a [domain allowlists](https://docs.adyen.com/development-resources/webhooks/domain-and-ip-addresses).
* Salesforce does supports restricting IP address access to the connected app, more details can be found [here](https://help.salesforce.com/s/articleView?id=sf.connected_app_continuous_ip.htm&type=5).
### Application Deployment
* Best practices for running express.js can be found [here](https://expressjs.com/en/advanced/best-practice-performance.html).
* There are many server hardening guides depending on your production OS.
* Consider a reverse proxy such as Nginx.
### Secrets Management
* The Http Basic Auth credentials are encrypted on the cloud server.
* The certificate primary key key.pem is a secret that should be stored securly on the host. Use your cloud provider secret management framework. Another alternative would be to use Vault.