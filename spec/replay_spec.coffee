{ assert, vows, HTTP } = require("./helpers")


vows.describe("Replay").addBatch

  "matching URL":
    "listeners":
      topic: ->
        request = HTTP.get(host: "example.com", path: "/weather?c=94606")
        request.on "response", (response)=>
          response.on "end", =>
            @callback null, response
        request.on "error", @callback
        return
      "should return HTTP version": (response)->
        assert.equal response.httpVersion, "1.1"
      "should return status code": (response)->
        assert.equal response.statusCode, "200"
      "should return response headers": (response)->
        assert.deepEqual response.headers, { "content-type": "text/html", "date": "Tue, 29 Nov 2011 03:12:15 GMT" }
      "should return response trailers": (response)->
        assert.deepEqual response.trailers, { }
    "callback":
      topic: ->
        request = HTTP.get(host: "example.com", path: "/weather?c=94606", (response)=>
          response.on "end", =>
            @callback null, response
        )
        request.on "error", @callback
        return
      "should return HTTP version": (response)->
        assert.equal response.httpVersion, "1.1"
      "should return status code": (response)->
        assert.equal response.statusCode, "200"
      "should return response headers": (response)->
        assert.deepEqual response.headers, { "content-type": "text/html", "date": "Tue, 29 Nov 2011 03:12:15 GMT" }
      "should return response trailers": (response)->
        assert.deepEqual response.trailers, { }


  "unreachable URL":
    topic: ->
      request = HTTP.get(host: "example.com", path: "/weather?c=14003", (response)=>
        @callback null, "callback"
      )
      request.on "response", (response)=>
        @callback null, "listener"
      request.on "error", (error)=>
        @callback null, error
      return
    "should callback with error": (error)->
      assert.instanceOf error, Error
      assert.equal error.message, "Unable to reach http://example.com/weather?c=14003"


.export(module)
