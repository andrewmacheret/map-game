# map-game

[![Build Status](https://travis-ci.org/andrewmacheret/map-game.svg?branch=master)](https://travis-ci.org/andrewmacheret/map-game) [![License](https://img.shields.io/badge/license-MIT-lightgray.svg)](https://github.com/andrewmacheret/map-game/blob/master/LICENSE.md)

A web-based map game using [jQuery](https://jquery.com) and [Highmaps](https://www.highcharts.com/products/highmaps).

See it running at [https://andrewmacheret.com/projects/map-game](https://andrewmacheret.com/projects/map-game).

![Map game image](www/world.png?raw=true "Map game image")

Prereqs:
* [andrewmacheret/remote-apis](https://github.com/andrewmacheret/remote-apis)
* A web server (like [Apache](https://httpd.apache.org)).

Installation steps:
* `git clone <clone url>`

Test it:
* Open `index.html` in a browser.
 * For testing purposes, if you don't have a web server, running `python -m SimpleHTTPServer` in the project directory and navigating to [http://localhost:8000](http://localhost:8000) should do the trick.
* After loading, you should see a clickable world map. Enjoy!
* To troubleshoot, look for javascript errors in the browser console.

