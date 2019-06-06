// import our js libraries
require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const app = express();
const session = require('express-session');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const Cosmic = require('cosmicjs');
const api = Cosmic();
const bucket = api.bucket({
  slug: 'cosmic-messenger',
  read_key: process.env.__COSMIC_READ_KEY__,
  write_key: process.env.__COSMIC_WRITE_KEY__
});

// configure our application level middleware
if (process.env.NODE_ENV === 'development') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}
app.use('/', express.static('./dist'));
app.use('/api', bodyparser.json());
app.use(session({
  secret: process.env.__API_SECRET__,
  resave: false,
  saveUninitialized: true,
}))
const PORT = process.env.PORT || 3000;

/**
 * Socket configuration for client events
 * 
 * Events:
 *  @register - should emit when a user registers a username.
 *  @session - should emit when a user enters chat.
 *  @logout - should emit when a new user logs out.
 *  @message - should emit a message to users when users send a message.
 * 
 */
io.on('connection', function (socket) {
  socket.on('register', function (user) {
    io.emit('register', user);
  });

  socket.on('session', function (user) {

  });

  socket.on('logout', function (user) {

  });

  socket.on('message', function (msg) {
    io.emit('message', msg);
  });
})

/**
 * 
 * Below we are configuring our server routes for creating
 * resources on Cosmic JS and serving our React Application
 * 
 * Login Route that returns a user object
 */
app.post('/api/register', async function (request, response) {
  const { username } = request.body;
  if (!username) {
    response.status(400).send({ 'message': '/api/register error, no userName on request body' });
    return;
  }
  try {
    let user = await bucket.getObjects({ type: 'users', filters: { title: username } });
    if (user.status !== 'empty') {
      response.status(400).send({ "message": "user is already logged in" });
      return;
    }
    user = await bucket.addObject({ title: username, type_slug: 'users' });
    request.session.user_id = user.object._id;
    response.status(200).send({ _id: user.object._id, name: user.object.title, created_at: user.object.created_at });
    return;
  } catch (err) {
    response.status(400).send({ "message": 'Error registering username', "error": err });
    return;
  }
});

/**
 * Logout route that destroys user object
 */
app.post('/api/logout', async function (request, response) {
  const { userName } = request.body;
  if (!userName) {
    response.status(400).send('No username');
  }
  try {
    let deleteUserData = await bucket.deleteObject({
      slug: userName
    });
    response.status(204).send(deleteUserData);
    return;
  } catch (err) {
    response.status(400).send({ "message": "unable to remove user" });
  }
});

app.post('/api/message', async function (request, response) {
  console.log(request.session);
  const { content } = request.body;
  try {
    let message = await bucket.addObject({
      title: content,
      type_slug: "messages",
      content: content,
      metafields: [
        { "key": "user_id", "type": "text", "value": request.session.user_id }
      ],
    });
    response.status(200).send(message);
  } catch (err) {
    response.status(400).send({ "message": "Error creating message", "error": err });
  }
})

/**
 * Serves our entry file for our compiled react applications
 */
app.get(['/', '/:username'], (req, res) => {
  res.sendFile(path.join(__dirname, './public', 'index.html'));
});

http.listen(PORT, () => {
  console.log(`Cosmic Messenger listening on port : ${PORT}`);
});