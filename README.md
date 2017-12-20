# uv_helper

Source Code to Alexa skill that requests the user's location from Amazon (once the user has given the skill access) and uses the zip code to request local UV data from the EPA. Alexa then tells the user the UV level for their local zip code or the zip code they specified for the current time or the time they specified.

I came up with this idea before learning about Oauth 2.0 and I had to nest the callbacks for the location and UV since the requests are asynchronous. 

To Do: 
Clean up the code a bit
Perhaps add an option for information about UV data OR sunscreen advice in the response.
