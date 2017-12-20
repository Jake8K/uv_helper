'use strict';
var Alexa = require('alexa-sdk');
var https = require('https');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
//let moment = require('moment');
  //  require('moment-timezone');
var zipcode_to_timezone = require('zipcode-to-timezone');
const AlexaDeviceAddressClient = require('./AlexaDeviceAddressClient');


var APP_ID = "amzn1.ask.skill.02669dc3-72dc-4195-bf2d-c115a0854c6a"; // undefined; //OPTIONAL: replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";
var SKILL_NAME = 'UV Helper';
const ziPermission = "read::alexa:device:all:address:country_and_postal_code";


var phrases = [
    "Better put on sunscreen, but try to stay in the shade. It's a scorcher!", //UV high
    "If I were organic, I'd wear some sunscren today and enjoy the sun. Yes, you should stink of sun screen today.", //UV med-high
    "You probably want to play it safe and wear sunscreen, but U.V. level's aren't very high", //uv med-low
    "The U.V. is pretty low right now so don't worry about sun screen. Get out there!", //uv low
    "No, you definitely don't need to stink of sunscreen right now, enjoy!.", //no uv
    "UV levels are dangerously high, if you can't avoid being exposed wear as much protection as possible (yes, that includes sun-block)... Thanks climate change!" //uv is dangerously high
];

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
var loc = {};
var handlers = {
    'GetCurrentLocalUV': function () {
      //After customer consent is obtained, a launch request to your skill
      //from Alexa includes a user object that contains a consent token and device ID.
      //var loc = {};
      console.log(this.event.session.context);
      console.log(this.event);
  //    console.log("good luck!");
      var deviceId = (((this.event.context || {}).System || {}).device || {}).deviceId;
//      this.emit(':tell', deviceId);
      //var deviceId = this.event.context.System.device.deviceId;
      console.log("device ID: " + deviceId);
      //const consentToken = (((this.event.context || {}).System || {}).user || {}.permissions || {}).consentToken;
     var self = this;
      if (this.event.context) {
          const consentToken = this.event.context.System.user.permissions.consentToken;
      //var consentToken = this.event.session.user.userID.permissions.consentToken;
 //     this.emit(':tell', consentToken);
      console.log("consent token: " + consentToken);

      //const apiEndpoint = ((this.event.context || {}).System || {}).apiEndpoint;
      const apiEndpoint = this.event.context.System.apiEndpoint;
 //     this.emit(':tell', apiEndpoint);


      if (consentToken !== undefined && deviceId !== undefined) {
      //get zip code from Amazon (w user permission token)
      const alexaDeviceAddressClient = new AlexaDeviceAddressClient(apiEndpoint, deviceId, consentToken);
      //this.emit(':tell', JSON.stringify(alexaDeviceAddressClient));
      let deviceLocationRequest = alexaDeviceAddressClient.getCountryAndPostalCode();
      deviceLocationRequest.then((locationResponse) => {
          //this.emit(':tell', "device API response: " + locationResponse.statusCode);
          //this.emit(':tell', JSON.stringify(locationResponse));
          switch(locationResponse.statusCode) {
              case 200:
                  console.log("Location data is in hand!");
                  //request the UV index!
                  loc.country = locationResponse.address.countryCode;
                  loc.zip = locationResponse.address.postalCode;
                  //this.emit(':tell', "country " +loc.country+ " postal code " +loc.zip);
                  console.log("making UV request to EPA now...");
                  makeUVrequest(self, loc.zip, function UVresponseCallback(err, EPAresp) {
                    var uvspeech;
                    if (err) {
                      uvspeech = "there was a problem with the request, try again later";
                      self.emit(':tell', uvspeech);
                    }
                  });
                  break;
              case 204:
                  // This likely means that the user didn't have their address set via the companion app.
                  console.log("Successfully requested from the device address API, but no address was returned.");
                  this.emit(":tell", "you have to set up your address in the Alexa app first!");
                  break;
              case 403:
                  console.log("The consent token we had wasn't authorized to access the user's address.");
                  this.emit(":tellWithPermissionCard", "Please enable location permissions in the alexa app!");
                  break;
              default:
                  this.emit(":ask", "there was an arror with the device address API, try again");
          }

          console.info("Ending getAddressHandler()");
      });

       // var getUV = new requestDeviceLocation(self, apiEndpoint, deviceId, consentToken, function amznCallback(err, amznResp) {
        //  if(err) {
          //  var speech = "there was a problem with the request to the amazon servers";
            //this.emit(':tell', speech);
         // }
        //});
      }
      else {
        var ziPrompt = "Apologies, there seems to be an issue retrieving your device's zip code, please tell me your location?";
        this.emit(':ask', ziPrompt);
      }
      }
      else {
          loc.zip = 95616;
                  //this.emit(':tell', "country " +loc.country+ " postal code " +loc.zip);
                  console.log("making UV request to EPA now...");
                  makeUVrequest(self, loc.zip, function UVresponseCallback(err, EPAresp) {
                    var uvspeech;
                    if (err) {
                      uvspeech = "there was a problem with the request, try again later";
                      self.emit(':tell', uvspeech);
                    }
                  });
      }
    },
    'GetNewQuoteIntent': function () {
        this.emit('GetQuote');
    },
    'GetQuote': function () {
        // Get a random motivational quote
        var quoteIndex = Math.floor(Math.random() * phrases.length);
        var randomQuote = phrases[quoteIndex];

        // Create speech output & SPEAK!
        var speechOutput = randomQuote;
        this.emit(':tellWithCard', speechOutput, SKILL_NAME, randomQuote);
    },
    'HelpIntent': function () {
        var speechOutput = "I can tell you about your local U.V. index, as long as you've allowed me to access your zip code information!";
        var reprompt = "Shall we begin? Ask me to tell you what the UV rating is!";
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', 'Goodbye!');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'Goodbye!');
    },

    'Unhandled': function () {
        this.emit(':ask', "Would you like to know if you need to wear sunscreen? If so, you've come to the right AI!");
    }
};

function requestDeviceLocation(self, endpoint, deviceId, consentToken, amznRqstCallback) {
  const requestOptions = {
    hostname: endpoint.replace(/^https?:\/\//i, ""),
    path: '/v1/devices/'+ deviceId +'/settings/address/countryAndPostalCode',
    method: 'GET',
    accept: 'application/json',
    'headers': {
        'Authorization': 'Bearer '+ consentToken,
    }
  };
    //var amznURL = "https://api.amazonalexa.com/v1/devices/" + deviceId + "/settings/address/countryAndPostalCode";
  //var zipReq = new XMLHttpRequest();
  //zipReq.open('GET', amznURL, false);
  //var zipResp = JSON.parse(zipReq.responseText);
  //loc.country = zipResp.countryCode;
  //loc.zip = zipResp.postalCode;
  //var amznURL = "https://api.amazonalexa.com/v1/devices/" + deviceId + "/settings/address/countryAndPostalCode";
  https.get(requestOptions, (res) => {
    var amznResStrn = "";
    console.log("status code: " + res.statusCode);
    //self.emit(':tell', res.statusCode);
    console.log("headers: ", res.headers);
    if (res.statusCode != 200) {
      self.emit(':tell', "UV request error" + res.statusCode);
    }
    res.on('data', function(data) {
      amznResStrn += data;
      console.log("data object: " + data);
    });
    res.on('end', function() {
      console.log('resp strng = ' + amznResStrn);
      var amznResponse = JSON.parse(amznResStrn);
      console.log('JSON resp = ' + amznResponse);

      if (amznResponse.error) {
        console.log ("EPA error: " + amznResponse.error.message);
        self.emit(':tell', "EPA error: " + amznResponse.error.message);
      }
      console.log("amzn payload: " + amznResponse);
      loc.country = amznResponse.countryCode;
      loc.zip = amznResponse.postalCode;
      console.log("making UV request to EPA now...");
      makeUVrequest(self, loc.zip, function UVresponseCallback(err, EPAresp) {
        var uvspeech;
        if (err) {
          uvspeech = "there was a problem with the request, try again later";
          self.emit(':tell', uvspeech);
        }
      });
    });
  }).on('error', function(e) {
    console.log("communication error: " + e);
    self.emit(':tell', "communication error: " + e.message);
  });
  console.log(loc.zip);
  self.emit(':tell', loc.zip);
}

function makeUVrequest(self, zipCode, UVresponseCallback) {
  //get UV from EPA (better than openweathermap)
  var EPAendpoint = "https://iaspub.epa.gov/enviro/efservice/getEnvirofactsUVHOURLY/ZIP/"+zipCode+"/JSON";
  //var UVreq = new XMLHttpRequest();
  //UVreq.open('GET', epaUVurl, false); //synch req bc alexa's weird
  //UVreq.send(null);
  //var uvResp = JSON.parse(UVreq.responseText);
  //self.emit(':tell', "making EPA request now");
  https.get(EPAendpoint, function (res) {
    var UVrespStrng = "";
    console.log("status code: " + res.statusCode);
    //self.emit(':tell', "EPA query status code is " + res.statusCode);
    console.log("headers: ", res.headers);
    if (res.statusCode != 200) {
      self.emit(':tell', "UV request error" + res.statusCode); //403 sometimes
    }
    //self.emit(':tell', "EPA query with zip code " + zipCode + " status code is " + res.statusCode + " payload is " + res.data);
    res.on('data', function(data) {
      UVrespStrng += data;
      console.log("data object: " + data);
      //self.emit(':tell', UVrespStrng);
    });

    res.on('end', function() {
      //console.log('resp strng = ' + UVrespStrng);
      JSON.stringify(UVrespStrng);
      //self.emit(':tell', UVrespStrng);
      //UVrespStrng = UVrespStrng.slice(0, -1); //cuts the last char
      //UVrespStrng = UVrespStrng.slice(1, -1); //cuts the first n last char
      //self.emit(':tell', UVrespStrng);
      //console.log('stringified n sliced resp = ' + UVrespStrng);
      var EPAresponse = JSON.parse(UVrespStrng);
      console.log('JSON resp[3] = ' + JSON.stringify(EPAresponse[3]));

      if (UVrespStrng.error) {
        console.log ("EPA error: " + UVrespStrng.error.message);
        self.emit(':tell', "EPA error: " + UVrespStrng.error.message);
      }
      //self.emit(':tell', loc.UVdata);
      //loc.UVdata = EPAresponse.UV_INDEX;
      //console.log("payload: " + EPAresponse);
      //loc.UVtime = EPAresponse.DATE_TIME;
      //var yourUV = new YouVeeIndexResult(self, loc.UVdata, loc.zip);
      var now = currentTime(loc.zip);
      var UVindex = processUVarray(EPAresponse, now);
      var yourUV = new YouVeeIndexResult(self, UVindex, loc.zip);
    });
  }).on('error', function(e) {
    console.log("communication error: " + e);
    self.emit(':tell', "communication error: " + e.message);
  });
  /* when doing http requests... ***
  Make sure that you are sending response in 'end' event of http.get.
  Otherwise your response will be sent to alexa
  even before the http.get executed fully.
    response.on('end', function () {
      //Call context.succeed/send response here
    });      */
}

function currentTime(postal) {
  //apparently there is a slot type AMAZON.TIME:
    //There is no DATETIME slot type, so you need to handle each slot separately:
      //AMAZON.DATE and AMAZON.TIME. e.g. "Mark completion on {DATE} at {TIME}"
  //DUMB - not automatic, converts user speech to the proper format
  var time = new Date();
  console.log("js time before: " + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds());
  var timezone = zipcode_to_timezone.lookup(postal); //tz = Continent/State
  var realTime = time.toLocaleString('en-US', {timeZone: timezone});
  var localTime = new Date(realTime);
  //var curTime = moment().tz(timeZone);
  //var thisTime = moment.tz(curTime.year(), curTime.month(), curTime.date(), time.getHours(), time.getMinutes(),timeZone);
  //console.log("moment time: ");
  console.log(timezone);
  console.log(realTime);
  //var time = new Date();
  console.log("js time after: " + localTime.getHours() + ":" + localTime.getMinutes() + ":" + localTime.getSeconds());
  return localTime;

}

function processUVarray(UVobjects, time){
  var UVidx;
  var ampm, hour;
  //figure out which hour time is closest to, ie 5:15pm is 5 pm
  var roundedTime = roundMinutes(time);
  if(roundedTime.getHours() > 12) {
    hour = roundedTime.getHours() - 12;
    ampm = 'PM';
  }
  else {
    hour = roundedTime.getHours();
    ampm = 'AM';
  }
    var myTime = hour + " " + ampm;
console.log("processing uv object now");
//console.log(UVobjects);
  //process the array and find the timePoint we want
  for (var i = 0; i < 21; i++) {
  //UVobjects.forEach(timePoint, index) {
    //var timePoint = timePoint.slice(1, -1); //remove [ and ]
    var timePoint = UVobjects[i];
    //console.log(timePoint);
    //console.log("hours: " + hour + " " + ampm);
    var dateTime = timePoint.DATE_TIME;
    //dateTime = dateTime.slice(11, 0);
    //console.log("sliced dateTime: " + dateTime);
     if(dateTime.includes(myTime)) {
        UVidx = timePoint.UV_VALUE;
        return UVidx;
    }
  }
  //return the UV at timePoint time
  //return UVidx;

}

function YouVeeIndexResult(self, uv, zipCode) {
  var uvspeech;
  //state response
  uvspeech = "Currently, in your area, the U.V. index is "+ uv +". ";
  if (uv > 11)
    uvspeech += phrases[5];
  else if (uv >= 8 && uv < 11)
    uvspeech += phrases[0];
  else if (uv >= 6 && uv < 8)
    uvspeech += phrases[1];
  else if (uv >= 3 && uv < 6)
    uvspeech += phrases[2];
  else if (uv > 0 && uv < 3)
    uvspeech += phrases[3];
  else if (uv === 0)
    uvspeech += phrases[4];
  //this.emit(uvspeech);
  self.emit(':tellWithCard', uvspeech, SKILL_NAME, uvspeech);
}

function roundMinutes(date) {

    date.setHours(date.getHours() + Math.round(date.getMinutes()/60));
    date.setMinutes(0);

    return date;
}

/*
var phrases = [
    "Better put on sunscreen, but try to stay in the shade. It's a scorcher!", //UV high
    "If I were organic, I'd wear some sunscren today and enjoy the sun. Yes, you should stink of sun screen today.", //UV med-high
    "You probably want to play it safe and wear sunscreen, but UV level's aren't very high", //uv med-low
    "The UV is pretty low right now so don't worry about sun screen. Get out there!", //uv low
    "No, you definitely don't need to stink of sunscreen right now, enjoy!.", //no uv
    "UV levels are dangerously high, if you can't avoid being exposed wear as much protection as possible (yes, that includes sun-block)... Thanks climate change!"
];

Forecast:
https://iaspub.epa.gov/enviro/efservice/getEnvirofactsUVHOURLY/ZIP/92122/JSON
Returns:
[
  {"ORDER":1,"ZIP":92122,"DATE_TIME":"JUN/20/2017 04 AM","UV_VALUE":0},
  {"ORDER":2,"ZIP":92122,"DATE_TIME":"JUN/20/2017 05 AM","UV_VALUE":0},
  {"ORDER":3,"ZIP":92122,"DATE_TIME":"JUN/20/2017 06 AM","UV_VALUE":0},
  {"ORDER":4,"ZIP":92122,"DATE_TIME":"JUN/20/2017 07 AM","UV_VALUE":0},
  {"ORDER":5,"ZIP":92122,"DATE_TIME":"JUN/20/2017 08 AM","UV_VALUE":2},
  {"ORDER":6,"ZIP":92122,"DATE_TIME":"JUN/20/2017 09 AM","UV_VALUE":4},
  {"ORDER":7,"ZIP":92122,"DATE_TIME":"JUN/20/2017 10 AM","UV_VALUE":6},
  {"ORDER":8,"ZIP":92122,"DATE_TIME":"JUN/20/2017 11 AM","UV_VALUE":9},
  {"ORDER":9,"ZIP":92122,"DATE_TIME":"JUN/20/2017 12 PM","UV_VALUE":11},
  {"ORDER":10,"ZIP":92122,"DATE_TIME":"JUN/20/2017 01 PM","UV_VALUE":11},
  {"ORDER":11,"ZIP":92122,"DATE_TIME":"JUN/20/2017 02 PM","UV_VALUE":10},
  {"ORDER":12,"ZIP":92122,"DATE_TIME":"JUN/20/2017 03 PM","UV_VALUE":8},
  {"ORDER":13,"ZIP":92122,"DATE_TIME":"JUN/20/2017 04 PM","UV_VALUE":5},
  {"ORDER":14,"ZIP":92122,"DATE_TIME":"JUN/20/2017 05 PM","UV_VALUE":3},
  {"ORDER":15,"ZIP":92122,"DATE_TIME":"JUN/20/2017 06 PM","UV_VALUE":1},
  {"ORDER":16,"ZIP":92122,"DATE_TIME":"JUN/20/2017 07 PM","UV_VALUE":0},
  {"ORDER":17,"ZIP":92122,"DATE_TIME":"JUN/20/2017 08 PM","UV_VALUE":0},
  {"ORDER":18,"ZIP":92122,"DATE_TIME":"JUN/20/2017 09 PM","UV_VALUE":0},
  {"ORDER":19,"ZIP":92122,"DATE_TIME":"JUN/20/2017 10 PM","UV_VALUE":0},
  {"ORDER":20,"ZIP":92122,"DATE_TIME":"JUN/20/2017 11 PM","UV_VALUE":0},
  {"ORDER":21,"ZIP":92122,"DATE_TIME":"JUN/20/2017 12 AM","UV_VALUE":0}
]
*/
