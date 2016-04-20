# README #

### TRAWL4: A low memory footprint web crawler with a MySQL backend ###


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

You're set!

Now run the crawler with:

```
npm run demo

```
