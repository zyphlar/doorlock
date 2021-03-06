const Cards = require('./cards')
const https = require('https')
const {
  CARD_UPDATE_INTERVAL,
  COBOT_CARDS_API,
  COBOT_CLIENT_ID,
  COBOT_CLIENT_SECRET,
  COBOT_SCOPE,
  COBOT_USER_EMAIL,
  COBOT_USER_PASSWORD,
} = require('../../constants')

module.exports = class Cobot {
  constructor(token) {
    this.token = token
  }

  cards() {
    if (!COBOT_CARDS_API)
      throw new Error('missing "COBOT_CARDS_API" env variable!')
    return new Promise((resolve, reject) => {
      // TODO move to axios
      const req = https.request(
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          hostname: 'chimera.cobot.me',
          method: 'GET',
          path: '/api/check_in_tokens',
        },
        res => {
          const { statusCode, headers } = res
          console.log('\n----------------------------------------------------')
          console.log('COBOT CARDS RESPONSE:')
          console.log(JSON.stringify({ statusCode, headers }, null, 2))
          res.setEncoding('utf8')

          let cards = ''
          res.on('data', chunk => {
            cards += chunk
          })

          res.on('end', () => {
            cards = JSON.parse(cards)
            console.log(JSON.stringify(cards, null, 2))
            if (!cards || !cards.length) {
              throw new Error('No cards received from API!')
            }
            resolve(
              cards.map(card => ({
                name: card.membership.name,
                number: card.token,
              }))
            )
            console.log(
              '----------------------------------------------------\n'
            )
          })
        }
      )
      req.on('data', console.log)
      req.on('error', e => {
        console.error(e)
        reject(e)
      })
      req.end()
    })
    // return axios
    //   .get(COBOT_CARDS_API, {
    //     headers: {
    //       Authorization: `Bearer ${this.token}`,
    //     },
    //   })
    //   .then(resp =>
    //     resp.data.map(card => ({
    //       name: card.membership.name,
    //       number: card.token,
    //     }))
    //   )
  }

  static authorize() {
    console.log('Authorizing Cobot application...')
    if (!COBOT_SCOPE) throw new Error('missing "COBOT_SCOPE" env variable!')
    if (!COBOT_USER_EMAIL)
      throw new Error('missing "COBOT_USER_EMAIL" env variable!')
    if (!COBOT_USER_PASSWORD)
      throw new Error('missing "COBOT_USER_PASSWORD" env variable!')
    if (!COBOT_CLIENT_ID)
      throw new Error('missing "COBOT_CLIENT_ID" env variable!')
    if (!COBOT_CLIENT_SECRET)
      throw new Error('missing "COBOT_CLIENT_SECRET" env variable!')

    const qs = [
      `scope=${COBOT_SCOPE}`,
      `grant_type=password`,
      `username=${COBOT_USER_EMAIL}`,
      `password=${encodeURI(COBOT_USER_PASSWORD)}`,
      `client_id=${COBOT_CLIENT_ID}`,
      `client_secret=${COBOT_CLIENT_SECRET}`,
    ].join('&')

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'www.cobot.me',
          method: 'POST',
          path: `/oauth/access_token?${qs}`,
        },
        res => {
          const { statusCode, headers } = res
          console.log('\n----------------------------------------------------')
          console.log('COBOT AUTHORIZATION RESPONSE:')
          console.log(JSON.stringify({ statusCode, headers }, null, 2))

          res.setEncoding('utf8')

          let cobot
          res.on('data', chunk => {
            const body = JSON.parse(chunk)
            console.log(JSON.stringify({ body }, null, 2))
            const token = body.access_token
            if (!token) {
              console.error(`Expected access token, got: ${body}`)
              throw new Error('Error getting access token')
            }
            cobot = new Cobot(token)
          })

          res.on('end', () => {
            resolve(cobot)
            console.log(
              '----------------------------------------------------\n'
            )
          })
        }
      )
      req.on('error', e => reject(e))
      req.end()
    })
    // return axios
    //   .post(`https://www.cobot.me/oauth/access_token?${qs}`)
    //   .then(resp => new Cobot(resp.data.access_token))
  }

  static getCards() {
    console.log('Updating cards...')
    return this.authorize()
      .then(cobot => cobot.cards())
      .then(cards => Cards.write(cards))
    // .then(() => {
    //   console.log(
    //     'Updating card list in',
    //     CARD_UPDATE_INTERVAL / 1000,
    //     'seconds...'
    //   )
    //   setTimeout(this.getCards.bind(this), CARD_UPDATE_INTERVAL)
    // })
  }
}
