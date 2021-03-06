'use strict';

// USED FOR EXPORTS.SEARCH, PROBABLY NEED A MUTEX OR CLEANUP OF SOME SORT
var saved_res = -1;
var saved_person_id = -1;

/**
 * Module dependencies
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Game = mongoose.model('Game'),
  Player = mongoose.model('Player'),
  User = mongoose.model('User'),
  Handler = require('./Handler'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

var Class = {
  Game: require('../../class/Game'),
  Player: require('../../class/Player'),
  AI: require('../../class/AI'),
  User: mongoose.model('User')
};

// when starting up the server, set all in progress games to aborted just to clean things up
Game.remove({ state: 'aborted' }, function (err, data) { if (err) console.log(err); });
// Game.remove({ practice: true }, function (err, data) { if (err) console.log(err); });
Game.update({ state: 'in progress' }, { $set: { state: 'aborted' } }, { multi: true },
  function(err, data) { if (err) console.log(err); console.log('Regular game cleanup performed: '); console.log(data); });

/*
    Handler "hash map", maybe in the future convert it to an actual hashmap
    Each handler is hashed to the gameID of the game it handles
*/
var handlers = {};

/**
 * search for a game [only kinda works for 2 people rn]

 really primitive search right now: stores first search request and then responds to both search requests
 at the same time
 */

function verifyAccount (req, res, id, username, next) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).send({
      message: 'Account ID is invalid'
    });
    return false;
  }

  var returnValue = true;
  User.findById(id).populate('users').exec(function (err, user) {
    if (err) {
      console.log(err);
    } else if (!user || user && user.username !== username) {
      res.status(404).send({
        message: 'No user with that identifier has been found'
      });
      returnValue = false;
      return returnValue;
    }
    req.user = user;
    // returnValue = true;
    next(req, res);
  });
  return returnValue;
}

function performSearch(req, res) {
  if (saved_res === -1) { // first person who searches reaches here
    saved_res = res; // save their request object and ID
    saved_person_id = req.body.devkey;
  } else { // second person reaches here
    if (saved_person_id === req.body.devkey) {
      saved_res = res;
    } else {
      var people = [saved_person_id, req.body.devkey]; // the first player who searches will be player 1
      var new_handler = new Handler(handlers, people, Class, [saved_res, res], function(err) { // create new Handler object for new Game, the new Game will be init in Handler constructor
        if (err) res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      }, false);
      handlers[new_handler.id] = new_handler; // add to assoc. array (hashmap)
      // console.log(handlers);
      saved_res = -1; // reset search request (PROBABLY STILL NEEDS MUTEX)
      saved_person_id = -1;
    }
  }
}

/**
 * practice vs AI
 */

exports.practice = function (req, res) {
  verifyAccount(req, res, req.body.devkey, req.body.username, function() {
    var new_handler = new Handler(handlers, [req.body.devkey, null], Class, [res, null], function(err) { // create new Handler object for new Game, the new Game will be init in Handler constructor
      if (err) res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }, true);
    handlers[new_handler.id] = new_handler; // add to assoc. array (hashmap)
    // console.log(handlers);
  });
};

exports.search = function (req, res) {
  verifyAccount(req, res, req.body.devkey, req.body.username, performSearch);
};

/**
 * Show the current game
 */
exports.read = function (req, res) {
  // convert mongoose document to JSON
  var game = req.game ? req.game.toJSON() : {};

  res.json(game);
};

/**
 * Submit a move
 */
exports.submit = function (req, res) {
  var game = req.game;
  // console.log(req.body.move);
  if (typeof handlers[game._id] === 'undefined') {
    res.json('Game ID is undefined, maybe the game ended or does not exist!');
  } else handlers[game._id].submitMove(req.body.move, req.body.playerID, req.body.devkey, res);
};

/**
 * List of Games
 */
exports.list = function (req, res) {
  Game.find().sort('-date').limit(50).populate('people').exec(function (err, games) {
    if (err) {
      // console.log(err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      // console.log(games);
      res.json(games);
    }
  });
};

// training mode, doesn't really need anything here tbh
exports.training = function (req, res) {
  res.json(Class);
};

/**
 * Article middleware
 */
exports.gameByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Game is invalid'
    });
  }

  // Game.findById(id).populate('players', 'people').exec(function (err, game) { // MERGE EVENTUALLY
  Game.findById(id).populate('players people replay').exec(function (err, game) {
    if (err) {
      return next(err);
    } else if (!game) {
      return res.status(404).send({
        message: 'No article with that identifier has been found'
      });
    }
    req.game = game;
    next();
  });
};

exports.accountByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Account ID is invalid'
    });
  }

  User.findById(id).populate('users').exec(function (err, user) {
    if (err) {
      return next(err);
    } else if (!user) {
      return res.status(404).send({
        message: 'No user with that identifier has been found'
      });
    }
    console.log(user);
    req.user = user;
    next();
  });
};
