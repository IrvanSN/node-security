require('dotenv').config()
const http = require('http');
const {Server} = require('socket.io')
const CryptoJS = require('crypto-js')

let mac_addresses = require(__dirname + '/data/mac.json')
let users = []

const server = http.createServer((req, res) => {
  if (req.url === '/mac_addresses' && req.method === "GET") {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200
    res.end(JSON.stringify({
      error: false,
      data: mac_addresses
    }));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 404
    res.end(JSON.stringify({
      error: true,
      message: 'Endpoint not found!'
    }));
  }
});

const generateUserData = (data, socketId, currentPosition) => {
  let userData

  if (data.ssid !== 'ITTelkom_Surabaya') {
    userData = {
      id: socketId,
      name: data.name,
      address: '00:00:00:00:00:00',
      currentPosition: 'Outside ITTelkom Surabaya'
    }
  } else if (currentPosition.length < 1) {
    userData = {
      id: socketId,
      name: data.name,
      address: data.mac,
      currentPosition: 'MAC Address Not Discovered'
    }
  } else {
    userData = {
      id: socketId,
      name: data.name,
      address: data.mac,
      currentPosition: currentPosition[0].position
    }
  }

  return userData
}

const io = new Server(server, {})

io.on('connection', (socket) => {
  console.log(`a user connected, ${socket.id}`);
  console.log('connect', users)

  socket.on('login', (rawData) => {
    // TODO CRYPTOJS
    // console.log('rawData/cipher', rawData)
    // const decrypt = CryptoJS.AES.decrypt(rawData, process.env.SECRET_KEY).toString(CryptoJS.enc.Utf8)
    // console.log('decrypt', decrypt)
    // const data = JSON.parse(decrypt)
    // console.log('data', data)
    // TODO NO CRYPTOJS
    const data = rawData

    const isDuplicateName = users.find(item => item.name.toLowerCase() === data.name.toLowerCase())

    if (isDuplicateName) return socket.emit('login-status', {
      status: false,
      message: 'Terdeteksi duplikasi nama, gunakan nama yang lain!'
    })
    const currentPosition = mac_addresses.filter(item => item.addresses.includes(data.mac))

    const userData = generateUserData(data, socket.id, currentPosition)

    users.push(userData)

    // TODO CRYPTOJS
    const encryptedText = CryptoJS.AES.encrypt(JSON.stringify({
      status: true,
      data: {
        userData,
        users,
        position: mac_addresses.map(item => {
          return {id: item.id, position: item.position, image: item.image}
        })
      }
    }), process.env.SECRET_KEY).toString()
    socket.emit('login-status', encryptedText)
    // TODO NO CRYPTOJS
    // socket.emit('login-status', {
    //   status: true,
    //   data: {
    //     userData,
    //     users,
    //     position: mac_addresses.map(item => {
    //       return {id: item.id, position: item.position, image: item.image}
    //     })
    //   }
    // })


    socket.broadcast.emit('refresh-user-lists', users)
  })

  socket.on('refresh-position', (data) => {
    const matchedUser = users.filter(user => user.id === socket.id)[0]
    if (matchedUser && (matchedUser.address === data.mac)) {
      console.log('sama nich')
      return null
    }

    const currentPosition = mac_addresses.filter(item => item.addresses.includes(data.mac))
    const userData = generateUserData(data, socket.id, currentPosition)

    users = users.filter(user => user.id !== socket.id)
    users.push(userData)

    console.log('on refresh position', data)
    socket.emit('refresh-user-lists', users)
    socket.broadcast.emit('refresh-user-lists', users)
  })

  socket.on('disconnect', () => {
    console.log(`a user disconnected, ${socket.id}`);
    users = users.filter(user => user.id !== socket.id)
    console.log('disconnect', users)
  });
});

server.listen(4000, () => {
  console.log('Socket.io server listening on port 4000');
});
