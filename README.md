# GSG3 Global Ai Bot

This is a simple Node.js Chat bot with ChatGPT Integration based on the simplest possible nodejs api using express that responds to most requests within guidelines.

It considers a context file for every message so you can give it background information about your stream, your socials, your stream rewards, stream currency and so on. 

You can choose if you want it to run in prompt mode (without context of previous messages) or in chat mode (with context of previous messages).

Discord Connection is available but requires you setup an app and bot through the developer portal. This comes preloaded with two commands (/votekick & /clear), Support channel limited functionality (updates coming)

![redcode symbol_1red12](https://github.com/user-attachments/assets/fb67f5a3-a1db-46c0-a78d-cdd8822c2a9c)


# How to use

This bot functions on Nodes.js and needs to be deployed through a web service or locally 

You also need to acquire your Twitch oAUth token and Client ID

As well as an OPENAI API Key and Discord Client ID and Channel Deployment

You're welcome to setup an additional .env file and store your environment variables there, otherwise they've already been established where you only need to add them and apply your individual key values for each respective variable.

# WARNING

This process can get confusing because you need to use a secondary twitch account and setup a bot application through the twitch developer portal with a Client ID connecting to your chat with your channels oAuth Token.

You are also required to deploy this using a local host like Docker, or on as a webservice through a website like Render

Environment variables are required instead of plainly display user specific key values, but do not post these directly into any visible files

# UPDATES

Updates are constantly in progress for the overall functionality and advancement of basic features, as well as connectivity through various platforms.



GSG3NTERTAINMENT LTD, CO. ~ https://www.gsg3.org
