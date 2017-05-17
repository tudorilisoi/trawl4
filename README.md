# README #

### TRAWL4-alpha: A low memory footprint web crawler with a MySQL backend ###


### Overview

This is a CLI tool for recursively crawling websites. 

It:
  
 - discovers links and recursively follows them 
 - adds crawled pages (URL, content) to a MySQL database for further processing  

Features:
 
 - recursive, suitable for crawling/spidering an entire website/domain
 - respects the robots.txt standard <https://en.wikipedia.org/wiki/Robots_exclusion_standard>
 - holds an in-memory LRU for discovered links so the DB is not hit hard
 - auto-restarts session to avoid memory leaks
 - uses about 240MB RAM per typical crawl session
 


### How do I get set up? ###

Clone this repository and follow these simple steps:

First, create an empty database (the crawler will create the tables automatically):

```
echo "CREATE DATABASE your_db_name" |mysql
```

Then modify lib/db/connect.js to suit your MySQL setup (user/password and database name)

Example: `mysql://user:password@localhost/your_db_name`

Now the obligatory

```
npm i

```

or

```
yarn 

```


You're set!

Now run the crawler with:

```
npm run demo

```

You can hit Ctrl+C to stop crawling and wait about 2 seconds for the script to finish the exit routines.

Running `npm run demo` once more will resume the crawling.

The script will auto-restart itself every 100 URLs to work around a memory leak in cheerio

See lib/constants.js for more settings regarding crawl delay, in-memory LRU cache size, user agent and others


### Be a good citizen

Please don't abuse the demo configuration, write your own (for example `./config/my_config.js`) in  and run it with

```
node runner.js  --preset my_config
```
