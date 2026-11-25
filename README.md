# map-game

[![Deploy](https://github.com/andrewmacheret/map-game/actions/workflows/deploy.yml/badge.svg)](https://github.com/andrewmacheret/map-game/actions/workflows/deploy.yml) [![Canary](https://github.com/andrewmacheret/map-game/actions/workflows/canary.yml/badge.svg)](https://github.com/andrewmacheret/map-game/actions/workflows/canary.yml) [![License](https://img.shields.io/badge/license-MIT-lightgray.svg)](https://github.com/andrewmacheret/map-game/blob/master/LICENSE.md)

A web-based map game using [Highmaps](https://www.highcharts.com/products/highmaps), with data from the [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392).

See it running at [https://andrewmacheret.com/projects/map-game](https://andrewmacheret.com/projects/map-game).

![Map game image](www/world.png?raw=true "Map game image")

Test it:
* Run `python3 -m http.server` in the `www` directory and go to [http://localhost:8000](http://localhost:8000).
* After loading, you should see a clickable world map. Enjoy!
* To troubleshoot, look for javascript errors in the browser console.

Deploy:
* Pushing to `master` runs a GitHub Actions workflow that syncs `www` to `s3://andrewmacheret.com/projects/map-game` and invalidates the CloudFront cache.
* It signs in to AWS with GitHub OIDC using the IAM role in the `AWS_ROLE_ARN` repo variable.

## Health check

[`/projects/map-game/healthcheck/`](https://andrewmacheret.com/projects/map-game/healthcheck/) checks the page and its scripts and styles (including Highmaps), the World Bank API, the world map on jsDelivr and the flags on flagcdn. The Canary workflow (`.github/workflows/canary.yml`) opens it once a day, started by [andrewmacheret/canary](https://github.com/andrewmacheret/canary).
