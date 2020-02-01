require('dotenv').config()
const fs = require('fs')
const Axios = require('axios')
const Twitter = require('twitter')

const webhookUrl = process.env.MATTERMOST_WEBHOOK
const screenName = process.env.TWITTER_HANDLE
const logfile = './lastId'
let fileContents, lastId

// Send a post (tweet) to Mattermost webhook. If succeeded, log the tweet's ID
// so we know where to continue next time
const sendPost = (id, params) => {
  Axios.post(webhookUrl, params).then((response) => {
    if (response.status === 200 && id > lastId) {
      fs.writeFileSync(logfile, id)
      lastId = id
    }
  })
  .catch((error) => {
    console.log(error)
  })
}

// Read the ID of the last tweet we've posted
try {
  fileContents = fs.readFileSync(logfile, { encoding: 'ASCII' })
} catch {
  throw (`Cannot read from file. Does "${logfile}" exist?`)
}
lastId = BigInt(fileContents)

// Twitter API
const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  bearer_token: process.env.TWITTER_BEARER_TOKEN
})

const timelineParams = {
  screen_name: screenName,
  exclude_replies: true,
  since_id: Number(lastId) || undefined,
  count: 10
}

client.get('statuses/user_timeline', timelineParams, (error, tweets) => {
  if (error) {
    console.log(error)
  } else {
    for (const tweet of tweets) {
      console.log(tweet.id, `${tweet.created_at}: ${tweet.text}`)

      tweet.id = BigInt(tweet.id.toString())
      const params = {}

      // It shouldn't happen according to Twitter API, but it does ...
      if (tweet.id <= lastId) {
        return
      }

      if (tweet.retweeted_status) {
        params.text = `${tweet.user.name} retweeted: ${tweet.retweeted_status.text}`
      } else {
        params.text = tweet.text
      }
      sendPost(tweet.id, params)
    }
  }
})
